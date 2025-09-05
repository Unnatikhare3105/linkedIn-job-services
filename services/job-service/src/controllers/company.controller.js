import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import Company, { CompanyEventService, CompanyVectorService } from "../model/Company.js";
import UserActivity from "../models/UserActivity.js";
import redisClient from "../config/redis.js";
import { sanitizeInput } from "../utils/security.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/http.js";
import {
  validateCompanyId,
  validateReviewInput,
  validatePaginationParams,
} from "../validations/company.validations.js";
import {CACHE_TTL} from "../config/cache.ttl.js";
import {RATE_LIMITS} from "../config/rate.limiter.js";
import dotenv from "dotenv";
import { withLock } from "../utils/withLocks.js";

dotenv.config();


/**
 * Get company page details with analytics and similarity scores
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCompanyPageController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Company page request started`, { companyId: req.params.companyId });

    // Validate company ID
    const { error } = validateCompanyId(req.params);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId,
      });
    }

    const { companyId } = req.params;
    const sanitizedCompanyId = sanitizeInput(companyId);
    const cacheKey = `company_page:${sanitizedCompanyId}`;

    // Check Redis cache
    const cachedPage = await redisClient.get(cacheKey);
    if (cachedPage) {
      const parsedPage = JSON.parse(cachedPage);
      logger.info(`[${requestId}] Company page cache hit`, { companyId: sanitizedCompanyId });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...parsedPage,
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    // Fetch company
    const company = await Company.findOne({ companyId: sanitizedCompanyId, isDeleted: false });
    if (!company) {
      throw new CustomError(HTTP_STATUS.NOT_FOUND, "Company not found", { requestId });
    }

    // Fetch job count and similar companies
    const [jobCount, similarCompanies] = await Promise.all([
      Company.aggregate([
        { $match: { companyId: sanitizedCompanyId } },
        { $lookup: { from: "jobs", localField: "companyId", foreignField: "companyId", as: "jobs" } },
        { $project: { jobCount: { $size: "$jobs" } } },
      ]),
      CompanyVectorService.findSimilarCompanies(company.description || company.shortDescription || company.tagline, 5),
    ]);

    const response = {
      companyId: company.companyId,
      companyName: company.companyName,
      displayName: company.displayName,
      description: company.description,
      shortDescription: company.shortDescription,
      tagline: company.tagline,
      industry: company.industry,
      subIndustry: company.subIndustry,
      companyType: company.companyType,
      companySize: company.companySize,
      foundedYear: company.foundedYear,
      growthMetrics: company.growthMetrics,
      website: company.website,
      email: company.email,
      phone: company.phone,
      headquarters: company.headquarters,
      socialLinks: company.socialLinks,
      jobCount: jobCount[0]?.jobCount || 0,
      similarCompanies: similarCompanies.map((c) => ({
        companyId: c.metadata.companyId,
        companyName: c.metadata.companyName,
        similarityScore: c.score,
      })),
      analytics: {
        viewCount: company.analytics?.viewCount || 0,
        applicationCount: company.analytics?.applicationCount || 0,
        trendingScore: company.analytics?.trendingScore || 0,
        reviewCount: company.analytics?.reviewCount || 0,
        averageRating: company.analytics?.averageRating / (company.analytics?.reviewCount || 1) || 0,
      },
      requestId,
      processingTime: Date.now() - startTime,
    };

    // Cache response
    await redisClient.setex(cacheKey, CACHE_TTL.COMPANY_PAGE, JSON.stringify(response));

    // Background analytics
    setImmediate(async () => {
      try {
        await UserActivity.create({
          activityId: uuidv4(),
          userId: req.body.userId || "anonymous",
          activityType: "COMPANY_PAGE_VIEW",
          metadata: { companyId: sanitizedCompanyId, requestId },
          timestamp: new Date(),
        });
        await CompanyEventService.emit("analytics:company_page_view", {
          companyId: sanitizedCompanyId,
          userId: req.body.userId || "anonymous",
          requestId,
        });
      } catch (bgError) {
        logger.error(`[${requestId}] Background company page analytics failed:`, {
          error: bgError.message,
          stack: bgError.stack,
        });
      }
    });

    logger.info(`[${requestId}] Company page retrieved successfully`, {
      companyId: sanitizedCompanyId,
      jobCount: response.jobCount,
      processingTime: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
    );
  } catch (error) {
    logger.error(`[${requestId}] Company page retrieval failed:`, {
      error: error.message,
      stack: error.stack,
      companyId: req.params?.companyId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};

/**
 * Submit or retrieve employee reviews for a company
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const employeeReviewsController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Employee reviews request started`, {
      companyId: req.params.companyId,
      method: req.method,
    });

    // Validate company ID
    const { error: idError } = validateCompanyId(req.params);
    if (idError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: idError.message,
        requestId,
      });
    }

    const { companyId } = req.params;
    const sanitizedCompanyId = sanitizeInput(companyId);
    const { cursor, limit = 20 } = req.query;
    const { userId, rating, comment, role, tenure } = req.body;

    if (req.method === "POST") {
      // Submit review
      const { error: reviewError } = validateReviewInput(req.body);
      if (reviewError) {
        throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
          details: reviewError.message,
          requestId,
        });
      }

      const reviewKey = `review:${sanitizedCompanyId}:${userId}`;
      return await withLock(reviewKey, 5000, async () => {
        // Check rate limit
        const existingReview = await redisClient.get(reviewKey);
        if (existingReview) {
          throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Review already submitted by user", {
            requestId,
            retryAfter: JSON.parse(existingReview).expiresAt,
          });
        }

        const reviewId = uuidv4();
        const sanitizedReview = {
          reviewId,
          userId: sanitizeInput(userId),
          rating: parseInt(rating),
          comment: sanitizeInput(comment),
          role: sanitizeInput(role),
          tenure: sanitizeInput(tenure),
          createdAt: new Date(),
        };

        // Update company with new review
        await Company.updateOne(
          { companyId: sanitizedCompanyId },
          {
            $push: { reviews: sanitizedReview },
            $inc: {
              "analytics.reviewCount": 1,
              "analytics.averageRating": sanitizedReview.rating,
            },
          }
        );

        // Cache rate limit
        await redisClient.setex(reviewKey, RATE_LIMITS.POST_REVIEW.windowMs / 1000, JSON.stringify({
          reviewId,
          submittedAt: Date.now(),
          expiresAt: Date.now() + RATE_LIMITS.POST_REVIEW.windowMs,
        }));

        // Background analytics
        setImmediate(async () => {
          try {
            await UserActivity.create({
              activityId: uuidv4(),
              userId: sanitizedReview.userId,
              activityType: "EMPLOYEE_REVIEW_SUBMITTED",
              metadata: {
                companyId: sanitizedCompanyId,
                reviewId,
                rating: sanitizedReview.rating,
                requestId,
              },
              timestamp: new Date(),
            });
            await CompanyEventService.emit("analytics:review_submitted", {
              companyId: sanitizedCompanyId,
              reviewId,
              rating: sanitizedReview.rating,
              requestId,
            });
          } catch (bgError) {
            logger.error(`[${requestId}] Background review analytics failed:`, {
              error: bgError.message,
              stack: bgError.stack,
            });
          }
        });

        logger.info(`[${requestId}] Review submitted successfully`, {
          companyId: sanitizedCompanyId,
          reviewId,
          rating: sanitizedReview.rating,
          processingTime: Date.now() - startTime,
        });

        return res.status(HTTP_STATUS.CREATED).json(
          new CustomSuccess(HTTP_STATUS.CREATED, "Review submitted successfully", {
            reviewId,
            companyId: sanitizedCompanyId,
            rating: sanitizedReview.rating,
            comment: sanitizedReview.comment,
            role: sanitizedReview.role,
            tenure: sanitizedReview.tenure,
            requestId,
            processingTime: Date.now() - startTime,
          })
        );
      });
    } else {
      // Retrieve reviews
      const { error: paginationError } = validatePaginationParams(req.query);
      if (paginationError) {
        throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
          details: paginationError.message,
          requestId,
        });
      }

      const cacheKey = `employee_reviews:${sanitizedCompanyId}:${cursor || "0"}:${limit}`;
      const cachedReviews = await redisClient.get(cacheKey);
      if (cachedReviews) {
        const parsedReviews = JSON.parse(cachedReviews);
        logger.info(`[${requestId}] Employee reviews cache hit`, { companyId: sanitizedCompanyId });
        return res.status(HTTP_STATUS.OK).json(
          new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
            ...parsedReviews,
            cached: true,
            requestId,
            processingTime: Date.now() - startTime,
          })
        );
      }

      const company = await Company.findOne({ companyId: sanitizedCompanyId, isDeleted: false });
      if (!company) {
        throw new CustomError(HTTP_STATUS.NOT_FOUND, "Company not found", { requestId });
      }

      const reviews = company.reviews || [];
      const paginatedReviews = reviews.slice(parseInt(cursor || 0), parseInt(cursor || 0) + parseInt(limit));
      const response = {
        companyId: sanitizedCompanyId,
        reviews: paginatedReviews.map((review) => ({
          reviewId: review.reviewId,
          userId: review.userId,
          rating: review.rating,
          comment: review.comment,
          role: review.role,
          tenure: review.tenure,
          createdAt: review.createdAt,
        })),
        pagination: {
          nextCursor: paginatedReviews.length === parseInt(limit) ? parseInt(cursor || 0) + parseInt(limit) : null,
          totalReviews: reviews.length,
          limit: parseInt(limit),
        },
        analytics: {
          averageRating: company.analytics?.averageRating / (company.analytics?.reviewCount || 1) || 0,
          reviewCount: company.analytics?.reviewCount || 0,
        },
        requestId,
        processingTime: Date.now() - startTime,
      };

      // Cache response
      await redisClient.setex(cacheKey, CACHE_TTL.EMPLOYEE_REVIEWS, JSON.stringify(response));

      logger.info(`[${requestId}] Employee reviews retrieved successfully`, {
        companyId: sanitizedCompanyId,
        reviewCount: response.reviews.length,
        processingTime: Date.now() - startTime,
      });

      res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
      );
    }
  } catch (error) {
    logger.error(`[${requestId}] Employee reviews processing failed:`, {
      error: error.message,
      stack: error.stack,
      companyId: req.params?.companyId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};

/**
 * Get company culture information with Gemini AI-generated summary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCompanyCultureInfoController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Company culture info request started`, { companyId: req.params.companyId });

    // Validate company ID
    const { error } = validateCompanyId(req.params);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId,
      });
    }

    const { companyId } = req.params;
    const sanitizedCompanyId = sanitizeInput(companyId);
    const cacheKey = `company_culture:${sanitizedCompanyId}`;

    // Check Redis cache
    const cachedCulture = await redisClient.get(cacheKey);
    if (cachedCulture) {
      const parsedCulture = JSON.parse(cachedCulture);
      logger.info(`[${requestId}] Company culture cache hit`, { companyId: sanitizedCompanyId });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...parsedCulture,
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    // Fetch company
    const company = await Company.findOne({ companyId: sanitizedCompanyId, isDeleted: false });
    if (!company) {
      throw new CustomError(HTTP_STATUS.NOT_FOUND, "Company not found", { requestId });
    }

    // Generate culture summary with Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const cultureData = {
      description: company.description || company.shortDescription || "",
      reviews: company.reviews?.slice(0, 5).map((r) => r.comment).join(" ") || "",
      tagline: company.tagline || "",
      industry: company.industry,
    };
    const prompt = `Generate a concise company culture summary (100-150 words) for a company in the ${cultureData.industry} industry. Use the following details: Description: ${cultureData.description}, Recent Reviews: ${cultureData.reviews}, Tagline: ${cultureData.tagline}. Highlight key cultural aspects such as values, work environment, and employee engagement. Ensure a professional tone.`;
    const result = await model.generateContent(prompt);
    const cultureSummary = result.response.text();

    const response = {
      companyId: sanitizedCompanyId,
      cultureSummary,
      values: company.culture?.values || [],
      perks: company.culture?.perks || [],
      workEnvironment: company.culture?.workEnvironment || "Not specified",
      employeeFeedback: company.reviews?.slice(0, 3).map((r) => ({
        reviewId: r.reviewId,
        rating: r.rating,
        comment: r.comment,
        role: r.role,
        tenure: r.tenure,
        createdAt: r.createdAt,
      })) || [],
      analytics: {
        cultureScore: company.analytics?.cultureScore || 0,
        engagementScore: company.analytics?.engagementScore || 0,
        reviewCount: company.analytics?.reviewCount || 0,
      },
      requestId,
      processingTime: Date.now() - startTime,
    };

    // Cache response
    await redisClient.setex(cacheKey, CACHE_TTL.COMPANY_CULTURE, JSON.stringify(response));

    // Background analytics
    setImmediate(async () => {
      try {
        await UserActivity.create({
          activityId: uuidv4(),
          userId: req.body.userId || "anonymous",
          activityType: "CULTURE_INFO_VIEW",
          metadata: { companyId: sanitizedCompanyId, requestId },
          timestamp: new Date(),
        });
        await CompanyEventService.emit("analytics:culture_view", {
          companyId: sanitizedCompanyId,
          userId: req.body.userId || "anonymous",
          requestId,
        });
      } catch (bgError) {
        logger.error(`[${requestId}] Background culture analytics failed:`, {
          error: bgError.message,
          stack: bgError.stack,
        });
      }
    });

    logger.info(`[${requestId}] Company culture info retrieved successfully`, {
      companyId: sanitizedCompanyId,
      processingTime: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
    );
  } catch (error) {
    logger.error(`[${requestId}] Company culture info retrieval failed:`, {
      error: error.message,
      stack: error.stack,
      companyId: req.params?.companyId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};