import logger from "../utils/logger.js";
import CustomError from "../utils/customError.js";
import CustomSuccess from "../utils/customSuccess.js";
import Job, { JobEventService } from "../model/job.model.js";
import Company, { CompanyEventService, CompanyVectorService } from "../model/company.model.js";
import UserActivity from "../model/userInteraction.model.js"
import redisClient from "../config/redis.js";
import { sanitizeInput, generateSecureId } from "../utils/security.js";
import * as MatchingService from "../services/matching.services.js";
import {
  SearchStatsService,
  AdvancedSearchEngine,
  AnalyticsProcessor,
  RecommendationEngine,
  RecommendationUtils
} from "../services/search.services.js";
import {
  validateUserProfile,
  validatePaginationParams,
  validateMatchingParams
} from "../validations/company.validation.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/messages.js";
import SearchModel, {
  CacheManager,
  PersonalizationEngine
} from "../model/search.model.js";
import { searchDuration, searchRequests, activeSearches, cacheHits } from "../utils/metrics.js";
import { GoogleGenerativeAI } from '@google/generative-ai'; // For Gemini AI
import dotenv from 'dotenv';
import {CACHE_TTL} from "../constants/cache.js";
import {RATE_LIMITS} from "../config/rate.limiter.js";
import { withLock, withRetry } from "../utils/withLocks.js";
dotenv.config();


/**
 * Calculate match score between user profile and job with advanced caching and retry logic
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const calculateMatchScoreController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Match score calculation started`, {
      userId: req.body.userId,
      jobId: req.body.job?.jobId
    });

    // Validate and sanitize input
    const { error } = validateUserProfile(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId
      });
    }

    const sanitizedData = {
      ...req.body,
      userId: sanitizeInput(req.body.userId),
      job: {
        ...req.body.job,
        jobId: sanitizeInput(req.body.job.jobId)
      }
    };

    const { job, userId } = sanitizedData;
    const cacheKey = `match_score:${userId}:${job.jobId}:${Buffer.from(JSON.stringify(sanitizedData)).toString('base64').slice(0, 20)}`;

    activeSearches.inc();

    // Check Redis cache with pipelining
    const [cachedScore] = await redisClient.multi().get(cacheKey).exec();
    if (cachedScore) {
      const parsedScore = JSON.parse(cachedScore);
      SearchStatsService.recordCacheHit('match_score');

      logger.info(`[${requestId}] Match score cache hit`, {
        userId,
        jobId: job.jobId,
        cacheKey,
        processingTime: Date.now() - startTime
      });

      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...parsedScore,
          cached: true,
          requestId,
          processingTime: Date.now() - startTime
        })
      );
    }

    // Calculate match score with retry logic
    const matchPromise = withRetry(() => MatchingService.calculateMatchScore(sanitizedData, job));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 8000)
    );

    const result = await Promise.race([matchPromise, timeoutPromise]);

    // Enhance with Gemini AI similarity score
    const company = await Company.findOne({ companyId: job.companyId });
    if (company && sanitizedData.userProfile?.skills) {
      const similarCompanies = await CompanyVectorService.findSimilarCompanies(
        sanitizedData.userProfile.skills.join(' '),
        5
      );
      result.companySimilarityScore = similarCompanies.find(c => c.metadata.companyId === job.companyId)?.score || 0;
    }

    const enhancedResult = {
      ...result,
      matchId: generateSecureId(),
      calculatedAt: new Date().toISOString(),
      version: '2.1',
      requestId,
      processingTime: Date.now() - startTime,
      cached: false
    };

    // Cache with dynamic TTL
    const cacheTTL = result.matchScore > 80 ? CACHE_TTL.MATCH_SCORE * 2 : CACHE_TTL.MATCH_SCORE;
    await redisClient.setex(cacheKey, cacheTTL, JSON.stringify(enhancedResult));

    // Background analytics
    setImmediate(async () => {
      try {
        await UserActivity.create({
          activityId: generateSecureId(),
          userId,
          activityType: 'MATCH_CALCULATION',
          metadata: {
            jobId: job.jobId,
            matchScore: result.matchScore,
            companySimilarityScore: result.companySimilarityScore,
            requestId
          },
          timestamp: new Date()
        });
        SearchStatsService.recordMatchCalculation(userId, job.jobId, result.matchScore);
      } catch (bgError) {
        logger.error(`[${requestId}] Background activity logging failed:`, bgError);
      }
    });

    logger.info(`[${requestId}] Match score calculated successfully`, {
      userId,
      jobId: job.jobId,
      matchScore: result.matchScore,
      processingTime: Date.now() - startTime
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, enhancedResult)
    );

  } catch (error) {
    logger.error(`[${requestId}] Match score calculation failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      jobId: req.body?.job?.jobId,
      processingTime: Date.now() - startTime
    });
    next(error instanceof CustomError ? error : new CustomError(
      error.message === 'TIMEOUT' ? HTTP_STATUS.REQUEST_TIMEOUT : HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message === 'TIMEOUT' ? 'Match calculation timeout' : ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      { requestId, processingTime: Date.now() - startTime }
    ));
  } finally {
    activeSearches.dec();
    searchDuration.observe(Date.now() - startTime);
  }
};

/**
 * Get personalized job recommendations with ML-powered matching and cursor pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRecommendedJobsController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Job recommendations request started`, {
      userId: req.body.userId,
      query: req.query
    });

    // Validate inputs
    const { error: profileError } = validateUserProfile(req.body);
    if (profileError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: profileError.message,
        requestId
      });
    }

    const { error: paginationError } = validatePaginationParams(req.query);
    if (paginationError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: paginationError.message,
        requestId
      });
    }

    const {
      cursor,
      limit = 20,
      minSalary,
      maxSalary,
      location,
      experienceLevel,
      jobType,
      industry,
      skills,
      sortBy = 'relevance',
      includeRemote = false,
      salaryType = 'all'
    } = req.query;

    const sanitizedFilters = {
      minSalary: minSalary ? sanitizeInput(minSalary) : undefined,
      maxSalary: maxSalary ? sanitizeInput(maxSalary) : undefined,
      location: location ? sanitizeInput(location) : undefined,
      experienceLevel: experienceLevel ? sanitizeInput(experienceLevel) : undefined,
      jobType: jobType ? sanitizeInput(jobType) : undefined,
      industry: industry ? sanitizeInput(industry) : undefined,
      skills: skills ? skills.split(',').map(skill => sanitizeInput(skill.trim())) : undefined,
      includeRemote: includeRemote === 'true',
      salaryType: sanitizeInput(salaryType)
    };

    const { userId } = req.body;
    const cacheKey = `recommended_jobs:${userId}:${Buffer.from(JSON.stringify({
      cursor, limit, sortBy, ...sanitizedFilters
    })).toString('base64')}`;

    searchRequests.inc();
    activeSearches.inc();

    // Check cache
    const cachedJobs = await CacheManager.get(cacheKey);
    if (cachedJobs) {
      const parsedJobs = JSON.parse(cachedJobs);
      SearchStatsService.recordCacheHit('recommendations');

      logger.info(`[${requestId}] Recommendations cache hit`, {
        userId,
        cacheKey: cacheKey.slice(0, 30),
        jobCount: parsedJobs.jobs?.length || 0,
        processingTime: Date.now() - startTime
      });

      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...parsedJobs,
          cached: true,
          requestId,
          processingTime: Date.now() - startTime
        })
      );
    }

    const recommendationEngine = new RecommendationEngine(userId);
    const recommendations = await withRetry(() => recommendationEngine.getPersonalizedRecommendations({
      userProfile: req.body,
      pagination: { cursor, limit: parseInt(limit) },
      filters: sanitizedFilters,
      sortBy: sanitizeInput(sortBy),
      options: {
        includeMatchExplanation: true,
        includeSimilarJobs: true,
        includeCompanyInsights: true
      }
    }));

    // Enhance with Gemini AI-based company similarity
    if (recommendations.jobs.length && sanitizedFilters.skills) {
      const similarCompanies = await CompanyVectorService.findSimilarCompanies(
        sanitizedFilters.skills.join(' '),
        recommendations.jobs.length
      );
      recommendations.jobs = recommendations.jobs.map(job => ({
        ...job,
        companySimilarityScore: similarCompanies.find(c => c.metadata.companyId === job.companyId)?.score || 0
      }));
    }

    const response = {
      jobs: recommendations.jobs.map(job => ({
        ...job,
        viewId: generateSecureId(),
        recommendationReason: job.matchExplanation,
        similarityScore: job.matchScore,
        trending: job.trendingScore > 0.7
      })),
      pagination: {
        nextCursor: recommendations.nextCursor,
        limit: parseInt(limit),
        totalJobs: recommendations.totalCount
      },
      filters: {
        applied: sanitizedFilters,
        available: recommendations.availableFilters,
        suggestions: recommendations.filterSuggestions
      },
      insights: {
        totalMatched: recommendations.totalCount,
        avgMatchScore: recommendations.avgMatchScore,
        topSkillsInDemand: recommendations.topSkills,
        salaryRange: recommendations.salaryInsights,
        locationHotspots: recommendations.locationInsights,
        trendingCompanies: recommendations.trendingCompanies
      },
      personalization: {
        profileCompleteness: recommendations.profileCompleteness,
        improvementSuggestions: recommendations.improvementTips,
        nextRecommendationUpdate: recommendations.nextUpdateTime
      },
      cached: false,
      requestId,
      generatedAt: new Date().toISOString()
    };

    const cacheTTL = RecommendationUtils.calculateCacheTTL(userId, recommendations.freshness);
    await CacheManager.setWithTTL(cacheKey, JSON.stringify(response), cacheTTL);

    setImmediate(async () => {
      try {
        await SearchModel.create({
          searchId: generateSecureId(),
          userId,
          searchType: 'RECOMMENDATION',
          filters: sanitizedFilters,
          resultsCount: recommendations.totalCount,
          requestId,
          timestamp: new Date()
        });
        await RecommendationEngine.updateUserModel(userId, {
          searchFilters: sanitizedFilters,
          resultCount: recommendations.totalCount,
          avgMatchScore: recommendations.avgMatchScore
        });
        AnalyticsProcessor.processRecommendationRequest({
          userId,
          filters: sanitizedFilters,
          resultCount: recommendations.totalCount,
          processingTime: Date.now() - startTime,
          requestId
        });
      } catch (bgError) {
        logger.error(`[${requestId}] Background recommendation processing failed:`, bgError);
      }
    });

    logger.info(`[${requestId}] Recommendations generated successfully`, {
      userId,
      jobCount: response.jobs.length,
      totalMatched: response.insights.totalMatched,
      avgMatchScore: response.insights.avgMatchScore,
      processingTime: Date.now() - startTime
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
    );

  } catch (error) {
    logger.error(`[${requestId}] Recommendation generation failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      processingTime: Date.now() - startTime
    });
    next(error);
  } finally {
    activeSearches.dec();
    searchDuration.observe(Date.now() - startTime);
  }
};

export const getRecentlyPostedJobsController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Recent jobs request started`, req.query);

    const { error } = validatePaginationParams(req.query);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId
      });
    }

    const {
      cursor,
      limit = 50,
      industry,
      location,
      jobType,
      experienceLevel,
      postedWithin = 7,
      includeExpired = false,
      sortBy = 'newest'
    } = req.query;

    const sanitizedFilters = {
      industry: industry ? sanitizeInput(industry) : undefined,
      location: location ? sanitizeInput(location) : undefined,
      jobType: jobType ? sanitizeInput(jobType) : undefined,
      experienceLevel: experienceLevel ? sanitizeInput(experienceLevel) : undefined,
      postedWithin: Math.min(parseInt(postedWithin) || 7, 30),
      includeExpired: includeExpired === 'true',
      sortBy: sanitizeInput(sortBy)
    };

    const cacheKey = `recent_jobs:${Buffer.from(JSON.stringify({
      cursor, limit, ...sanitizedFilters
    })).toString('base64')}`;

    searchRequests.inc({ type: 'recent_jobs' });

    const cachedJobs = await redisClient.get(cacheKey);
    if (cachedJobs) {
      const parsedJobs = JSON.parse(cachedJobs);
      SearchStatsService.recordCacheHit('recent_jobs');

      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...parsedJobs,
          cached: true,
          requestId,
          processingTime: Date.now() - startTime
        })
      );
    }

    const searchEngine = new AdvancedSearchEngine();
    const result = await withRetry(() => searchEngine.getRecentJobs({
      pagination: { cursor, limit: parseInt(limit) },
      filters: sanitizedFilters,
      options: {
        includeTrendingScore: true,
        includeApplicationStats: true,
        includeCompanyGrowth: true
      }
    }));

    const response = {
      jobs: result.jobs.map(job => ({
        ...job,
        viewId: generateSecureId(),
        postedAgo: RecommendationUtils.formatTimeAgo(job.postedAt),
        trending: job.trendingScore > 0.6,
        urgency: job.urgencyScore,
        freshness: job.freshnessScore
      })),
      pagination: {
        nextCursor: result.nextCursor,
        totalJobs: result.totalCount
      },
      analytics: {
        totalPostedToday: result.todayCount,
        totalPostedThisWeek: result.weekCount,
        growthRate: result.growthRate,
        avgTimeToFill: result.avgTimeToFill
      },
      trending: {
        hotCompanies: result.topCompanies,
        popularLocations: result.topLocations,
        demandingSkills: result.topSkills,
        emergingRoles: result.emergingRoles
      },
      realTimeStats: {
        activeViewers: await redisClient.get(`active_viewers:recent_jobs`) || 0,
        recentActivity: result.recentActivity,
        lastUpdated: new Date().toISOString()
      },
      requestId
    };

    await redisClient.setex(cacheKey, CACHE_TTL.RECENT_JOBS, JSON.stringify(response));
    JobEventService.trackRecentJobsView({
      requestId,
      filters: sanitizedFilters,
      resultCount: result.totalCount,
      timestamp: new Date()
    });

    logger.info(`[${requestId}] Recent jobs retrieved successfully`, {
      jobCount: response.jobs.length,
      totalCount: result.totalCount,
      processingTime: Date.now() - startTime
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
    );

  } catch (error) {
    logger.error(`[${requestId}] Recent jobs retrieval failed:`, {
      error: error.message,
      processingTime: Date.now() - startTime
    });
    next(error);
  }
};


export const getExpiringSoonJobsController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    const { error } = validatePaginationParams(req.query);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId
      });
    }

    const {
      cursor,
      limit = 30,
      expiringWithin = 3,
      priority = 'all',
      userId,
      notificationPreference = 'all'
    } = req.query;

    const sanitizedParams = {
      expiringWithin: Math.min(parseInt(expiringWithin) || 3, 30),
      priority: sanitizeInput(priority),
      userId: userId ? sanitizeInput(userId) : undefined,
      notificationPreference: sanitizeInput(notificationPreference)
    };

    const cacheKey = `expiring_jobs:${Buffer.from(JSON.stringify({
      cursor, limit, ...sanitizedParams
    })).toString('base64')}`;

    const cachedJobs = await redisClient.get(cacheKey);
    if (cachedJobs && sanitizedParams.priority !== 'high') {
      const parsedJobs = JSON.parse(cachedJobs);
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...parsedJobs,
          cached: true,
          requestId
        })
      );
    }

    const result = await withRetry(() => MatchingService.getExpiringSoonJobs({
      pagination: { cursor, limit: parseInt(limit) },
      filters: sanitizedParams,
      userId: sanitizedParams.userId,
      options: {
        includePriorityScore: true,
        includeNotificationStatus: true,
        includeApplicationDeadline: true
      }
    }));

    const response = {
      jobs: result.jobs.map(job => ({
        ...job,
        viewId: generateSecureId(),
        timeRemaining: RecommendationUtils.formatTimeRemaining(job.expiresAt),
        priorityLevel: job.priorityScore > 0.8 ? 'high' : job.priorityScore > 0.5 ? 'medium' : 'low',
        actionRequired: job.timeToExpiry < 24 * 60 * 60 * 1000,
        notificationSent: job.notificationStatus?.sent || false
      })),
      pagination: {
        nextCursor: result.nextCursor,
        totalJobs: result.totalCount
      },
      urgencyMetrics: {
        expiringToday: result.expiringToday,
        expiringTomorrow: result.expiringTomorrow,
        expiringThisWeek: result.expiringThisWeek,
        highPriorityCount: result.highPriorityCount,
        criticalAlerts: result.criticalAlerts
      },
      notifications: {
        eligibleForNotification: result.notificationEligible,
        nextNotificationBatch: result.nextNotificationTime,
        userPreferences: result.userNotificationPrefs
      },
      requestId
    };

    const cacheTTL = sanitizedParams.expiringWithin <= 1 ? CACHE_TTL.EXPIRING_JOBS / 2 : CACHE_TTL.EXPIRING_JOBS;
    await redisClient.setex(cacheKey, cacheTTL, JSON.stringify(response));

    if (response.urgencyMetrics.criticalAlerts > 0) {
      setImmediate(() => JobEventService.scheduleExpirationNotifications(result.criticalJobs));
    }

    logger.info(`[${requestId}] Expiring jobs retrieved`, {
      totalJobs: result.totalCount,
      criticalAlerts: response.urgencyMetrics.criticalAlerts,
      processingTime: Date.now() - startTime
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
    );

  } catch (error) {
    logger.error(`[${requestId}] Expiring jobs retrieval failed:`, error);
    next(error);
  }
};

export const sendInvitationToApplyController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Invitation request started`, {
      jobId: req.params.jobId,
      userId: req.body.userId,
    });

    const { error: profileError } = validateUserProfile(req.body);
    if (profileError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: profileError.message,
        requestId,
      });
    }

    const { error: paramsError } = validateMatchingParams(req.params);
    if (paramsError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: paramsError.message,
        requestId,
      });
    }

    const { jobId } = req.params;
    const { userId, companyId, personalizedMessage, deliveryChannels = ["email", "sms", "in-app"] } = req.body;

    const sanitizedData = {
      jobId: sanitizeInput(jobId),
      userId: sanitizeInput(userId),
      companyId: sanitizeInput(companyId),
      personalizedMessage: personalizedMessage ? sanitizeInput(personalizedMessage) : undefined,
      deliveryChannels: deliveryChannels.map((ch) => sanitizeInput(ch)),
    };

    // Generate personalized message with Gemini AI if not provided
    let finalMessage = sanitizedData.personalizedMessage;
    if (!finalMessage) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Generate a personalized job invitation message (100-150 words) for user ${sanitizedData.userId} for job ${sanitizedData.jobId} at company ${sanitizedData.companyId}. Include a professional tone and highlight job fit.`;
      const result = await model.generateContent(prompt);
      finalMessage = result.response.text();
    }

    const invitationKey = `invitation:${sanitizedData.userId}:${sanitizedData.jobId}`;
    const dailyInvitationKey = `daily_invitations:${sanitizedData.companyId}:${new Date().toDateString()}`;
    const userInvitationKey = `user_invitations:${sanitizedData.userId}:${new Date().toDateString()}`;

    const result = await withLock(invitationKey, 5000, async () => {
      const [recentInvitation, dailyCount, userDailyCount] = await redisClient.multi()
        .get(invitationKey)
        .get(dailyInvitationKey)
        .get(userInvitationKey)
        .exec();

      if (recentInvitation) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Invitation already sent recently", {
          requestId,
          retryAfter: JSON.parse(recentInvitation).expiresAt,
        });
      }

      const currentDailyCount = parseInt(dailyCount) || 0;
      const currentUserDailyCount = parseInt(userDailyCount) || 0;
      const dailyLimit = await MatchingService.getCompanyInvitationLimit(sanitizedData.companyId);

      if (currentDailyCount >= dailyLimit) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Company daily invitation limit exceeded", {
          requestId,
          dailyLimit,
          currentCount: currentDailyCount,
        });
      }

      if (currentUserDailyCount >= RATE_LIMITS.INVITATIONS_PER_USER.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "User daily invitation limit exceeded", {
          requestId,
          userDailyLimit: RATE_LIMITS.INVITATIONS_PER_USER.max,
          currentCount: currentUserDailyCount,
        });
      }

      const [job, company] = await Promise.all([
        Job.findOne({ jobId: sanitizedData.jobId, isDeleted: false }),
        Company.findOne({ companyId: sanitizedData.companyId, isDeleted: false }),
      ]);

      if (!job) throw new CustomError(HTTP_STATUS.NOT_FOUND, "Job not found", { requestId });
      if (!company) throw new CustomError(HTTP_STATUS.NOT_FOUND, "Company not found", { requestId });

      let matchScore = req.body.matchScore;
      if (!matchScore) {
        const matchResult = await withRetry(() => MatchingService.calculateMatchScore(req.body, { jobId: sanitizedData.jobId }));
        matchScore = matchResult.matchScore;
      }

      const invitationData = {
        invitationId: generateSecureId(),
        userProfile: req.body,
        jobId: sanitizedData.jobId,
        companyId: sanitizedData.companyId,
        matchScore,
        personalizedMessage: finalMessage,
        deliveryChannels: sanitizedData.deliveryChannels,
        metadata: {
          timestamp: Date.now(),
          source: req.headers["x-source"] || "employer_dashboard",
          requestId,
          userAgent: req.headers["user-agent"],
          ipAddress: req.ip,
        },
      };

      const invitationResult = await MatchingService.sendInvitationToApply(invitationData);

      await Promise.all([
        Company.updateOne(
          { companyId: sanitizedData.companyId },
          { $push: { invitations: invitationData.invitationId } }
        ),
        Job.updateOne(
          { jobId: sanitizedData.jobId },
          { $push: { invitations: invitationData.invitationId } }
        ),
        redisClient.multi()
          .setex(invitationKey, 24 * 60 * 60, JSON.stringify({
            sentAt: Date.now(),
            jobId: sanitizedData.jobId,
            companyId: sanitizedData.companyId,
            invitationId: invitationResult.invitationId,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          }))
          .incr(dailyInvitationKey)
          .expire(dailyInvitationKey, 24 * 60 * 60)
          .incr(userInvitationKey)
          .expire(userInvitationKey, 24 * 60 * 60)
          .exec(),
      ]);

      return invitationResult;
    });

    const response = {
      invitationId: result.invitationId,
      status: result.status,
      sentAt: result.sentAt,
      deliveryMethods: result.deliveryMethods,
      estimatedDelivery: result.estimatedDelivery,
      matchScore,
      personalizedMessage: finalMessage,
      trackingPixel: result.trackingPixel,
      analytics: {
        deliveryConfirmation: result.deliveryConfirmation,
        openTracking: result.openTracking,
        clickTracking: result.clickTracking,
      },
      requestId,
      processingTime: Date.now() - startTime,
    };

    setImmediate(async () => {
      try {
        await UserActivity.create({
          activityId: generateSecureId(),
          userId: sanitizedData.userId,
          activityType: "INVITATION_SENT",
          metadata: {
            jobId: sanitizedData.jobId,
            companyId: sanitizedData.companyId,
            invitationId: result.invitationId,
            matchScore,
            deliveryChannels: sanitizedData.deliveryChannels,
            requestId,
          },
          timestamp: new Date(),
        });

        await CompanyEventService.emit("analytics:invitation_sent", {
          companyId: sanitizedData.companyId,
          userId: sanitizedData.userId,
          jobId: sanitizedData.jobId,
          invitationId: result.invitationId,
          matchScore,
          requestId,
        });

        await JobEventService.trackInvitationSent({
          jobId: sanitizedData.jobId,
          userId: sanitizedData.userId,
          invitationId: result.invitationId,
          matchScore,
          deliveryChannels: sanitizedData.deliveryChannels,
          requestId,
        });

        await SearchStatsService.recordInvitationSent(sanitizedData.userId, sanitizedData.jobId, matchScore);

        const analyticsCacheKey = `invitation_analytics:${sanitizedData.companyId}:${new Date().toDateString()}`;
        await redisClient.setex(analyticsCacheKey, CACHE_TTL.INVITATION_ANALYTICS, JSON.stringify({
          invitationCount: parseInt(await redisClient.get(dailyInvitationKey)) || 1,
          matchScore,
          jobId: sanitizedData.jobId,
          userId: sanitizedData.userId,
          timestamp: new Date(),
        }));
      } catch (bgError) {
        logger.error(`[${requestId}] Background invitation processing failed:`, bgError);
      }
    });

    logger.info(`[${requestId}] Invitation sent successfully`, {
      invitationId: result.invitationId,
      userId: sanitizedData.userId,
      jobId: sanitizedData.jobId,
      companyId: sanitizedData.companyId,
      matchScore,
      deliveryChannels: sanitizedData.deliveryChannels,
      processingTime: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, response)
    );
  } catch (error) {
    logger.error(`[${requestId}] Invitation sending failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      jobId: req.params?.jobId,
      companyId: req.body?.companyId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};

/**
 * Send or retrieve in-app messages between users and recruiters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const inAppMessagingController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] In-app messaging request started`, {
      userId: req.body.userId,
      recruiterId: req.body.recruiterId,
      method: req.method,
    });

    const { userId, recruiterId, message, jobId, conversationId } = req.body;
    const { cursor, limit = 20 } = req.query;

    const { error: messageError } = validateMessageInput(req.body);
    if (messageError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: messageError.message,
        requestId,
      });
    }

    const sanitizedData = {
      userId: sanitizeInput(userId),
      recruiterId: sanitizeInput(recruiterId),
      message: message ? sanitizeInput(message) : undefined,
      jobId: jobId ? sanitizeInput(jobId) : undefined,
      conversationId: conversationId ? sanitizeInput(conversationId) : generateSecureId(),
    };

    if (req.method === "POST") {
      const messageKey = `message:${sanitizedData.conversationId}:${sanitizedData.userId}`;
      return await withLock(messageKey, 5000, async () => {
        const messageCount = await redisClient.get(`message_count:${sanitizedData.userId}:${new Date().toDateString()}`);
        if (parseInt(messageCount) >= RATE_LIMITS.MESSAGES.max) {
          throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Message limit exceeded", {
            requestId,
            limit: RATE_LIMITS.MESSAGES.max,
          });
        }

        const messageData = {
          messageId: generateSecureId(),
          conversationId: sanitizedData.conversationId,
          senderId: sanitizedData.userId,
          receiverId: sanitizedData.recruiterId,
          jobId: sanitizedData.jobId,
          content: sanitizedData.message,
          timestamp: new Date(),
          status: "sent",
          metadata: { requestId },
        };

        await MatchingService.sendInAppMessage(messageData);

        await redisClient.multi()
          .incr(`message_count:${sanitizedData.userId}:${new Date().toDateString()}`)
          .expire(`message_count:${sanitizedData.userId}:${new Date().toDateString()}`, 24 * 60 * 60)
          .exec();

        setImmediate(async () => {
          try {
            await UserActivity.create({
              activityId: generateSecureId(),
              userId: sanitizedData.userId,
              activityType: "IN_APP_MESSAGE_SENT",
              metadata: {
                conversationId: sanitizedData.conversationId,
                jobId: sanitizedData.jobId,
                recruiterId: sanitizedData.recruiterId,
                messageId: messageData.messageId,
                requestId,
              },
              timestamp: new Date(),
            });
            await JobEventService.trackMessageSent({
              jobId: sanitizedData.jobId,
              userId: sanitizedData.userId,
              messageId: messageData.messageId,
              requestId,
            });
          } catch (bgError) {
            logger.error(`[${requestId}] Background message analytics failed:`, bgError);
          }
        });

        logger.info(`[${requestId}] In-app message sent successfully`, {
          conversationId: sanitizedData.conversationId,
          messageId: messageData.messageId,
          processingTime: Date.now() - startTime,
        });

        return res.status(HTTP_STATUS.CREATED).json(
          new CustomSuccess(HTTP_STATUS.CREATED, "Message sent successfully", {
            messageId: messageData.messageId,
            conversationId: sanitizedData.conversationId,
            timestamp: messageData.timestamp,
            requestId,
            processingTime: Date.now() - startTime,
          })
        );
      });
    } else {
      const { error: paginationError } = validatePaginationParams(req.query);
      if (paginationError) {
        throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
          details: paginationError.message,
          requestId,
        });
      }

      const cacheKey = `messages:${sanitizedData.conversationId}:${cursor || "0"}:${limit}`;
      const cachedMessages = await redisClient.get(cacheKey);
      if (cachedMessages) {
        const parsedMessages = JSON.parse(cachedMessages);
        return res.status(HTTP_STATUS.OK).json(
          new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
            ...parsedMessages,
            cached: true,
            requestId,
            processingTime: Date.now() - startTime,
          })
        );
      }

      const messages = await MatchingService.getConversationMessages({
        conversationId: sanitizedData.conversationId,
        pagination: { cursor: parseInt(cursor || 0), limit: parseInt(limit) },
      });

      const response = {
        conversationId: sanitizedData.conversationId,
        messages: messages.items,
        pagination: {
          nextCursor: messages.nextCursor,
          totalMessages: messages.totalCount,
          limit: parseInt(limit),
        },
        requestId,
        processingTime: Date.now() - startTime,
      };

      await redisClient.setex(cacheKey, CACHE_TTL.MESSAGES, JSON.stringify(response));

      logger.info(`[${requestId}] Messages retrieved successfully`, {
        conversationId: sanitizedData.conversationId,
        messageCount: messages.items.length,
        processingTime: Date.now() - startTime,
      });

      res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
      );
    }
  } catch (error) {
    logger.error(`[${requestId}] In-app messaging failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};

/**
 * Schedule an interview with calendar integration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const interviewSchedulingController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Interview scheduling request started`, {
      jobId: req.params.jobId,
      userId: req.body.userId,
    });

    const { error: scheduleError } = validateInterviewSchedule(req.body);
    if (scheduleError) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: scheduleError.message,
        requestId,
      });
    }

    const { jobId } = req.params;
    const { userId, companyId, recruiterId, proposedTimes, interviewType, duration } = req.body;

    const sanitizedData = {
      jobId: sanitizeInput(jobId),
      userId: sanitizeInput(userId),
      companyId: sanitizeInput(companyId),
      recruiterId: sanitizeInput(recruiterId),
      proposedTimes: proposedTimes.map((t) => ({
        start: new Date(sanitizeInput(t.start)),
        end: new Date(sanitizeInput(t.end)),
      })),
      interviewType: sanitizeInput(interviewType),
      duration: parseInt(duration),
    };

    const scheduleKey = `interview_schedule:${sanitizedData.userId}:${sanitizedData.jobId}`;
    return await withLock(scheduleKey, 5000, async () => {
      const scheduleCount = await redisClient.get(`schedule_count:${sanitizedData.userId}:${new Date().toDateString()}`);
      if (parseInt(scheduleCount) >= RATE_LIMITS.INTERVIEW_SCHEDULE.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Interview schedule limit exceeded", {
          requestId,
          limit: RATE_LIMITS.INTERVIEW_SCHEDULE.max,
        });
      }

      const [job, company] = await Promise.all([
        Job.findOne({ jobId: sanitizedData.jobId, isDeleted: false }),
        Company.findOne({ companyId: sanitizedData.companyId, isDeleted: false }),
      ]);

      if (!job) throw new CustomError(HTTP_STATUS.NOT_FOUND, "Job not found", { requestId });
      if (!company) throw new CustomError(HTTP_STATUS.NOT_FOUND, "Company not found", { requestId });

      const scheduleData = {
        scheduleId: generateSecureId(),
        jobId: sanitizedData.jobId,
        userId: sanitizedData.userId,
        companyId: sanitizedData.companyId,
        recruiterId: sanitizedData.recruiterId,
        proposedTimes: sanitizedData.proposedTimes,
        interviewType: sanitizedData.interviewType,
        duration: sanitizedData.duration,
        status: "pending",
        metadata: {
          timestamp: Date.now(),
          requestId,
          userAgent: req.headers["user-agent"],
          ipAddress: req.ip,
        },
      };

      const scheduleResult = await MatchingService.scheduleInterview(scheduleData);

      await redisClient.multi()
        .setex(scheduleKey, 24 * 60 * 60, JSON.stringify({
          scheduleId: scheduleResult.scheduleId,
          scheduledAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
        .incr(`schedule_count:${sanitizedData.userId}:${new Date().toDateString()}`)
        .expire(`schedule_count:${sanitizedData.userId}:${new Date().toDateString()}`, 24 * 60 * 60)
        .exec();

      setImmediate(async () => {
        try {
          await UserActivity.create({
            activityId: generateSecureId(),
            userId: sanitizedData.userId,
            activityType: "INTERVIEW_SCHEDULED",
            metadata: {
              jobId: sanitizedData.jobId,
              companyId: sanitizedData.companyId,
              scheduleId: scheduleResult.scheduleId,
              interviewType: sanitizedData.interviewType,
              requestId,
            },
            timestamp: new Date(),
          });
          await JobEventService.trackInterviewScheduled({
            jobId: sanitizedData.jobId,
            userId: sanitizedData.userId,
            scheduleId: scheduleResult.scheduleId,
            requestId,
          });
        } catch (bgError) {
          logger.error(`[${requestId}] Background interview schedule analytics failed:`, bgError);
        }
      });

      logger.info(`[${requestId}] Interview scheduled successfully`, {
        scheduleId: scheduleResult.scheduleId,
        userId: sanitizedData.userId,
        jobId: sanitizedData.jobId,
        processingTime: Date.now() - startTime,
      });

      res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess(HTTP_STATUS.CREATED, "Interview scheduled successfully", {
          scheduleId: scheduleResult.scheduleId,
          jobId: sanitizedData.jobId,
          proposedTimes: sanitizedData.proposedTimes,
          interviewType: sanitizedData.interviewType,
          status: scheduleResult.status,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Interview scheduling failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      jobId: req.params?.jobId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};

/**
 * Initiate recruiter contact
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const recruiterContactController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Recruiter contact request started`, {
      userId: req.body.userId,
      recruiterId: req.body.recruiterId,
    });

    const { error } = validateRecruiterContact(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId,
      });
    }

    const { userId, recruiterId, jobId, message } = req.body;
    const sanitizedData = {
      userId: sanitizeInput(userId),
      recruiterId: sanitizeInput(recruiterId),
      jobId: jobId ? sanitizeInput(jobId) : undefined,
      message: sanitizeInput(message),
    };

    const contactKey = `recruiter_contact:${sanitizedData.userId}:${sanitizedData.recruiterId}`;
    return await withLock(contactKey, 5000, async () => {
      const contactCount = await redisClient.get(`contact_count:${sanitizedData.userId}:${new Date().toDateString()}`);
      if (parseInt(contactCount) >= RATE_LIMITS.RECRUITER_CONTACT.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Recruiter contact limit exceeded", {
          requestId,
          limit: RATE_LIMITS.RECRUITER_CONTACT.max,
        });
      }

      const contactData = {
        contactId: generateSecureId(),
        userId: sanitizedData.userId,
        recruiterId: sanitizedData.recruiterId,
        jobId: sanitizedData.jobId,
        message: sanitizedData.message,
        timestamp: new Date(),
        status: "initiated",
        metadata: {
          timestamp: Date.now(),
          requestId,
          userAgent: req.headers["user-agent"],
          ipAddress: req.ip,
        },
      };

      const contactResult = await MatchingService.initiateRecruiterContact(contactData);

      await redisClient.multi()
        .setex(contactKey, 24 * 60 * 60, JSON.stringify({
          contactId: contactResult.contactId,
          initiatedAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
        .incr(`contact_count:${sanitizedData.userId}:${new Date().toDateString()}`)
        .expire(`contact_count:${sanitizedData.userId}:${new Date().toDateString()}`, 24 * 60 * 60)
        .exec();

      setImmediate(async () => {
        try {
          await UserActivity.create({
            activityId: generateSecureId(),
            userId: sanitizedData.userId,
            activityType: "RECRUITER_CONTACT_INITIATED",
            metadata: {
              recruiterId: sanitizedData.recruiterId,
              jobId: sanitizedData.jobId,
              contactId: contactResult.contactId,
              requestId,
            },
            timestamp: new Date(),
          });
          await JobEventService.trackRecruiterContact({
            jobId: sanitizedData.jobId,
            userId: sanitizedData.userId,
            contactId: contactResult.contactId,
            requestId,
          });
        } catch (bgError) {
          logger.error(`[${requestId}] Background recruiter contact analytics failed:`, bgError);
        }
      });

      logger.info(`[${requestId}] Recruiter contact initiated successfully`, {
        contactId: contactResult.contactId,
        userId: sanitizedData.userId,
        recruiterId: sanitizedData.recruiterId,
        processingTime: Date.now() - startTime,
      });

      res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess(HTTP_STATUS.CREATED, "Recruiter contact initiated successfully", {
          contactId: contactResult.contactId,
          userId: sanitizedData.userId,
          recruiterId: sanitizedData.recruiterId,
          jobId: sanitizedData.jobId,
          status: contactResult.status,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Recruiter contact failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      recruiterId: req.body?.recruiterId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};

/**
 * Confirm an interview schedule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const interviewConfirmationController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();

  try {
    logger.info(`[${requestId}] Interview confirmation request started`, {
      scheduleId: req.params.scheduleId,
      userId: req.body.userId,
    });

    const { scheduleId } = req.params;
    const { userId, confirmedTime, notes } = req.body;

    const { error } = validateInterviewSchedule({ ...req.body, scheduleId });
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.VALIDATION_ERROR, {
        details: error.message,
        requestId,
      });
    }

    const sanitizedData = {
      scheduleId: sanitizeInput(scheduleId),
      userId: sanitizeInput(userId),
      confirmedTime: new Date(sanitizeInput(confirmedTime)),
      notes: notes ? sanitizeInput(notes) : undefined,
    };

    const confirmationKey = `interview_confirmation:${sanitizedData.scheduleId}:${sanitizedData.userId}`;
    return await withLock(confirmationKey, 5000, async () => {
      const existingConfirmation = await redisClient.get(confirmationKey);
      if (existingConfirmation) {
        throw new CustomError(HTTP_STATUS.BAD_REQUEST, "Interview already confirmed", {
          requestId,
          confirmationId: JSON.parse(existingConfirmation).confirmationId,
        });
      }

      const schedule = await MatchingService.getInterviewSchedule(sanitizedData.scheduleId);
      if (!schedule) {
        throw new CustomError(HTTP_STATUS.NOT_FOUND, "Interview schedule not found", { requestId });
      }

      const confirmationData = {
        confirmationId: generateSecureId(),
        scheduleId: sanitizedData.scheduleId,
        userId: sanitizedData.userId,
        jobId: schedule.jobId,
        companyId: schedule.companyId,
        confirmedTime: sanitizedData.confirmedTime,
        notes: sanitizedData.notes,
        status: "confirmed",
        metadata: {
          timestamp: Date.now(),
          requestId,
          userAgent: req.headers["user-agent"],
          ipAddress: req.ip,
        },
      };

      const confirmationResult = await MatchingService.confirmInterview(confirmationData);

      await redisClient.setex(confirmationKey, 24 * 60 * 60, JSON.stringify({
        confirmationId: confirmationResult.confirmationId,
        confirmedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }));

      setImmediate(async () => {
        try {
          await UserActivity.create({
            activityId: generateSecureId(),
            userId: sanitizedData.userId,
            activityType: "INTERVIEW_CONFIRMED",
            metadata: {
              scheduleId: sanitizedData.scheduleId,
              jobId: schedule.jobId,
              confirmationId: confirmationResult.confirmationId,
              requestId,
            },
            timestamp: new Date(),
          });
          await JobEventService.trackInterviewConfirmed({
            jobId: schedule.jobId,
            userId: sanitizedData.userId,
            confirmationId: confirmationResult.confirmationId,
            requestId,
          });
        } catch (bgError) {
          logger.error(`[${requestId}] Background interview confirmation analytics failed:`, bgError);
        }
      });

      logger.info(`[${requestId}] Interview confirmed successfully`, {
        confirmationId: confirmationResult.confirmationId,
        scheduleId: sanitizedData.scheduleId,
        userId: sanitizedData.userId,
        processingTime: Date.now() - startTime,
      });

      res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, "Interview confirmed successfully", {
          confirmationId: confirmationResult.confirmationId,
          scheduleId: sanitizedData.scheduleId,
          confirmedTime: sanitizedData.confirmedTime,
          status: confirmationResult.status,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Interview confirmation failed:`, {
      error: error.message,
      stack: error.stack,
      userId: req.body?.userId,
      scheduleId: req.params?.scheduleId,
      processingTime: Date.now() - startTime,
    });
    next(error);
  }
};