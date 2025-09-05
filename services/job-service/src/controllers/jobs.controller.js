import { v4 as uuidv4 } from "uuid";
import Job, { JobEventService } from "../model/job.model.js";
import { sanitizeInput, sanitizeUserId } from "../utils/security.js";
import * as jobService from "../services/job.services.js";
import {
  normalizeArrayFields,
  validateSaveSearchInput,
  validateCreateJobInput,
  validateUpdateJobInput,
  validateListJobsFilters,
} from "../validations/job.validations.js";
import logger from "../utils/logger.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/http.js";

// Controller: Handles creation of a new job (POST /jobs)
export const createJobController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }

    const normalizedBody = normalizeArrayFields(req.body);
    console.log(
      "1. Raw body skills:",
      typeof req.body.skills,
      JSON.stringify(req.body.skills, null, 2)
    );

    // Sanitize and validate input
    const sanitizedInput = sanitizeInput(normalizedBody);
    console.log(
      "2. After sanitizeInput skills:",
      typeof sanitizedInput.skills,
      JSON.stringify(sanitizedInput.skills, null, 2)
    );

    const { error, value } = validateCreateJobInput(sanitizedInput);
    console.log(
      "3. After validation skills:",
      typeof value?.skills,
      JSON.stringify(value?.skills, null, 2)
    );
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `rfrsdgvrdtgbtgb ${error.message} , ${error}`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error,
        })
      );
    }

    // Check user authorization
    if (!req.user || !req.user.canCreateJobs) {
      logger.warn(`[${requestId}] Unauthorized job creation attempt`, {
        userId: req.user?.id,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        new CustomError({
          success: false,
          message: `hjugvykuhblhjvhm ${ERROR_MESSAGES.FORBIDDEN_JOB}`,
          statusCode: HTTP_STATUS.FORBIDDEN,
        })
      );
    }

    console.log("4. About to call jobService.createJob");
    console.log("4.1. req.user:", JSON.stringify(req.user, null, 2));
    console.log("4.2. requestId:", requestId);
    console.log("4.3. value (sanitizedInput):", typeof value);

    const createJob = await jobService.createJob({
      userId: req.user.id,
      requestId,
      sanitizedInput: value,
    });

    console.log("5. Service call completed successfully");
    // Log success
    logger.info(`[${requestId}] Job created successfully`, {
      jobId: createJob.jobId,
      companyId: createJob.companyId,
      userId: req.user?.id,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOB_CREATED,
        data: {
          jobId: createJob.jobId,
          title: createJob.title,
          companyId: createJob.companyId,
          status: createJob.status,
          createdAt: createJob.createdAt,
        },
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Failed to create job: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      input: req.body,
      duration: Date.now() - startTime,
    });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error: error.message,
      })
    );
  }
};

// Controller: Retrieves a single job by ID (GET /jobs/:jobId)
export const getJobByIdController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { jobId } = req.params;
    if (
      !jobId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        jobId
      )
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          message: ERROR_MESSAGES.INVALID_INPUT,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: "Invalid job ID format",
        })
      );
    }

    const job = await jobService.getJobById({
      userId: req.user?.id,
      jobId,
      requestId,
    });

    logger.info(`[${requestId}] Job retrieved successfully`, {
      jobId,
      userId: req.user?.id,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOB_FOUND,
        data: job,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Failed to fetch job: ${error.message}`, {
      jobId: req.params.jobId,
      userId: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        details: error,
      })
    );
  }
};

// Controller: Updates a job by ID (PUT /jobs/:jobId)
export const updateJobController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { jobId } = req.params;
    if (
      !jobId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        jobId
      )
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          message: ERROR_MESSAGES.INVALID_INPUT,
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }
    const sanitizedInput = sanitizeInput(req.body);
    const { error, value } = validateUpdateJobInput(sanitizedInput);
    if (error) {
      logger.warn(
        `[${requestId}] Invalid input for job update: ${error.details[0].message}`,
        {
          jobId,
          userId: req.user?.id,
          input: sanitizedInput,
        }
      );
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          message: ERROR_MESSAGES.INVALID_INPUT,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error.details,
        })
      );
    }

    if (!req.user || !req.user.canUpdateJobs) {
      logger.warn(`[${requestId}] Unauthorized job update attempt`, {
        jobId,
        userId: req.user?.id,
      });
      return res
        .status(HTTP_STATUS.FORBIDDEN)
        .json(
          new CustomError({
            message: ERROR_MESSAGES.FORBIDDEN_JOB,
            statusCode: HTTP_STATUS.FORBIDDEN,
          })
        );
    }

    const updateJob = await jobService.updateJob({
      jobId,
      userId: req.user?.id,
      requestId,
      updates: sanitizedInput,
    });
    if (!updateJob) {
      logger.warn(`[${requestId}] Job not found for update`, {
        jobId,
        userId: req.user?.id,
      });
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          message: ERROR_MESSAGES.JOB_NOT_FOUND,
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    logger.info(`[${requestId}] Job updated successfully`, {
      jobId,
      userId: req.user?.id,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.JOB_UPDATED,
      data: {
        jobId: updateJob.jobId,
        title: updateJob.title,
        companyId: updateJob.companyId,
        status: updateJob.status,
        updatedAt: updateJob.updatedAt,
      },
    });
  } catch (error) {
    logger.error(`[${requestId}] Failed to update job: ${error.message}`, {
      jobId: req.params.jobId,
      userId: req.user?.id,
      error: error.stack,
      input: req.body,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        details: error.details,
      })
    );
  }
};

// Controller: Soft deletes a job (DELETE /jobs/:jobId)
export const deleteJobController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { jobId } = req.params;

  try {
    if (
      !jobId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        jobId
      )
    ) {
      throw new CustomError({
        message: ERROR_MESSAGES.INVALID_INPUT,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      });
    }

    if (!req.user || !req.user.canDeleteJobs) {
      logger.warn(`[${requestId}] Unauthorized job deletion attempt`, {
        jobId,
        userId: req.user?.id,
      });
      throw new CustomError({
        message: ERROR_MESSAGES.FORBIDDEN_JOB,
        statusCode: HTTP_STATUS.FORBIDDEN,
      });
    }

    const updatedBy = sanitizeUserId(req.user.id);
    const job = await Job.findOneAndUpdate(
      { jobId, isDeleted: false },
      {
        $set: { isDeleted: true, updatedBy, "dates.lastUpdated": new Date() },
        $inc: { version: 1 },
      },
      { new: true }
    ).lean();

    if (!job) {
      logger.warn(`[${requestId}] Job not found for deletion`, {
        jobId,
        userId: req.user?.id,
      });
      throw new CustomError(
        ERROR_MESSAGES.JOB_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Emit job deleted event
    await JobEventService.emit("job:deleted", {
      jobId,
      requestId,
    });

    logger.info(`[${requestId}] Job deleted successfully`, {
      jobId,
      userId: req.user?.id,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.JOB_DELETED,
    });
  } catch (error) {
    logger.error(`[${requestId}] Failed to delete job: ${error.message}`, {
      jobId: req.params.jobId,
      userId: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        details: error.details,
      })
    );
  }
};

// Controller: Lists, filters, or searches jobs (GET /jobs)
export const listJobsController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const sanitizedFilters = sanitizeInput(req.query);

  try {
    const { error, value } = validateListJobsFilters(sanitizedFilters);
    if (error) {
      logger.warn(
        `[${requestId}] Invalid filters for listing jobs: ${error.details[0].message}`,
        {
          userId: req.user?.id,
          filters: sanitizedFilters,
        }
      );
      throw new CustomError({
        message: ERROR_MESSAGES.INVALID_INPUT,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error.details,
      });
    }

    const jobList = await jobService.listJobs({
      filters: sanitizedFilters,
      requestId,
    });

    logger.info(`[${requestId}] Jobs listed successfully`, {
      userId: req.user?.id,
      count: jobList.length,
      filters,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.JOBS_LISTED,
      count: jobList.length,
      data: jobList,
    });
  } catch (error) {
    logger.error(`[${requestId}] Failed to list jobs: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      filters: req.query,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        details: error.details,
      })
    );
  }
};

// Controller: Gets featured jobs (GET /jobs/featured)
export const featuredJobsController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const jobs = await jobService.getFeaturedJobs({ requestId });
    if (!jobs || jobs.length === 0) {
      logger.warn(`[${requestId}] No featured jobs found`, {
        userId: req.user?.id,
      });
      throw new CustomError({
        message: ERROR_MESSAGES.FEATURED_JOBS_FAILED,
        statusCode: HTTP_STATUS.NOT_FOUND,
      });
    }

    logger.info(`[${requestId}] Featured jobs retrieved successfully`, {
      userId: req.user?.id,
      count: jobs.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.FEATURED_JOBS,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to fetch featured jobs: ${error.message}`,
      {
        userId: req.user?.id,
        error: error.stack,
        duration: Date.now() - startTime,
      }
    );
    next(error);
  }
};

// Controller: Saves a job search for a user (POST /jobs/save-search)
export const saveJobsController = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { type, query } = req.body;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      new CustomError({
        success: false,
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
  }

  try {
    // Ensure Redis client is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info(`[${requestId}] Redis client connected`);
    }

    const sanitizedInput = sanitizeInput({ type, query });
    const { error, value } = validateSaveSearchInput(sanitizedInput);
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

    // Save search to Redis list
    await redisClient.lPush(
      `saved:searches:${userId}`,
      JSON.stringify({
        type: value.type,
        query: value.query,
        timestamp: new Date().toISOString(),
      })
    );
    // Trim list to keep only the last 10 searches
    await redisClient.lTrim(`saved:searches:${userId}`, 0, 9);

    // Increment trending searches
    await redisClient.zIncrBy("trending:searches", 1, value.query);

    // Emit Kafka event
    JobEventService.emit("analytics:save_search", {
      userId,
      type: value.type,
      query: value.query,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async save search event failed`, { err })
    );

    logger.info(`[${requestId}] Search saved`, {
      userId,
      type: value.type,
      query: value.query,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search saved successfully",
        data: { type: value.type, query: value.query },
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Failed to save search: ${error.message}`, {
      userId,
      type,
      query,
      error: error.stack,
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
