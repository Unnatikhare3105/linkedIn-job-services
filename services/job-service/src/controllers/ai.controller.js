import { aiService } from "../services/ai.services.js";
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../constants/messages.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import logger from "../utils/logger.js";
import { generateSecureId } from "../utils/security.js";
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
import { ai_requestCounter, ai_requestLatency } from "../utils/metrics.js";
import { CACHE_TTL } from "../constants/cache.js";
import {RATE_LIMITS} from "../config/rate.limiter.js";
import { withLock } from "../utils/withLocks.js";

export const optimizeResumeController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "optimize_resume";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateResumeOptimization(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { resumeData, targetJobId } = value;
    const userId = sanitizeInput(req.user.id);
    const sanitizedData = { userId, resumeData: sanitizeInput(resumeData), targetJobId: sanitizeInput(targetJobId) };
    const cacheKey = `resume_optimization:${userId}:${targetJobId}`;
    const rateLimitKey = `rate:resume:${userId}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Resume cache hit`, { userId });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...JSON.parse(cachedResult), cached: true, requestId, processingTime: Date.now() - startTime }));
    }

    return await withLock(`resume:${userId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.RESUME_OPTIMIZATION.max) throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Resume optimization limit exceeded", { requestId });
      await redisClient.expire(rateLimitKey, RATE_LIMITS.RESUME_OPTIMIZATION.windowMs / 1000);

      const optimizedResume = await aiService.optimizeResume({ id: userId, resumeData: sanitizedData.resumeData, targetJobId: sanitizedData.targetJobId, requestId }, req);
      await redisClient.setex(cacheKey, CACHE_TTL.RESUME_OPTIMIZATION, JSON.stringify(optimizedResume));

      logger.info(`[${requestId}] Resume optimized`, { userId, targetJobId, duration: Date.now() - startTime });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, { ...optimizedResume, requestId, processingTime: Date.now() - startTime }));
    });
  } catch (error) {
    logger.error(`[${requestId}] Resume optimization failed: ${error.message}`, { userId: req.user?.id, targetJobId: req.body?.targetJobId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const getJobMatchesController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "job_matches";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobMatching(req.query);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const userId = sanitizeInput(req.user.id);
    const preferences = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeInput(v)]));
    const cacheKey = `job_matches:${userId}:${JSON.stringify(preferences).slice(0, 50)}`;
    const rateLimitKey = `rate:matches:${userId}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Job matches cache hit`, { userId });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...JSON.parse(cachedResult), cached: true, requestId, processingTime: Date.now() - startTime }));
    }

    return await withLock(`matches:${userId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.JOB_MATCHING.max) throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Job matching limit exceeded", { requestId });
      await redisClient.expire(rateLimitKey, RATE_LIMITS.JOB_MATCHING.windowMs / 1000);

      const matches = await aiService.getJobMatches({ id: userId, preferences, requestId }, req);
      await redisClient.setex(cacheKey, CACHE_TTL.JOB_MATCHES, JSON.stringify(matches));

      logger.info(`[${requestId}] Job matches retrieved: ${matches.jobs.length}`, { userId, duration: Date.now() - startTime });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...matches, requestId, processingTime: Date.now() - startTime }));
    });
  } catch (error) {
    logger.error(`[${requestId}] Job matching failed: ${error.message}`, { userId: req.user?.id });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const analyzeJobDescriptionController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "job_analysis";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobAnalysis(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { jobId, description } = value;
    const sanitizedData = { jobId: sanitizeInput(jobId), description: sanitizeInput(description) };
    const cacheKey = `job_analysis:${jobId}`;
    const rateLimitKey = `rate:analysis:${req.user.id}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Job analysis cache hit`, { jobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...JSON.parse(cachedResult), cached: true, requestId, processingTime: Date.now() - startTime }));
    }

    return await withLock(`analysis:${jobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.JOB_ANALYSIS.max) throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Job analysis limit exceeded", { requestId });
      await redisClient.expire(rateLimitKey, RATE_LIMITS.JOB_ANALYSIS.windowMs / 1000);

      const analysis = await aiService.analyzeJobDescription({ jobId: sanitizedData.jobId, description: sanitizedData.description, requestId }, req);
      await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(analysis));

      logger.info(`[${requestId}] Job analysis done`, { jobId, duration: Date.now() - startTime });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...analysis, requestId, processingTime: Date.now() - startTime }));
    });
  } catch (error) {
    logger.error(`[${requestId}] Job analysis failed: ${error.message}`, { jobId: req.body?.jobId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const updateOpenToWorkController = async (req, res, next) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const endpoint = "open_to_work";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateOpenToWork(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { isOpenToWork, preferences } = value;
    const userId = sanitizeInput(req.user.id);
    const sanitizedPreferences = Object.fromEntries(Object.entries(preferences || {}).map(([k, v]) => [k, sanitizeInput(v)]));

    const result = await aiService.updateOpenToWorkStatus({ id: userId, isOpenToWork, preferences: sanitizedPreferences, requestId }, req);

    logger.info(`[${requestId}] Open to work updated`, { userId, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, { ...result, requestId, processingTime: Date.now() - startTime }));
  } catch (error) {
    logger.error(`[${requestId}] Open to work failed: ${error.message}`, { userId: req.user?.id });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const setFeaturedApplicantController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "featured_applicant";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.canManageJobs) throw new CustomError(HTTP_STATUS.FORBIDDEN, "Unauthorized", { requestId });

    const { error, value } = validateFeaturedApplicant(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { applicationId, jobId } = value;
    const sanitizedData = { applicationId: sanitizeInput(applicationId), jobId: sanitizeInput(jobId), companyId: sanitizeInput(req.user.companyId) };

    const result = await aiService.setFeaturedApplicant({ applicationId: sanitizedData.applicationId, jobId: sanitizedData.jobId, companyId: sanitizedData.companyId, requestId }, req);

    logger.info(`[${requestId}] Featured applicant set`, { applicationId, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, { ...result, requestId, processingTime: Date.now() - startTime }));
  } catch (error) {
    logger.error(`[${requestId}] Featured applicant failed: ${error.message}`, { applicationId: req.body?.applicationId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const sendDirectMessageController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "direct_message";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || (!req.user.isRecruiter && !req.user.canMessage)) throw new CustomError(HTTP_STATUS.FORBIDDEN, "Unauthorized", { requestId });

    const { error, value } = validateDirectMessage(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { recipientId, message, jobId } = value;
    const sanitizedData = { senderId: sanitizeInput(req.user.id), recipientId: sanitizeInput(recipientId), message: sanitizeInput(message), jobId: jobId ? sanitizeInput(jobId) : undefined };

    const result = await aiService.sendDirectMessage({ senderId: sanitizedData.senderId, recipientId: sanitizedData.recipientId, message: sanitizedData.message, jobId: sanitizedData.jobId, requestId }, req);

    logger.info(`[${requestId}] Message sent`, { senderId: sanitizedData.senderId, recipientId, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.CREATED).json(new CustomSuccess(HTTP_STATUS.CREATED, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, { ...result, requestId, processingTime: Date.now() - startTime }));
  } catch (error) {
    logger.error(`[${requestId}] Message failed: ${error.message}`, { senderId: req.user?.id, recipientId: req.body?.recipientId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const getTopApplicantJobsController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "top_applicant_jobs";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateTopApplicantJobs(req.query);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const userId = sanitizeInput(req.user.id);
    const { limit = 10, cursor } = value;
    const cacheKey = `top_applicant_jobs:${userId}:${cursor || "0"}:${limit}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Top jobs cache hit`, { userId });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...JSON.parse(cachedResult), cached: true, requestId, processingTime: Date.now() - startTime }));
    }

    const jobs = await aiService.getTopApplicantJobs({ id: userId, pagination: { limit: parseInt(limit), cursor: parseInt(cursor || 0) }, requestId }, req);
    const response = { jobs: jobs.items, pagination: { nextCursor: jobs.nextCursor, totalJobs: jobs.totalCount, limit: parseInt(limit) }, requestId, processingTime: Date.now() - startTime };

    await redisClient.setex(cacheKey, CACHE_TTL.TOP_APPLICANT_JOBS, JSON.stringify(response));

    logger.info(`[${requestId}] Top jobs retrieved: ${jobs.items.length}`, { userId, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, response));
  } catch (error) {
    logger.error(`[${requestId}] Top jobs failed: ${error.message}`, { userId: req.user?.id });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const verifyCompanyController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "company_verification";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.canVerifyCompanies) throw new CustomError(HTTP_STATUS.FORBIDDEN, "Unauthorized", { requestId });

    const { error, value } = validateCompanyVerification(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { companyId, verificationData } = value;
    const sanitizedData = { companyId: sanitizeInput(companyId), verificationData: Object.fromEntries(Object.entries(verificationData).map(([k, v]) => [k, sanitizeInput(v)])) };
    const cacheKey = `company_verification:${companyId}`;
    const rateLimitKey = `rate:verify_company:${req.user.id}`;

    return await withLock(`verify_company:${companyId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.COMPANY_VERIFICATION.max) throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Company verification limit exceeded", { requestId });
      await redisClient.expire(rateLimitKey, RATE_LIMITS.COMPANY_VERIFICATION.windowMs / 1000);

      const result = await aiService.verifyCompany({ companyId: sanitizedData.companyId, verificationData: sanitizedData.verificationData, requestId }, req);

      await redisClient.setex(cacheKey, CACHE_TTL.COMPANY_VERIFICATION, JSON.stringify(result));

      logger.info(`[${requestId}] Company verified`, { companyId, duration: Date.now() - startTime });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, { ...result, requestId, processingTime: Date.now() - startTime }));
    });
  } catch (error) {
    logger.error(`[${requestId}] Company verification failed: ${error.message}`, { companyId: req.body?.companyId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const verifySalaryController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "salary_verification";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    if (!req.user || !req.user.canVerifyJobs) throw new CustomError(HTTP_STATUS.FORBIDDEN, "Unauthorized", { requestId });

    const { error, value } = validateSalaryVerification(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { jobId, salaryData } = value;
    const sanitizedData = { jobId: sanitizeInput(jobId), salaryData: Object.fromEntries(Object.entries(salaryData).map(([k, v]) => [k, sanitizeInput(v)])) };
    const cacheKey = `salary_verification:${jobId}`;
    const rateLimitKey = `rate:verify_salary:${req.user.id}`;

    return await withLock(`verify_salary:${jobId}`, 5000, async () => {
      const rateLimitCount = await redisClient.incr(rateLimitKey);
      if (rateLimitCount > RATE_LIMITS.SALARY_VERIFICATION.max) throw new CustomError(HTTP_STATUS.TOO_MANY_REQUESTS, "Salary verification limit exceeded", { requestId });
      await redisClient.expire(rateLimitKey, RATE_LIMITS.SALARY_VERIFICATION.windowMs / 1000);

      const result = await aiService.verifySalary({ jobId: sanitizedData.jobId, salaryData: sanitizedData.salaryData, requestId }, req);

      await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(result));

      logger.info(`[${requestId}] Salary verified`, { jobId, duration: Date.now() - startTime });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, { ...result, requestId, processingTime: Date.now() - startTime }));
    });
  } catch (error) {
    logger.error(`[${requestId}] Salary verification failed: ${error.message}`, { jobId: req.body?.jobId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const detectDuplicateApplicationController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "duplicate_application";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateApplicationDuplicate(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { userId, jobId, applicationData } = value;
    const sanitizedData = { userId: sanitizeInput(userId), jobId: sanitizeInput(jobId), applicationData: sanitizeInput(JSON.stringify(applicationData)) };

    const result = await aiService.detectDuplicateApplication({ userId: sanitizedData.userId, jobId: sanitizedData.jobId, applicationData: sanitizedData.applicationData, requestId }, req);

    logger.info(`[${requestId}] Duplicate check done`, { userId, jobId, isDuplicate: result.isDuplicate, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...result, requestId, processingTime: Date.now() - startTime }));
  } catch (error) {
    logger.error(`[${requestId}] Duplicate check failed: ${error.message}`, { userId: req.body?.userId, jobId: req.body?.jobId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const calculateJobQualityScoreController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "job_quality_score";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobAnalysis(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { jobId, description } = value;
    const sanitizedData = { jobId: sanitizeInput(jobId), description: sanitizeInput(description) };
    const cacheKey = `job_quality:${jobId}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Job quality cache hit`, { jobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...JSON.parse(cachedResult), cached: true, requestId, processingTime: Date.now() - startTime }));
    }

    const result = await aiService.calculateJobQualityScore({ jobId: sanitizedData.jobId, description: sanitizedData.description, requestId }, req);

    await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(result));

    logger.info(`[${requestId}] Job quality calculated`, { jobId, qualityScore: result.qualityScore, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...result, requestId, processingTime: Date.now() - startTime }));
  } catch (error) {
    logger.error(`[${requestId}] Job quality failed: ${error.message}`, { jobId: req.body?.jobId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};

export const detectSpamJobController = async (req, res, next) => {
  const requestId = generateSecureId()();
  const startTime = Date.now();
  const endpoint = "spam_job_detection";
  try {
    ai_requestCounter.inc({ endpoint, status: "attempt" });
    const latency = ai_requestLatency.startTimer({ endpoint });

    const { error, value } = validateJobAnalysis(req.body);
    if (error) throw new CustomError(HTTP_STATUS.BAD_REQUEST, `${ERROR_MESSAGES.VALIDATION_ERROR}: ${error.message}`, { requestId });

    const { jobId, description } = value;
    const sanitizedData = { jobId: sanitizeInput(jobId), description: sanitizeInput(description) };
    const cacheKey = `spam_detection:${jobId}`;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`[${requestId}] Spam detection cache hit`, { jobId });
      ai_requestCounter.inc({ endpoint, status: "success" });
      latency();
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...JSON.parse(cachedResult), cached: true, requestId, processingTime: Date.now() - startTime }));
    }

    const result = await aiService.detectSpamJob({ jobId: sanitizedData.jobId, description: sanitizedData.description, requestId }, req);

    await redisClient.setex(cacheKey, CACHE_TTL.JOB_ANALYSIS, JSON.stringify(result));

    logger.info(`[${requestId}] Spam detection done`, { jobId, isSpam: result.isSpam, duration: Date.now() - startTime });
    ai_requestCounter.inc({ endpoint, status: "success" });
    latency();
    return res.status(HTTP_STATUS.OK).json(new CustomSuccess(HTTP_STATUS.OK, SUCCESS_MESSAGES.DATA_RETRIEVED, { ...result, requestId, processingTime: Date.now() - startTime }));
  } catch (error) {
    logger.error(`[${requestId}] Spam detection failed: ${error.message}`, { jobId: req.body?.jobId });
    ai_requestCounter.inc({ endpoint, status: "error" });
    next(error);
  }
};