import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js"; // Adjust path as needed
import { generateSecureId, sanitizeInput } from "../utils/security.js"; // Adjust path as needed
import {
  HTTP_STATUS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "../constants/messages.js";
import CustomError from "../utils/customError.js"; // Adjust path as needed
import CustomSuccess from "../utils/customSuccess.js"; // Adjust path as needed
import redisClient from "../config/redis.js"; // Adjust path as needed
import SearchModel from "../model/search.model.js"; // Adjust path as needed
import { createSearchHistorySchema, updateSearchHistorySchema } from "../validations/searchHistory.validations.js";
import { SearchStatsService, SearchEventService } from "../services/search.services.js";


// Create a new search history entry
export const createSearchHistory = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;

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

    const sanitizedInput = sanitizeInput(req.body);
    const { error, value } = createSearchHistorySchema.validate(sanitizedInput);
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

    const searchId = generateSecureId();
    const searchHistory = new SearchModel({
      searchId,
      userId,
      query: value.query,
      metadata: {
        type: value.type,
        filters: value.filters || {},
        ip: value.ip || req.ip,
        userAgent: value.userAgent || req.headers["user-agent"],
      },
      stats: {
        resultCount: value.resultCount || 0,
        executionTime: value.executionTime || 0,
      },
      createdBy: userId,
      updatedBy: userId,
    });

    await searchHistory.save();

    // Store in Redis
    await redisClient.lPush(
      `recent:searches:${userId}`,
      JSON.stringify({
        searchId,
        query: value.query,
        type: value.type,
        timestamp: new Date().toISOString(),
      })
    );
    await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    await redisClient.expire(`recent:searches:${userId}`, 60 * 60 * 24 * 30);
    await redisClient.zIncrBy("trending:searches", 1, value.query);

    // Emit Kafka event
    await SearchEventService.emit("analytics:search_created", {
      searchId,
      userId,
      query: value.query,
      type: value.type,
      filters: value.filters,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    logger.info(`[${requestId}] Search history created`, {
      userId,
      searchId,
      query: value.query,
      type: value.type,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search history created successfully",
        data: { searchHistory },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to create search history: ${error.message}`,
      {
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

// Read a single search history by searchId
export const getSearchHistoryById = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { searchId } = req.params;

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
    const searchHistory = await SearchModel.findOne({
      searchId,
      userId,
      isDeleted: false,
    }).lean();

    if (!searchHistory) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Search history not found or unauthorized",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    // Increment click count
    await SearchStatsService.incrementSearchStats(searchId, "clickCount");

    logger.info(`[${requestId}] Search history retrieved`, {
      userId,
      searchId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search history retrieved successfully",
        data: { searchHistory },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to retrieve search history: ${error.message}`,
      {
        userId,
        searchId,
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

// Read all search history for a user
export const getUserSearchHistory = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { page = 1, limit = 20 } = req.query;

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
    const searches = await SearchModel.findUserSearches(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    // Get recent searches from Redis
    const recentSearches = await redisClient.lRange(
      `recent:searches:${userId}`,
      0,
      9
    );
    const parsedRecentSearches = recentSearches.map((s) => JSON.parse(s));

    logger.info(`[${requestId}] User search history retrieved`, {
      userId,
      count: searches.length,
      page,
      limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "User search history retrieved successfully",
        data: { searches, recentSearches: parsedRecentSearches },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to retrieve user search history: ${error.message}`,
      {
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

// Update a search history entry
export const updateSearchHistory = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { searchId } = req.params;

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
    const sanitizedInput = sanitizeInput(req.body);
    const { error, value } = updateSearchHistorySchema.validate(sanitizedInput);
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

    const updateData = {
      ...value,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    const searchHistory = await SearchModel.findOneAndUpdate(
      { searchId, userId, isDeleted: false },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!searchHistory) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Search history not found or unauthorized",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    // Emit Kafka event
    await SearchEventService.emit("analytics:search_updated", {
      searchId,
      userId,
      changes: Object.keys(value),
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    logger.info(`[${requestId}] Search history updated`, {
      userId,
      searchId,
      changes: Object.keys(value),
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search history updated successfully",
        data: { searchHistory },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to update search history: ${error.message}`,
      {
        userId,
        searchId,
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

// Soft delete a search history entry
export const softDeleteSearchHistory = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { searchId } = req.params;

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
    const searchHistory = await SearchModel.findOneAndUpdate(
      { searchId, userId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: userId, updatedAt: new Date() } },
      { new: true }
    );

    if (!searchHistory) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Search history not found or unauthorized",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    // Emit Kafka event
    await SearchEventService.emit("analytics:search_deleted", {
      searchId,
      userId,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    logger.info(`[${requestId}] Search history soft deleted`, {
      userId,
      searchId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search history soft deleted successfully",
        data: { searchHistory },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to soft delete search history: ${error.message}`,
      {
        userId,
        searchId,
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

// Hard delete a search history entry (admin only)
export const hardDeleteSearchHistory = async (req, res) => {
  const requestId = generateSecureId();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { searchId } = req.params;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      new CustomError({
        success: false,
        message: "Authentication required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
  }

  // Add admin check if needed
  // if (!req.user.isAdmin) { ... }

  try {
    const searchHistory = await SearchModel.findOneAndDelete({
      searchId,
      userId,
    });

    if (!searchHistory) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Search history not found or unauthorized",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    // Clean up Redis
    await redisClient.del(`search:stats:${searchId}:*`);
    await redisClient.sRem("search:stats:flush:queue", searchId);

    // Emit Kafka event
    await SearchEventService.emit("analytics:search_hard_deleted", {
      searchId,
      userId,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });

    logger.info(`[${requestId}] Search history hard deleted`, {
      userId,
      searchId,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search history hard deleted successfully",
        data: {},
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to hard delete search history: ${error.message}`,
      {
        userId,
        searchId,
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
