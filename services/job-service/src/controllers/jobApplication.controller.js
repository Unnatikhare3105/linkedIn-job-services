import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import CustomError from '../utils/CustomError.js';
import CustomSuccess from '../utils/CustomSuccess.js';
import JobApplication from '../model/jobApplication.model.js';
import { StatsService, JobEventHandler } from '../model/job.model.js';
import redisClient from '../config/redis.js';
import { sanitizeInput } from '../utils/security.js';
import { validateApplyJobInput, validateUpdateApplicationStatus } from '../utils/validators.js';
// import * as applicationService from '../services/application.services.js';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

const ERROR_MESSAGES = {
  FORBIDDEN: 'You do not have permission to perform this action',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  INVALID_INPUT: 'Invalid input provided',
  JOB_NOT_FOUND: 'Job not found',
  APPLICATION_NOT_FOUND: 'Application not found',
  ALREADY_APPLIED: 'You have already applied to this job',
};

const SUCCESS_MESSAGES = {
  JOB_APPLIED: 'Job application submitted successfully',
  APPLICATIONS_RETRIEVED: 'Job applications retrieved successfully',
  APPLICATION_STATUS_UPDATED: 'Application status updated successfully',
  APPLICATION_DELETED: 'Application deleted successfully',
  JOB_CREATED: 'Job created successfully',
};

export const applyToJob = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id;

  try {
    if (!req.body || !jobId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: 'Job ID, user authentication, and request body are required',
        statusCode: HTTP_STATUS.BAD_REQUEST
      }));
    }

    const idempotencyKey = `idempotency:job:apply:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(`[${requestId}] Idempotent apply request - returning cached response`);
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    const sanitizedInput = sanitizeInput({ ...req.body, jobId, userId, companyId: req.body.companyId });
    const { error, value } = validateApplyJobInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error
      }));
    }

    const existingApplication = await JobApplication.findOne({ jobId, userId }).lean();
    if (existingApplication) {
      return res.status(HTTP_STATUS.CONFLICT).json(new CustomError({
        success: false,
        message: 'You have already applied to this job',
        statusCode: HTTP_STATUS.CONFLICT
      }));
    }

    const ipAddress = req.ip && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(req.ip) ? req.ip : null;
    const application = new JobApplication({
      ...value,
      metadata: {
        ipAddress,
        userAgent: req.headers['user-agent']
      }
    });
    await application.save();

    JobEventHandler.handleJobApplication({
      jobId,
      userId,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    }).catch(err => logger.error(`[${requestId}] Async event handling failed`, { err }));

    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOB_APPLIED,
      data: {
        applicationId: application.applicationId,
        jobId: application.jobId,
        status: application.status,
        appliedAt: application.appliedAt
      }
    });

    await redisClient.set(idempotencyKey, JSON.stringify(successResponse), 'EX', 86400);

    logger.info(`[${requestId}] Job application created successfully`, {
      applicationId: application.applicationId,
      jobId,
      userId,
      duration: Date.now() - startTime
    });

    return res.status(HTTP_STATUS.CREATED).json(successResponse);
  } catch (error) {
    logger.error(`[${requestId}] Failed to apply to job: ${error.message}`, {
      userId,
      jobId,
      error: error.stack,
      input: req.body,
      duration: Date.now() - startTime
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message
    }));
  }
};

export const getApplicationsByJob = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id;
  const { page = 1, limit = 20, status } = req.query;

  try {
    if (!jobId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: 'Job ID and user authentication are required',
        statusCode: HTTP_STATUS.BAD_REQUEST
      }));
    }

    const hasAccess = req.user.canManageJobs;
    if (!hasAccess) {
      logger.warn(`[${requestId}] Unauthorized access attempt to job applications`, { userId, jobId });
      return res.status(HTTP_STATUS.FORBIDDEN).json(new CustomError({
        success: false,
        message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN}`,
        statusCode: HTTP_STATUS.FORBIDDEN
      }));
    }

    const query = { jobId };
    if (status) {
      query.status = sanitizeInput(status);
    }

    const applications = await JobApplication.find(query)
      .select('applicationId userId status appliedAt resumeVersion')
      .sort({ appliedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await JobApplication.countDocuments(query);

    logger.info(`[${requestId}] Retrieved job applications`, {
      jobId,
      userId,
      count: applications.length,
      page,
      limit,
      duration: Date.now() - startTime
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
      message: SUCCESS_MESSAGES.APPLICATIONS_RETRIEVED,
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to retrieve job applications: ${error.message}`, {
      userId,
      jobId,
      error: error.stack,
      duration: Date.now() - startTime
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message
    }));
  }
};

export const updateApplicationStatus = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { applicationId } = req.params;
  const userId = req.user?.id;
  const { status } = req.body;

  try {
    if (!applicationId || !userId || !status) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: 'Application ID, user authentication, and status are required',
        statusCode: HTTP_STATUS.BAD_REQUEST
      }));
    }

    const idempotencyKey = `idempotency:application:status:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(`[${requestId}] Idempotent status update request - returning cached response`);
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    const sanitizedInput = sanitizeInput({ status });
    const { error, value } = validateUpdateApplicationStatus(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error
      }));
    }

    const hasAccess = req.user.canManageJobs;
    if (!hasAccess) {
      logger.warn(`[${requestId}] Unauthorized status update attempt`, { userId, applicationId });
      return res.status(HTTP_STATUS.FORBIDDEN).json(new CustomError({
        success: false,
        message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN}`,
        statusCode: HTTP_STATUS.FORBIDDEN
      }));
    }

    const application = await JobApplication.findOneAndUpdate(
      { applicationId },
      { status: value.status, updatedAt: new Date() },
      { new: true, select: 'applicationId jobId status updatedAt' }
    ).lean();

    if (!application) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
        success: false,
        message: 'Application not found',
        statusCode: HTTP_STATUS.NOT_FOUND
      }));
    }

    JobEventHandler.handleJobApplication({
      jobId: application.jobId,
      userId,
      status: value.status,
      metadata: { updatedBy: userId }
    }).catch(err => logger.error(`[${requestId}] Async event handling failed`, { err }));

    await StatsService.incrementJobStats(application.jobId, `status_${value.status}`);

    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.APPLICATION_STATUS_UPDATED,
      data: {
        applicationId: application.applicationId,
        jobId: application.jobId,
        status: application.status,
        updatedAt: application.updatedAt
      }
    });

    await redisClient.set(idempotencyKey, JSON.stringify(successResponse), 'EX', 86400);

    logger.info(`[${requestId}] Application status updated successfully`, {
      applicationId,
      jobId: application.jobId,
      userId,
      status: value.status,
      duration: Date.now() - startTime
    });

    return res.status(HTTP_STATUS.OK).json(successResponse);
  } catch (error) {
    logger.error(`[${requestId}] Failed to update application status: ${error.message}`, {
      userId,
      applicationId,
      error: error.stack,
      input: req.body,
      duration: Date.now() - startTime
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message
    }));
  }
};

export const deleteApplication = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { applicationId } = req.params;
  const userId = req.user?.id;

  try {
    if (!applicationId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: 'Application ID and user authentication are required',
        statusCode: HTTP_STATUS.BAD_REQUEST
      }));
    }

    const idempotencyKey = `idempotency:application:delete:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(`[${requestId}] Idempotent delete request - returning cached response`);
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    const application = await JobApplication.findOne({ applicationId }).lean();
    if (!application) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
        success: false,
        message: 'Application not found',
        statusCode: HTTP_STATUS.NOT_FOUND
      }));
    }

    const isOwner = application.userId === userId;
    const isAdmin = req.user.canManageJobs;
    if (!isOwner && !isAdmin) {
      logger.warn(`[${requestId}] Unauthorized delete attempt`, { userId, applicationId });
      return res.status(HTTP_STATUS.FORBIDDEN).json(new CustomError({
        success: false,
        message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN}`,
        statusCode: HTTP_STATUS.FORBIDDEN
      }));
    }

    await JobApplication.updateOne(
      { applicationId },
      { isDeleted: true, deletedAt: new Date(), deletedBy: userId }
    );

    JobEventHandler.handleJobApplication({
      jobId: application.jobId,
      userId,
      action: 'deleted',
      metadata: { deletedBy: userId }
    }).catch(err => logger.error(`[${requestId}] Async event handling failed`, { err }));

    await StatsService.incrementJobStats(application.jobId, 'deletions');

    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.APPLICATION_DELETED,
      data: { applicationId }
    });

    await redisClient.set(idempotencyKey, JSON.stringify(successResponse), 'EX', 86400);

    logger.info(`[${requestId}] Application deleted successfully`, {
      applicationId,
      jobId: application.jobId,
      userId,
      duration: Date.now() - startTime
    });

    return res.status(HTTP_STATUS.OK).json(successResponse);
  } catch (error) {
    logger.error(`[${requestId}] Failed to delete application: ${error.message}`, {
      userId,
      applicationId,
      error: error.stack,
      duration: Date.now() - startTime
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message
    }));
  }
};
