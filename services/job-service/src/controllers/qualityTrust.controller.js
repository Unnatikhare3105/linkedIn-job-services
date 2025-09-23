import { v4 as uuidv4 } from "uuid";
import { qualityTrustService } from "../services/qualityTrust.services.js";
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../constants/messages.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import logger from "../utils/logger.js";
import {
  validateCompanyVerification,
  validateJobSpamCheck,
  validateSalaryVerification,
  validateDuplicateApplication,
  validateJobQuality,
} from "../validations/qualityTrust.validations.js";
import redisClient from "../config/redis.js";
import { generateSecureId, sanitizeInput } from "../utils/security.js";
import { requestCounter, requestLatency } from "../utils/metrics.js";
import { CACHE_TTL } from "../constants/cache.js";
import { RATE_LIMITS } from "../config/rate.limiter.js";
import mongoose from "mongoose";
import { withLock } from "../utils/withLocks.js";

// Verify Company Controller
export const verifyCompanyController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "verify_company";

  try {
    requestCounter.inc({ endpoint, status: "attempt" });
    const latency = requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.isAdmin) {
      throw new CustomError(HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.FORBIDDEN, { requestId });
    }

    const { error, value } = validateCompanyVerification(req.params);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { companyId } = value;
    const sanitizedCompanyId = mongoose.Types.ObjectId(sanitizeInput(companyId));
    const cacheKey = `company_verification:${sanitizedCompanyId}`;
    const rateLimitKey = `rate:verify_company:${req.user.id}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Company verification cache hit`, { companyId: sanitizedCompanyId });
      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...JSON.parse(cachedResult),
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    return await withLock(`verify_company:${sanitizedCompanyId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.COMPANY_VERIFICATION.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS, { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.COMPANY_VERIFICATION.windowMs / 1000);

      const result = await qualityTrustService.verifyCompany({
        companyId: sanitizedCompanyId,
        verifiedBy: mongoose.Types.ObjectId(sanitizeInput(req.user.id)),
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.COMPANY_VERIFICATION, JSON.stringify(result));

      logger.info(`[${requestId}] Company verified successfully`, {
        companyId: sanitizedCompanyId,
        verifiedBy: req.user.id,
        duration: Date.now() - startTime,
      });

      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
          ...result,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Company verification failed: ${error.message}`, {
      companyId: req.params?.companyId,
      verifiedBy: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Check Job Spam Controller
export const checkJobSpamController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "check_job_spam";

  try {
    requestCounter.inc({ endpoint, status: "attempt" });
    const latency = requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobSpamCheck(req.params);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId } = value;
    const sanitizedJobId = mongoose.Types.ObjectId(sanitizeInput(jobId));
    const cacheKey = `job_spam:${sanitizedJobId}`;
    const rateLimitKey = `rate:spam_check:${req.user.id}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Job spam check cache hit`, { jobId: sanitizedJobId });
      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...JSON.parse(cachedResult),
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    return await withLock(`spam_check:${sanitizedJobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.JOB_SPAM.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS, { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.JOB_SPAM.windowMs / 1000);

      const spamCheck = await qualityTrustService.checkJobSpam({
        jobId: sanitizedJobId,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.JOB_SPAM, JSON.stringify(spamCheck));

      logger.info(`[${requestId}] Job spam check completed`, {
        jobId: sanitizedJobId,
        isSpam: spamCheck.isSpam,
        confidence: spamCheck.confidence,
        duration: Date.now() - startTime,
      });

      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...spamCheck,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Job spam check failed: ${error.message}`, {
      jobId: req.params?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Verify Salary Controller
export const verifySalaryController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "verify_salary";

  try {
    requestCounter.inc({ endpoint, status: "attempt" });
    const latency = requestLatency.startTimer({ endpoint });

    const { error, value } = validateSalaryVerification(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId, salaryData } = value;
    const sanitizedData = {
      jobId: mongoose.Types.ObjectId(sanitizeInput(jobId)),
      salaryData: {
        amount: Number(sanitizeInput(salaryData.amount)),
        currency: sanitizeInput(salaryData.currency),
        period: sanitizeInput(salaryData.period),
      },
    };
    const cacheKey = `salary_verification:${sanitizedData.jobId}`;
    const rateLimitKey = `rate:verify_salary:${req.user.id}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Salary verification cache hit`, { jobId: sanitizedData.jobId });
      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...JSON.parse(cachedResult),
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    return await withLock(`verify_salary:${sanitizedData.jobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.SALARY_VERIFICATION.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS, { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.SALARY_VERIFICATION.windowMs / 1000);

      const verification = await qualityTrustService.verifySalary({
        jobId: sanitizedData.jobId,
        salaryData: sanitizedData.salaryData,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.SALARY_VERIFICATION, JSON.stringify(verification));

      logger.info(`[${requestId}] Salary verification completed`, {
        jobId: sanitizedData.jobId,
        isVerified: verification.isVerified,
        duration: Date.now() - startTime,
      });

      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
          ...verification,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Salary verification failed: ${error.message}`, {
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Check Duplicate Application Controller
export const checkDuplicateApplicationController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "duplicate_application";

  try {
    requestCounter.inc({ endpoint, status: "attempt" });
    const latency = requestLatency.startTimer({ endpoint });

    const { error, value } = validateDuplicateApplication(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId } = value;
    const userId = mongoose.Types.ObjectId(sanitizeInput(req.user.id));
    const sanitizedJobId = mongoose.Types.ObjectId(sanitizeInput(jobId));
    const cacheKey = `duplicate_application:${userId}:${sanitizedJobId}`;
    const rateLimitKey = `rate:duplicate_check:${userId}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Duplicate application cache hit`, { userId, jobId: sanitizedJobId });
      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...JSON.parse(cachedResult),
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    return await withLock(`duplicate_check:${userId}:${sanitizedJobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.DUPLICATE_APPLICATION.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS, { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.DUPLICATE_APPLICATION.windowMs / 1000);

      const duplicateCheck = await qualityTrustService.checkDuplicateApplication({
        userId,
        jobId: sanitizedJobId,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.DUPLICATE_APPLICATION, JSON.stringify(duplicateCheck));

      logger.info(`[${requestId}] Duplicate application check completed`, {
        userId,
        jobId: sanitizedJobId,
        isDuplicate: duplicateCheck.isDuplicate,
        duration: Date.now() - startTime,
      });

      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...duplicateCheck,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Duplicate application check failed: ${error.message}`, {
      userId: req.user?.id,
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Calculate Job Quality Controller
export const calculateJobQualityController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "job_quality";

  try {
    requestCounter.inc({ endpoint, status: "attempt" });
    const latency = requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobQuality(req.params);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId } = value;
    const sanitizedJobId = mongoose.Types.ObjectId(sanitizeInput(jobId));
    const cacheKey = `job_quality:${sanitizedJobId}`;
    const rateLimitKey = `rate:job_quality:${req.user.id}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Job quality score cache hit`, { jobId: sanitizedJobId });
      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...JSON.parse(cachedResult),
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    return await withLock(`job_quality:${sanitizedJobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.JOB_QUALITY.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_MESSAGES.TOO_MANY_REQUESTS, { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.JOB_QUALITY.windowMs / 1000);

      const qualityScore = await qualityTrustService.calculateJobQuality({
        jobId: sanitizedJobId,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.JOB_QUALITY, JSON.stringify(qualityScore));

      logger.info(`[${requestId}] Job quality score calculated`, {
        jobId: sanitizedJobId,
        score: qualityScore.score,
        duration: Date.now() - startTime,
      });

      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
          ...qualityScore,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Job quality calculation failed: ${error.message}`, {
      jobId: req.params?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Get Company Verification Status Controller
export const getCompanyVerificationController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "get_company_verification";

  try {
    requestCounter.inc({ endpoint, status: "attempt" });
    const latency = requestLatency.startTimer({ endpoint });

    const { error, value } = validateCompanyVerification(req.params);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { companyId } = value;
    const sanitizedCompanyId = mongoose.Types.ObjectId(sanitizeInput(companyId));
    const cacheKey = `company_verification_status:${sanitizedCompanyId}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Company verification status cache hit`, { companyId: sanitizedCompanyId });
      requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...JSON.parse(cachedResult),
          cached: true,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    }

    const verification = await qualityTrustService.getCompanyVerification({
      companyId: sanitizedCompanyId,
      requestId,
    });

    await redisClient.setex(cacheKey, CACHE_TTL.COMPANY_VERIFICATION, JSON.stringify(verification));

    logger.info(`[${requestId}] Company verification status retrieved`, {
      companyId: sanitizedCompanyId,
      isVerified: verification.isVerified,
      duration: Date.now() - startTime,
    });

    requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
        ...verification,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Get company verification failed: ${error.message}`, {
      companyId: req.params?.companyId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};