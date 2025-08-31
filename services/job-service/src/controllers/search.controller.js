// controllers/searchController.js
// Production-ready search controllers for job platform
// Optimized for scalability with 10M users:
// - Uses MongoDB text indexes for efficient search
// - Redis caching for autocomplete and recent searches
// - Kafka events for search analytics
// - Input sanitization and validation for security
// - Pagination for large result sets
// - Recommendations: Redis rate limiting, monitor with Prometheus, scale with PM2

import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import Job, { JobEventService } from "../model/job.model.js";
import redisClient from "../config/redis.js";
import { sanitizeInput } from "../utils/security.js";
import { validateSearchInput, validateSaveSearchInput, validateSkillsSearchInput } from "../utils/validators.js";

export const SUCCESS_MESSAGES = {
  // ... other messages
  JOBS_RETRIEVED: "Jobs retrieved successfully",
  AUTOCOMPLETE_RETRIEVED: "Autocomplete suggestions retrieved successfully",
  RECENT_SEARCHES_RETRIEVED: "Recent searches retrieved successfully",
  SUGGESTIONS_RETRIEVED: "Search suggestions retrieved successfully",
  TRENDING_RETRIEVED: "Trending searches retrieved successfully",
  SAVED_RETRIEVED: "Saved searches retrieved successfully",
  HISTORY_RETRIEVED: "Search history retrieved successfully",
};

export const ERROR_MESSAGES = {
  // ... other messages
  JOBS_NOT_FOUND: "No jobs found",
  AUTOCOMPLETE_NOT_FOUND: "No autocomplete suggestions found",
  RECENT_SEARCHES_NOT_FOUND: "No recent searches found",
  SUGGESTIONS_NOT_FOUND: "No suggestions found",
  TRENDING_NOT_FOUND: "No trending searches found",
  SAVED_NOT_FOUND: "No saved searches found",
  HISTORY_NOT_FOUND: "No search history found",
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// GET /jobs/search/title - Search jobs by title
export const searchJobsByTitle = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // Perform text search
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    })
      .select('jobId title companyId location jobType createdAt')
      .sort({ score: { $meta: 'textScore' } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $text: { $search: value.query },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    });

    // Increment score for the search query in trending:searches
    await redisClient.zIncrBy('trending:searches', 1, value.query);

    // Store search in Redis for recent searches (if authenticated)
    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: 'title',
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    // Emit search event
    JobEventService.emit('analytics:search', {
      userId,
      type: 'title',
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Job title search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs by title: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/search/company - Search jobs by company name
export const searchJobsByCompany = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    if (!value.query) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: 'Search query is required',
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    // Perform text search on company name (assume companyName field in Job)
    const jobs = await Job.find({
      companyName: { $regex: value.query, $options: 'i' },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    })
      .limit(parseInt(value.limit))
      .exec();

    const total = await Job.countDocuments({
      companyName: { $regex: value.query, $options: 'i' },
      status: 'active',
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    await redisClient.zIncrBy('trending:searches', 1, value.query);

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "company",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "company",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Job company search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs by company: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/search/skills - Search jobs by skills
export const searchJobsBySkills = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { skills, page = 1, limit = 20 } = req.query;

  try {
    // Normalize skills (handle comma-separated string or array)
    const normalizedSkills =
      typeof skills === "string"
        ? skills.split(",").map((s) => s.trim())
        : skills;
    const sanitizedInput = sanitizeInput({
      skills: normalizedSkills,
      page,
      limit,
    });
    const { error, value } = validateSkillsSearchInput(sanitizedInput);
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

    // Search jobs with matching skills
    const jobs = await Job.find({
      "skills.name": { $in: value.skills.map((s) => new RegExp(s, "i")) },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType skills createdAt")
      .sort({ "dates.posted": -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      "skills.name": { $in: value.skills.map((s) => new RegExp(s, "i")) },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    await redisClient.zIncrBy('trending:searches', 1, value.skills.join(", "));

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "skills",
          query: value.skills.join(", "),
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "skills",
      query: value.skills.join(", "),
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Job skills search completed`, {
      userId,
      skills: value.skills,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs by skills: ${error.message}`,
      {
        userId,
        skills,
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

// GET /jobs/search/keyword - General keyword search
export const searchJobsByKeyword = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // Search across multiple fields using text index
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType skills createdAt")
      .sort({ score: { $meta: "textScore" } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    await redisClient.zIncrBy('trending:searches', 1, value.query);

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "keyword",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "keyword",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Keyword search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs by keyword: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/autocomplete - Get autocomplete suggestions
export const getAutoCompleteSuggestions = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, type = "keyword", limit = 10 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, limit });
    const { error, value } = validateSearchInput({
      ...sanitizedInput,
      page: 1,
    });
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

    // Check Redis cache for suggestions
    const cacheKey = `autocomplete:${type}:${value.query}`;
    const cachedSuggestions = await redisClient.get(cacheKey);
    if (cachedSuggestions) {
      logger.info(`[${requestId}] Autocomplete suggestions from cache`, {
        userId,
        query: value.query,
        type,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: SUCCESS_MESSAGES.AUTOCOMPLETE_RETRIEVED,
          data: { suggestions: JSON.parse(cachedSuggestions) },
        })
      );
    }

    let suggestions = [];
    if (type === "title") {
      suggestions = await Job.aggregate([
        {
          $match: {
            $text: { $search: value.query },
            status: "active",
            isDeleted: false,
            "dates.expires": { $gt: new Date() },
          },
        },
        { $group: { _id: "$title", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: "$_id" } },
      ]);
    } else if (type === "company") {
      suggestions = await Job.aggregate([
        {
          $match: {
            $text: { $search: value.query },
            status: "active",
            isDeleted: false,
            "dates.expires": { $gt: new Date() },
          },
        },
        { $group: { _id: "$companyName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: "$_id" } },
      ]);
    } else if (type === "skills") {
      suggestions = await Job.aggregate([
        {
          $match: {
            "skills.name": { $regex: value.query, $options: "i" },
            status: "active",
            isDeleted: false,
            "dates.expires": { $gt: new Date() },
          },
        },
        { $unwind: "$skills" },
        { $group: { _id: "$skills.name", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: "$_id" } },
      ]);
    } else {
      suggestions = await Job.aggregate([
        {
          $match: {
            $text: { $search: value.query },
            status: "active",
            isDeleted: false,
            "dates.expires": { $gt: new Date() },
          },
        },
        {
          $project: {
            terms: {
              $concatArrays: ["$title", "$skills.name", ["$companyName"]],
            },
          },
        },
        { $unwind: "$terms" },
        { $group: { _id: "$terms", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: "$_id" } },
      ]);
    }

    const suggestionValues = suggestions.map((s) => s.value);
    await redisClient.set(
      cacheKey,
      JSON.stringify(suggestionValues),
      "EX",
      3600
    ); // Cache for 1 hour

    await redisClient.zIncrBy('trending:searches', 1, value.query);

    JobEventService.emit("analytics:autocomplete", {
      userId,
      type,
      query: value.query,
      suggestionCount: suggestionValues.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Autocomplete suggestions retrieved`, {
      userId,
      query: value.query,
      type,
      count: suggestionValues.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.AUTOCOMPLETE_RETRIEVED,
        data: { suggestions: suggestionValues },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to retrieve autocomplete suggestions: ${error.message}`,
      {
        userId,
        query,
        type,
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

// GET /jobs/recent-searches - Fetch user's recent searches
export const getRecentSearches = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "User authentication is required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    const searches = await redisClient.lRange(
      `recent:searches:${userId}`,
      0,
      9
    );
    const parsedSearches = searches.map((s) => JSON.parse(s));

    logger.info(`[${requestId}] Recent searches retrieved`, {
      userId,
      count: parsedSearches.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.RECENT_SEARCHES_RETRIEVED,
        data: { searches: parsedSearches },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to retrieve recent searches: ${error.message}`,
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

//GET /jobs/search/location
export const searchJobsByLocation = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, limit = 20 } = req.query;

  try {

    const sanitizedInput = sanitizeInput({ query, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    const jobs = await Job.find({
      location: { $regex: value.query, $options: 'i' },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    })
      .limit(parseInt(value.limit))
      .exec();

    // Increment score for the location query in trending:searches
    await redisClient.zIncrBy('trending:searches', 1, value.query);

    // Store search in Redis for recent searches (if authenticated)
    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: 'location',
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9); // Keep last 10 searches
    }

    // Emit search event for Kafka
    JobEventService.emit('analytics:search', {
      userId,
      type: 'location',
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Jobs retrieved by location`, {
      userId,
      location: value.query, // Log as query since that's the parameter used
      count: jobs.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: { jobs },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to retrieve jobs by location: ${error.message}`,
      {
        userId,
        location: query,
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

// GET /jobs/search/suggestions - Get search suggestions based on partial query
export const getSearchSuggestions = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, limit = 10 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // Assuming text index on title, company, etc. Use aggregation for suggestions (distinct titles starting with query)
    const suggestions = await Job.aggregate([
      {
        $match: {
          title: { $regex: `^${value.query}`, $options: "i" },
          status: "active",
          isDeleted: false,
          "dates.expires": { $gt: new Date() },
        },
      },
      { $group: { _id: "$title" } },
      { $limit: parseInt(value.limit) },
      { $project: { _id: 0, suggestion: "$_id" } },
    ]);

    // Emit event
    JobEventService.emit("analytics:suggestions", {
      userId,
      query: value.query,
      resultCount: suggestions.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Search suggestions retrieved`, {
      userId,
      query: value.query,
      count: suggestions.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.SUGGESTIONS_RETRIEVED,
        data: { suggestions },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to get search suggestions: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/search/any - Search jobs across any field
export const searchJobsAnyField = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // Perform text search across indexed fields (assume text index on title, description, company, etc.)
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType createdAt")
      .sort({ score: { $meta: "textScore" } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "any",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "any",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Any field search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs any field: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/search/trending - Get trending searches
export const getTrendingSearches = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { limit = 10 } = req.query;

  try {
    // Ensure Redis client is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info(`[${requestId}] Redis client connected`);
    }

    const sanitizedInput = sanitizeInput({ limit });

    // Fetch trending searches from Redis sorted set 'trending:searches'
    const trending = await redisClient.zRangeWithScores(
      'trending:searches',
      0,
      parseInt(sanitizedInput.limit) - 1,
      { REV: true } // Reverse to get highest scores first
    );

    const formattedTrending = trending.map((item) => ({
      query: item.value,
      score: item.score,
    }));

    // Emit Kafka event for analytics
    JobEventService.emit('analytics:trending', {
      userId,
      type: 'trending',
      queries: formattedTrending.map((item) => item.query),
      resultCount: formattedTrending.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async trending event failed`, { err })
    );

    logger.info(`[${requestId}] Trending searches retrieved`, {
      userId,
      count: formattedTrending.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.TRENDING_RETRIEVED,
        data: { trending: formattedTrending },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to get trending searches: ${error.message}`,
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

// GET /jobs/search/saved - Get saved searches (assuming user authentication required)
export const getSavedSearches = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { limit = 10 } = req.query;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      new CustomError({
        success: false,
        message: 'Authentication required',
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

    const sanitizedInput = sanitizeInput({ limit });

    // Fetch saved searches from Redis list 'saved:searches:userId'
    const saved = await redisClient.lRange(`saved:searches:${userId}`, 0, parseInt(sanitizedInput.limit) - 1);
    const parsedSaved = saved.map((item) => JSON.parse(item));

    // Emit Kafka event for analytics
    JobEventService.emit('analytics:saved_searches', {
      userId,
      type: 'saved_searches',
      queries: parsedSaved.map((item) => item.query),
      resultCount: parsedSaved.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async saved searches event failed`, { err })
    );

    logger.info(`[${requestId}] Saved searches retrieved`, {
      userId,
      count: parsedSaved.length,
      limit: parseInt(sanitizedInput.limit),
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.SAVED_RETRIEVED,
        data: { saved: parsedSaved },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to get saved searches: ${error.message}`,
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

// GET /jobs/search/exclude - Search jobs excluding keywords
export const searchJobsExcludeKeywords = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // MongoDB text search supports exclusion with -keyword in query
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType createdAt")
      .sort({ score: { $meta: "textScore" } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "exclude",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "exclude",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Exclude keywords search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs exclude keywords: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/search/natural - Natural language search for jobs
export const searchJobsNaturalLanguage = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // Use standard text search for natural language (assume advanced parsing if using Atlas Search)
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType createdAt")
      .sort({ score: { $meta: "textScore" } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $text: { $search: value.query },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "natural",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "natural",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Natural language search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs natural language: ${error.message}`,
      {
        userId,
        query,
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

// GET /jobs/search/history - Get search history (longer term, assume stored in Redis with more retention)
export const getSearchHistory = async (req, res) => {
  const requestId = uuidv4();
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
    // Assuming history in Redis list 'history:searches:userId' (populated similarly but with longer trim, e.g., 99)
    const history = await redisClient.lRange(
      `history:searches:${userId}`,
      0,
      -1
    );
    const parsedHistory = history.map((item) => JSON.parse(item));

    logger.info(`[${requestId}] Search history retrieved`, {
      userId,
      count: parsedHistory.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.HISTORY_RETRIEVED,
        data: { history: parsedHistory },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to get search history: ${error.message}`,
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

// GET /jobs/search/similar - Search similar jobs based on a jobId
export const searchSimilarJobs = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { jobId, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ jobId, page, limit });
    // Assume validateSearchInput handles jobId as string
    const { error, value } = validateSearchInput(sanitizedInput);
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

    const baseJob = await Job.findOne({
      jobId: value.jobId,
      status: "active",
      isDeleted: false,
    });
    if (!baseJob) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: ERROR_MESSAGES.JOBS_NOT_FOUND,
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    // Find similar by title text search or skills match (assume skills is array)
    const jobs = await Job.find({
      $or: [
        { $text: { $search: baseJob.title } },
        { skills: { $in: baseJob.skills } },
      ],
      jobId: { $ne: value.jobId },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType createdAt")
      .sort({ score: { $meta: "textScore" } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $or: [
        { $text: { $search: baseJob.title } },
        { skills: { $in: baseJob.skills } },
      ],
      jobId: { $ne: value.jobId },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "similar",
          jobId: value.jobId,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "similar",
      jobId: value.jobId,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Similar jobs search completed`, {
      userId,
      jobId: value.jobId,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search similar jobs: ${error.message}`,
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

// GET /jobs/search/exact - Exact phrase search for jobs
export const searchJobsExactPhrase = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
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

    // Exact phrase using quotes in text search
    const jobs = await Job.find({
      $text: { $search: `"${value.query}"` },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .select("jobId title companyId location jobType createdAt")
      .sort({ score: { $meta: "textScore" } })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      $text: { $search: `"${value.query}"` },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "exact",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit("analytics:search", {
      userId,
      type: "exact",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch((err) =>
      logger.error(`[${requestId}] Async event failed`, { err })
    );

    logger.info(`[${requestId}] Exact phrase search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: {
          jobs,
          pagination: {
            page: parseInt(value.page),
            limit: parseInt(value.limit),
            total,
            totalPages: Math.ceil(total / parseInt(value.limit)),
          },
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to search jobs exact phrase: ${error.message}`,
      {
        userId,
        query,
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
