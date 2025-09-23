import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import CustomError from "../utils/customError.js";
import CustomSuccess from "../utils/customSuccess.js";
import { StatsService, JobEventHandler } from "../model/job.model.js";
import JobApplication from "../model/jobApplication.model.js";
import redisClient from "../config/redis.js";
import { generateSecureId, sanitizeInput } from "../utils/security.js";
import {
  validateApplyJobInput,
  validateUpdateApplicationStatus,
  validateResumeSelectionInput,
  validateCoverLetterInput,
} from "./validations/application.validations.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/messages.js";
import { PersonalizationEngine } from "../model/search.model.js";
import {
  SearchEventService,
  SearchStatsService,
  SearchVectorService,
  SearchIndexMonitoringService,
  SearchMaintenanceService,
} from "../services/search.services.js"; // Assuming these are imported from a services module
import {buildRecentlyViewedQuery, getSortOptions} from "../services/search.services.js";



// Controller: Applies to a job (POST /jobs/:jobId/apply)
export const applyToJob = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id;

  try {
    if (!req.body || !jobId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Job ID, user authentication, and request body are required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    const idempotencyKey = `idempotency:job:apply:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(
        `[${requestId}] Idempotent apply request - returning cached response`
      );
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    const sanitizedInput = sanitizeInput({
      ...req.body,
      jobId,
      userId,
      companyId: req.body.companyId,
    });
    const { error, value } = validateApplyJobInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `Validation error: ${error.message}`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error,
        })
      );
    }

    const existingApplication = await JobApplication.findOne({
      jobId,
      userId,
    }).lean();
    if (existingApplication) {
      return res.status(HTTP_STATUS.CONFLICT).json(
        new CustomError({
          success: false,
          message: "You have already applied to this job",
          statusCode: HTTP_STATUS.CONFLICT,
        })
      );
    }

    const ipAddress =
      req.ip &&
      /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(
        req.ip
      )
        ? req.ip
        : null;
    const application = new JobApplication({
      ...value,
      metadata: {
        ipAddress,
        userAgent: req.headers["user-agent"],
      },
    });
    await application.save();

    JobEventHandler.handleJobApplication({
      jobId,
      userId,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event handling failed`, { err })
    );

    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOB_APPLIED,
      data: {
        applicationId: application.applicationId,
        jobId: application.jobId,
        status: application.status,
        appliedAt: application.appliedAt,
      },
    });

    await redisClient.set(
      idempotencyKey,
      JSON.stringify(successResponse),
      "EX",
      86400
    );

    logger.info(`[${requestId}] Job application created successfully`, {
      applicationId: application.applicationId,
      jobId,
      userId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.CREATED).json(successResponse);
  } catch (error) {
    logger.error(`[${requestId}] Failed to apply to job: ${error.message}`, {
      userId,
      jobId,
      error: error.stack,
      input: req.body,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      })
    );
  }
};

// Controller: Retrieves applications for a job (GET /jobs/:jobId/applications)
export const getApplicationsByJob = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id;
  const { page = 1, limit = 20, status } = req.query;

  try {
    if (!jobId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Job ID and user authentication are required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    const hasAccess = req.user.canManageJobs;
    if (!hasAccess) {
      logger.warn(
        `[${requestId}] Unauthorized access attempt to job applications`,
        { userId, jobId }
      );
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        new CustomError({
          success: false,
          message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN_APPLICATION}`,
          statusCode: HTTP_STATUS.FORBIDDEN,
        })
      );
    }

    const query = { jobId };
    if (status) {
      query.status = sanitizeInput(status);
    }

    const applications = await JobApplication.find(query)
      .select("applicationId userId status appliedAt resumeVersion")
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
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.APPLICATIONS_RETRIEVED,
        data: {
          applications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to retrieve job applications: ${error.message}`,
      {
        userId,
        jobId,
        error: error.stack,
        duration: Date.now() - startTime,
      }
    );
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      })
    );
  }
};

// Controller: Updates application status (PUT /jobs/:jobId/applications/:applicationId)
export const updateApplicationStatus = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const { applicationId } = req.params;
  const userId = req.user?.id;
  const { status } = req.body;

  try {
    if (!applicationId || !userId || !status) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message:
            "Application ID, user authentication, and status are required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    const idempotencyKey = `idempotency:application:status:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(
        `[${requestId}] Idempotent status update request - returning cached response`
      );
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    const sanitizedInput = sanitizeInput({ status });
    const { error, value } = validateUpdateApplicationStatus(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `Validation error: ${error.message}`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error,
        })
      );
    }

    const hasAccess = req.user.canManageJobs;
    if (!hasAccess) {
      logger.warn(`[${requestId}] Unauthorized status update attempt`, {
        userId,
        applicationId,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        new CustomError({
          success: false,
          message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN_APPLICATION}`,
          statusCode: HTTP_STATUS.FORBIDDEN,
        })
      );
    }

    const application = await JobApplication.findOneAndUpdate(
      { applicationId },
      { status: value.status, updatedAt: new Date() },
      { new: true, select: "applicationId jobId status updatedAt" }
    ).lean();

    if (!application) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Application not found",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    JobEventHandler.handleJobApplication({
      jobId: application.jobId,
      userId,
      status: value.status,
      metadata: { updatedBy: userId },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event handling failed`, { err })
    );

    await StatsService.incrementJobStats(
      application.jobId,
      `status_${value.status}`
    );

    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.APPLICATION_STATUS_UPDATED,
      data: {
        applicationId: application.applicationId,
        jobId: application.jobId,
        status: application.status,
        updatedAt: application.updatedAt,
      },
    });

    await redisClient.set(
      idempotencyKey,
      JSON.stringify(successResponse),
      "EX",
      86400
    );

    logger.info(`[${requestId}] Application status updated successfully`, {
      applicationId,
      jobId: application.jobId,
      userId,
      status: value.status,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(successResponse);
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to update application status: ${error.message}`,
      {
        userId,
        applicationId,
        error: error.stack,
        input: req.body,
        duration: Date.now() - startTime,
      }
    );
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      })
    );
  }
};

// Controller: Deletes a job application (DELETE /jobs/:jobId/applications/:applicationId)
export const deleteApplication = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const { applicationId } = req.params;
  const userId = req.user?.id;

  try {
    if (!applicationId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Application ID and user authentication are required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    const idempotencyKey = `idempotency:application:delete:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(
        `[${requestId}] Idempotent delete request - returning cached response`
      );
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    const application = await JobApplication.findOne({ applicationId }).lean();
    if (!application) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Application not found",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    const isOwner = application.userId === userId;
    const isAdmin = req.user.canManageJobs;
    if (!isOwner && !isAdmin) {
      logger.warn(`[${requestId}] Unauthorized delete attempt`, {
        userId,
        applicationId,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        new CustomError({
          success: false,
          message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN_APPLICATION}`,
          statusCode: HTTP_STATUS.FORBIDDEN,
        })
      );
    }

    await JobApplication.updateOne(
      { applicationId },
      { isDeleted: true, deletedAt: new Date(), deletedBy: userId }
    );

    JobEventHandler.handleJobApplication({
      jobId: application.jobId,
      userId,
      action: "deleted",
      metadata: { deletedBy: userId },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event handling failed`, { err })
    );

    await StatsService.incrementJobStats(application.jobId, "deletions");

    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.APPLICATION_DELETED,
      data: { applicationId },
    });

    await redisClient.set(
      idempotencyKey,
      JSON.stringify(successResponse),
      "EX",
      86400
    );

    logger.info(`[${requestId}] Application deleted successfully`, {
      applicationId,
      jobId: application.jobId,
      userId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(successResponse);
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to delete application: ${error.message}`,
      {
        userId,
        applicationId,
        error: error.stack,
        duration: Date.now() - startTime,
      }
    );
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      })
    );
  }
};

// *UNIFIED RESUME SELECTION CONTROLLER* (Advanced with validation, personalization check)
export const selectResumeForApplication = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    // *INPUT VALIDATION*
    const sanitizedInput = sanitizeInput(req.body);
    const { error, value } = validateResumeSelectionInput({
      ...sanitizedInput,
      userId,
    });
    if (error) {
      logger.warn(`[${requestId}] Validation failed`, {
        userId,
        errors: error.details,
        input: sanitizedInput,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `Validation error: ${error.details
            .map((d) => d.message)
            .join(", ")}`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error.details,
        })
      );
    }

    // *PERSONALIZATION* (Check if resume matches user profile preferences)
    let userProfile = null;
    if (userId) {
      userProfile = await PersonalizationEngine.getUserProfile(userId);
      if (
        userProfile?.preferredResume &&
        value.resumeId !== userProfile.preferredResume
      ) {
        logger.info(`[${requestId}] Resume selection differs from preferred`, {
          userId,
          selected: value.resumeId,
          preferred: userProfile.preferredResume,
        });
      }
    }

    // *UPDATE OPERATION WITH TIMEOUT*
    const updateResult = await JobApplication.updateOne(
      { _id: value.applicationId, userId },
      { resumeId: value.resumeId }
    ).option({ maxTimeMS: 10000 });

    if (updateResult.matchedCount === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Application not found or unauthorized.",
        })
      );
    }

    // Invalidate related caches (e.g., application details cache)
    try {
      await redisClient.del(`application:${value.applicationId}`);
    } catch (redisErr) {
      logger.warn(`[${requestId}] Failed to invalidate cache`, {
        error: redisErr.message,
      });
    }

    // *RESPONSE CONSTRUCTION*
    const response = new CustomSuccess({
      message: "Resume selected for application successfully.",
      data: {
        applicationId: value.applicationId,
        resumeId: value.resumeId,
        meta: {
          updateTime: Date.now() - startTime,
          userProfileApplied: !!userProfile,
        },
      },
    });

    // *ANALYTICS EVENT (ASYNC)*
    SearchEventService.emit("analytics:resume_selected", {
      userId,
      applicationId: value.applicationId,
      resumeId: value.resumeId,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Analytics event failed`, {
        error: err.message,
      })
    );

    // Update stats
    await SearchStatsService.updateStats({
      type: "resume_selection",
      count: 1,
      userId,
    });

    // *SUCCESS LOG*
    logger.info(`[${requestId}] Resume selected successfully`, {
      userId,
      applicationId: value.applicationId,
      resumeId: value.resumeId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Resume selection failed: ${error.message}`, {
      userId,
      error: error.stack,
      body: req.body,
      duration: Date.now() - startTime,
    });

    SearchIndexMonitoringService.reportError({
      error,
      context: "resume_selection",
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        requestId,
      })
    );
  }
};

// *UNIFIED COVER LETTER ATTACHMENT CONTROLLER* (Advanced with validation, vector analysis)
export const attachCoverLetter = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    // *INPUT VALIDATION*
    const sanitizedInput = sanitizeInput(req.body);
    const { error, value } = validateCoverLetterInput({
      ...sanitizedInput,
      userId,
    });
    if (error) {
      logger.warn(`[${requestId}] Validation failed`, {
        userId,
        errors: error.details,
        input: sanitizedInput,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `Validation error: ${error.details
            .map((d) => d.message)
            .join(", ")}`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error.details,
        })
      );
    }

    // *PERSONALIZATION & VECTOR ANALYSIS* (Use SearchVectorService to analyze cover letter relevance)
    let userProfile = null;
    if (userId) {
      userProfile = await PersonalizationEngine.getUserProfile(userId);
      const application = await JobApplication.findById(
        value.applicationId
      ).populate("jobId");
      if (application && application.jobId) {
        const relevanceScore = await SearchVectorService.computeRelevance(
          value.coverLetter,
          application.jobId.description
        );
        if (relevanceScore < 0.5) {
          // Arbitrary threshold
          logger.warn(`[${requestId}] Low relevance cover letter`, {
            userId,
            score: relevanceScore,
          });
        }
      }
    }

    // *UPDATE OPERATION WITH TIMEOUT*
    const updateResult = await JobApplication.updateOne(
      { _id: value.applicationId, userId },
      { coverLetter: value.coverLetter }
    ).option({ maxTimeMS: 10000 });

    if (updateResult.matchedCount === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Application not found or unauthorized.",
        })
      );
    }

    // Invalidate caches
    try {
      await redisClient.del(`application:${value.applicationId}`);
    } catch (redisErr) {
      logger.warn(`[${requestId}] Failed to invalidate cache`, {
        error: redisErr.message,
      });
    }

    // *RESPONSE CONSTRUCTION*
    const response = new CustomSuccess({
      message: "Cover letter attached successfully.",
      data: {
        applicationId: value.applicationId,
        coverLetterLength: value.coverLetter.length,
        meta: {
          updateTime: Date.now() - startTime,
          userProfileApplied: !!userProfile,
        },
      },
    });

    // *ANALYTICS EVENT (ASYNC)*
    SearchEventService.emit("analytics:cover_letter_attached", {
      userId,
      applicationId: value.applicationId,
      coverLetterLength: value.coverLetter.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Analytics event failed`, {
        error: err.message,
      })
    );

    // Update stats
    await SearchStatsService.updateStats({
      type: "cover_letter_attachment",
      count: 1,
      userId,
    });

    // *SUCCESS LOG*
    logger.info(`[${requestId}] Cover letter attached successfully`, {
      userId,
      applicationId: value.applicationId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(
      `[${requestId}] Cover letter attachment failed: ${error.message}`,
      {
        userId,
        error: error.stack,
        body: req.body,
        duration: Date.now() - startTime,
      }
    );

    SearchIndexMonitoringService.reportError({
      error,
      context: "cover_letter_attachment",
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        requestId,
      })
    );
  }
};
