import { v4 as uuidv4 } from "uuid";
import * as aiService  from "../services/ai.services.js";
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../constants/http.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import logger from "../utils/logger.js";
import {
  validateResumeOptimization,
  validateJobMatching,
  validateJobAnalysis,
  validateOpenToWork,
  validateFeaturedApplicant,
  validateDirectMessage,
  validateTopApplicantJobs,
  validateCompanyVerification,
  validateSalaryVerification,
  validateApplicationDuplicate,
} from "../validations/ai.validations.js";
import redisClient from "../config/redis.js";
import { sanitizeInput } from "../utils/security.js";
import {ai_requestCounter, ai_requestLatency} from "../utils/metrics.js";
import {CACHE_TTL} from "../config/cache.ttl.js";
import RATE_LIMITS from "../config/rate.limiter.js";
import {withLock} from "../utils/withLocks.js";


// AI Resume Optimization Controller
export const optimizeResumeController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "optimize_resume";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateResumeOptimization(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { userId, resumeData, targetJobId } = value;
    const sanitizedData = {
      userId: sanitizeInput(userId),
      resumeData: sanitizeInput(JSON.stringify(resumeData)),
      targetJobId: sanitizeInput(targetJobId),
    };

    const cacheKey = `resume_optimization:${sanitizedData.userId}:${sanitizedData.targetJobId}`;
    const rateLimitKey = `rate:resume:${sanitizedData.userId}`;
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      logger.info(`[${requestId}] Resume optimization cache hit`, { userId, targetJobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
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

    return await withLock(`resume:${sanitizedData.userId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.RESUME_OPTIMIZATION.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Resume optimization limit exceeded", { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.RESUME_OPTIMIZATION.windowMs / 1000);

      const optimizedResume = await aiService.optimizeResume({
        userId: sanitizedData.userId,
        resumeData: sanitizedData.resumeData,
        targetJobId: sanitizedData.targetJobId,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.RESUME_OPTIMIZATION, JSON.stringify(optimizedResume));

      logger.info(`[${requestId}] Resume optimized successfully`, {
        userId: sanitizedData.userId,
        targetJobId: sanitizedData.targetJobId,
        duration: Date.now() - startTime,
      });

      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
          ...optimizedResume,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Resume optimization failed: ${error.message}`, {
      userId: req.body?.userId,
      targetJobId: req.body?.targetJobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// AI Job Matching Controller
export const getJobMatchesController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "job_matches";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobMatching(req.query);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const userId = sanitizeInput(req.user.id);
    const preferences = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeInput(v)])
    );
    const cacheKey = `job_matches:${userId}:${JSON.stringify(preferences)}`;
    const rateLimitKey = `rate:matches:${userId}`;
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      logger.info(`[${requestId}] Job matches cache hit`, { userId });
      ai_requestCounter.inc({ endpoint, status: "success" });
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

    return await withLock(`matches:${userId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.JOB_MATCHING.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Job matching limit exceeded", { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.JOB_MATCHING.windowMs / 1000);

      const matches = await aiService.getJobMatches({
        userId,
        preferences,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.JOB_MATCHES, JSON.stringify(matches));

      logger.info(`[${requestId}] Job matches retrieved successfully`, {
        userId,
        matchCount: matches.jobs.length,
        duration: Date.now() - startTime,
      });

      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...matches,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Job matching failed: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// AI Job Description Analysis Controller
export const analyzeJobDescriptionController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "job_analysis";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobAnalysis(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId, description } = value;
    const sanitizedData = {
      jobId: sanitizeInput(jobId),
      description: sanitizeInput(description),
    };
    const cacheKey = `job_analysis:${sanitizedData.jobId}`;
    const rateLimitKey = `rate:analysis:${req.user.id}`;
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      logger.info(`[${requestId}] Job analysis cache hit`, { jobId: sanitizedData.jobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
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

    return await withLock(`analysis:${sanitizedData.jobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.JOB_ANALYSIS.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Job analysis limit exceeded", { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.JOB_ANALYSIS.windowMs / 1000);

      const analysis = await aiService.analyzeJobDescription({
        jobId: sanitizedData.jobId,
        description: sanitizedData.description,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(analysis));

      logger.info(`[${requestId}] Job description analyzed successfully`, {
        jobId: sanitizedData.jobId,
        duration: Date.now() - startTime,
      });

      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
          ...analysis,
          requestId,
          processingTime: Date.now() - startTime,
        })
      );
    });
  } catch (error) {
    logger.error(`[${requestId}] Job analysis failed: ${error.message}`, {
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Open to Work Badge Controller
export const updateOpenToWorkController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "open_to_work";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateOpenToWork(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { isOpenToWork, preferences } = value;
    const userId = sanitizeInput(req.user.id);

    const result = await aiService.updateOpenToWorkStatus({
      userId,
      isOpenToWork,
      preferences: Object.fromEntries(
        Object.entries(preferences || {}).map(([k, v]) => [k, sanitizeInput(v)])
      ),
      requestId,
    });

    logger.info(`[${requestId}] Open to work status updated`, {
      userId,
      isOpenToWork,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
        ...result,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Open to work update failed: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Featured Applicant Controller
export const setFeaturedApplicantController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "featured_applicant";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.canManageApplications) {
      throw new CustomError(HTTP_STATUS.FORBIDDEN, "Insufficient permissions to set featured applicant", { requestId });
    }

    const { error, value } = validateFeaturedApplicant(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { applicationId, jobId } = value;
    const sanitizedData = {
      applicationId: sanitizeInput(applicationId),
      jobId: sanitizeInput(jobId),
      companyId: sanitizeInput(req.user.companyId),
    };

    const result = await aiService.setFeaturedApplicant({
      applicationId: sanitizedData.applicationId,
      jobId: sanitizedData.jobId,
      companyId: sanitizedData.companyId,
      requestId,
    });

    logger.info(`[${requestId}] Featured applicant set successfully`, {
      applicationId: sanitizedData.applicationId,
      jobId: sanitizedData.jobId,
      companyId: sanitizedData.companyId,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
        ...result,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Set featured applicant failed: ${error.message}`, {
      applicationId: req.body?.applicationId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Direct Recruiter Messaging Controller
export const sendDirectMessageController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "direct_message";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || (!req.user.isRecruiter && !req.user.canMessage)) {
      throw new CustomError(HTTP_STATUS.FORBIDDEN, "Insufficient permissions to send direct messages", { requestId });
    }

    const { error, value } = validateDirectMessage(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { recipientId, message, jobId } = value;
    const sanitizedData = {
      senderId: sanitizeInput(req.user.id),
      recipientId: sanitizeInput(recipientId),
      message: sanitizeInput(message),
      jobId: jobId ? sanitizeInput(jobId) : undefined,
    };

    const result = await aiService.sendDirectMessage({
      senderId: sanitizedData.senderId,
      recipientId: sanitizedData.recipientId,
      message: sanitizedData.message,
      jobId: sanitizedData.jobId,
      requestId,
    });

    logger.info(`[${requestId}] Direct message sent successfully`, {
      senderId: sanitizedData.senderId,
      recipientId: sanitizedData.recipientId,
      jobId: sanitizedData.jobId,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess(HTTP_STATUS.CREATED, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, {
        ...result,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Direct message failed: ${error.message}`, {
      senderId: req.user?.id,
      recipientId: req.body?.recipientId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Top Applicant Jobs Controller
export const getTopApplicantJobsController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "top_applicant_jobs";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateTopApplicantJobs(req.query);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const userId = sanitizeInput(req.user.id);
    const { limit = 10, cursor } = value;
    const cacheKey = `top_applicant_jobs:${userId}:${cursor || "0"}:${limit}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Top applicant jobs cache hit`, { userId });
      ai_requestCounter.inc({ endpoint, status: "success" });
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

    const jobs = await aiService.getTopApplicantJobs({
      userId,
      pagination: { limit: parseInt(limit), cursor: parseInt(cursor || 0) },
      requestId,
    });

    const response = {
      jobs: jobs.items,
      pagination: {
        nextCursor: jobs.nextCursor,
        totalJobs: jobs.totalCount,
        limit: parseInt(limit),
      },
      requestId,
      processingTime: Date.now() - startTime,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.TOP_APPLICANT_JOBS, JSON.stringify(response));

    logger.info(`[${requestId}] Top applicant jobs retrieved successfully`, {
      userId,
      jobCount: jobs.items.length,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response)
    );
  } catch (error) {
    logger.error(`[${requestId}] Top applicant jobs failed: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Company Verification Controller
export const verifyCompanyController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "company_verification";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.canVerifyCompanies) {
      throw new CustomError(HTTP_STATUS.FORBIDDEN, "Insufficient permissions to verify company", { requestId });
    }

    const { error, value } = validateCompanyVerification(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { companyId, verificationData } = value;
    const sanitizedData = {
      companyId: sanitizeInput(companyId),
      verificationData: Object.fromEntries(
        Object.entries(verificationData).map(([k, v]) => [k, sanitizeInput(v)])
      ),
    };

    const cacheKey = `company_verification:${sanitizedData.companyId}`;
    const rateLimitKey = `rate:verify_company:${req.user.id}`;

    return await withLock(`verify_company:${sanitizedData.companyId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.COMPANY_VERIFICATION.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Company verification limit exceeded", { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.COMPANY_VERIFICATION.windowMs / 1000);

      const result = await aiService.verifyCompany({
        companyId: sanitizedData.companyId,
        verificationData: sanitizedData.verificationData,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.COMPANY_VERIFICATION, JSON.stringify(result));

      logger.info(`[${requestId}] Company verified successfully`, {
        companyId: sanitizedData.companyId,
        duration: Date.now() - startTime,
      });

      ai_requestCounter.inc({ endpoint, status: "success" });
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
      companyId: req.body?.companyId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Salary Verification Controller
export const verifySalaryController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "salary_verification";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.canVerifyJobs) {
      throw new CustomError(HTTP_STATUS.FORBIDDEN, "Insufficient permissions to verify salary", { requestId });
    }

    const { error, value } = validateSalaryVerification(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId, salaryData } = value;
    const sanitizedData = {
      jobId: sanitizeInput(jobId),
      salaryData: Object.fromEntries(
        Object.entries(salaryData).map(([k, v]) => [k, sanitizeInput(v)])
      ),
    };

    const cacheKey = `salary_verification:${sanitizedData.jobId}`;
    const rateLimitKey = `rate:verify_salary:${req.user.id}`;

    return await withLock(`verify_salary:${sanitizedData.jobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.SALARY_VERIFICATION.max) {
        throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Salary verification limit exceeded", { requestId });
      }
      await redisClient.expire(rateLimitKey, RATE_LIMITS.SALARY_VERIFICATION.windowMs / 1000);

      const result = await aiService.verifySalary({
        jobId: sanitizedData.jobId,
        salaryData: sanitizedData.salaryData,
        requestId,
      });

      await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(result));

      logger.info(`[${requestId}] Salary verified successfully`, {
        jobId: sanitizedData.jobId,
        duration: Date.now() - startTime,
      });

      ai_requestCounter.inc({ endpoint, status: "success" });
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
    logger.error(`[${requestId}] Salary verification failed: ${error.message}`, {
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Application Duplicate Detection Controller
export const detectDuplicateApplicationController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "duplicate_application";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateApplicationDuplicate(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { userId, jobId, applicationData } = value;
    const sanitizedData = {
      userId: sanitizeInput(userId),
      jobId: sanitizeInput(jobId),
      applicationData: sanitizeInput(JSON.stringify(applicationData)),
    };

    const result = await aiService.detectDuplicateApplication({
      userId: sanitizedData.userId,
      jobId: sanitizedData.jobId,
      applicationData: sanitizedData.applicationData,
      requestId,
    });

    logger.info(`[${requestId}] Duplicate application detection completed`, {
      userId: sanitizedData.userId,
      jobId: sanitizedData.jobId,
      isDuplicate: result.isDuplicate,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
        ...result,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Duplicate application detection failed: ${error.message}`, {
      userId: req.body?.userId,
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Job Quality Score Controller
export const calculateJobQualityScoreController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "job_quality_score";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobAnalysis(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId, description } = value;
    const sanitizedData = {
      jobId: sanitizeInput(jobId),
      description: sanitizeInput(description),
    };

    const cacheKey = `job_quality:${sanitizedData.jobId}`;
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      logger.info(`[${requestId}] Job quality score cache hit`, { jobId: sanitizedData.jobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
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

    const result = await aiService.calculateJobQualityScore({
      jobId: sanitizedData.jobId,
      description: sanitizedData.description,
      requestId,
    });

    await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(result));

    logger.info(`[${requestId}] Job quality score calculated successfully`, {
      jobId: sanitizedData.jobId,
      qualityScore: result.qualityScore,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
        ...result,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Job quality score calculation failed: ${error.message}`, {
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

// Spam Job Detection Controller
export const detectSpamJobController = async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const endpoint = "spam_job_detection";

  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobAnalysis(req.body);
    if (error) {
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });
    }

    const { jobId, description } = value;
    const sanitizedData = {
      jobId: sanitizeInput(jobId),
      description: sanitizeInput(description),
    };

    const cacheKey = `spam_detection:${sanitizedData.jobId}`;
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      logger.info(`[${requestId}] Spam job detection cache hit`, { jobId: sanitizedData.jobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
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

    const result = await aiService.detectSpamJob({
      jobId: sanitizedData.jobId,
      description: sanitizedData.description,
      requestId,
    });

    await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(result));

    logger.info(`[${requestId}] Spam job detection completed`, {
      jobId: sanitizedData.jobId,
      isSpam: result.isSpam,
      spamScore: result.spamScore,
      duration: Date.now() - startTime,
    });

    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, {
        ...result,
        requestId,
        processingTime: Date.now() - startTime,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Spam job detection failed: ${error.message}`, {
      jobId: req.body?.jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};