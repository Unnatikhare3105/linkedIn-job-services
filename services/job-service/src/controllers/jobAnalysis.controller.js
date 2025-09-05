import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import JobAnalytics from "../model/jobAnalysis.model.js";
import { JobEventHandler, JobVectorService } from "../model/job.model.js";
import redisClient from "../config/redis.js";
import { sanitizeInput } from "../utils/security.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/http.js";

// POST /jobs/:jobId/view - Increment job view count
// Controller: Increments job view count (POST /jobs/:jobId/view)
export const incrementView = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id; // From auth middleware

  try {
    if (!jobId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Job ID is required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    // Idempotency check (prevent duplicate views within a short window, e.g., 5 minutes)
    const idempotencyKey = `idempotency:job:view:${jobId}:${
      userId || req.ip
    }:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(
        `[${requestId}] Idempotent view increment - returning cached response`
      );
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    // Async event handling
    await JobEventHandler.handleJobView({
      jobId,
      userId,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    // Prepare response
    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOB_VIEW_INCREMENTED,
      data: { jobId },
    });

    // Store for idempotency (5-minute expiry)
    await redisClient.set(
      idempotencyKey,
      JSON.stringify(successResponse),
      "EX",
      300
    );

    logger.info(`[${requestId}] Job view incremented successfully`, {
      jobId,
      userId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(successResponse);
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to increment job view: ${error.message}`,
      {
        jobId,
        userId,
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

// POST /jobs/:jobId/save - Increment job save count
// Controller: Increments job save count (POST /jobs/:jobId/save)
export const incrementSave = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id;

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

    // Idempotency check (prevent duplicate saves)
    const idempotencyKey = `idempotency:job:save:${jobId}:${userId}:${requestId}`;
    const existingResponse = await redisClient.get(idempotencyKey);
    if (existingResponse) {
      logger.info(
        `[${requestId}] Idempotent save increment - returning cached response`
      );
      return res.status(HTTP_STATUS.OK).json(JSON.parse(existingResponse));
    }

    // Async event handling
    await JobEventHandler.handleJobSave({
      jobId,
      userId,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    // Prepare response
    const successResponse = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOB_SAVE_INCREMENTED,
      data: { jobId },
    });

    // Store for idempotency (24-hour expiry)
    await redisClient.set(
      idempotencyKey,
      JSON.stringify(successResponse),
      "EX",
      86400
    );

    logger.info(`[${requestId}] Job save incremented successfully`, {
      jobId,
      userId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(successResponse);
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to increment job save: ${error.message}`,
      {
        jobId,
        userId,
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

// GET /jobs/:jobId/analytics - Retrieve analytics for a job
// Controller: Retrieves job analytics (GET /jobs/:jobId/analytics)
export const getJobAnalytics = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { jobId } = req.params;
  const userId = req.user?.id;
  const { startDate, endDate, page = 1, limit = 30 } = req.query;

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

    // Verify permission
    const hasAccess = req.user.canManageJobs;
    if (!hasAccess) {
      logger.warn(`[${requestId}] Unauthorized analytics access attempt`, {
        userId,
        jobId,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        new CustomError({
          success: false,
          message: `Forbidden: ${ERROR_MESSAGES.FORBIDDEN_ANALYTICS}`,
          statusCode: HTTP_STATUS.FORBIDDEN,
        })
      );
    }

    // Build query with date range
    const query = { jobId };
    if (startDate && endDate) {
      query.date = {
        $gte: sanitizeInput(startDate),
        $lte: sanitizeInput(endDate),
      };
    }

    // Efficient query using index
    const analytics = await JobAnalytics.find(query)
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await JobAnalytics.countDocuments(query);

    logger.info(`[${requestId}] Job analytics retrieved successfully`, {
      jobId,
      userId,
      count: analytics.length,
      page,
      limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.ANALYTICS_RETRIEVED,
        data: {
          analytics,
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
      `[${requestId}] Failed to retrieve job analytics: ${error.message}`,
      {
        jobId,
        userId,
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
