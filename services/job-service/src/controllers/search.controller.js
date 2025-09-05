import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import CustomError from "../utils/CustomError.js";
import CustomSuccess from "../utils/CustomSuccess.js";
import Job, { JobEventService } from "../model/job.model.js";
// import UserActivity from "../models/UserActivity.js";
import redisClient from "../config/redis.js";
import { sanitizeInput } from "../utils/security.js";
import {
  buildRecentlyViewedQuery,
  getSortOptions,
  SearchEventService,
  SearchStatsService,
  SearchVectorService,
  SearchIndexMonitoringService,
  SearchMaintenanceService,
  AdvancedSearchEngine,
  AnalyticsProcessor,
  RecommendationEngine,
  RecommendationUtils
} from "../services/search.services.js";
import {
  validateSearchInput,
  validateSkillsSearchInput,
  validateRecentlyViewedInput,
  validateOfflineJobsInput,
} from "../validations/search.validations.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/http.js";
import SearchHistory, {
  searchDuration,
  searchRequests,
  activeSearches,
  CacheManager,
  PersonalizationEngine
} from "../model/searchHistory.model.js";

// GET /jobs/search/advanced - Advanced unified search
export const advancedJobSearch = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const userType = req.user?.subscription || "free";

  activeSearches.inc();
  const endTimer = searchDuration.startTimer({
    search_type: "advanced",
    status: "pending",
    user_type: userType,
  });

  try {
    // Validate input
    const sanitizedInput = sanitizeInput(req.query);
    const { error, value } = validateAdvancedSearchInput(sanitizedInput);
    if (error) {
      searchRequests.inc({
        search_type: "advanced",
        status: "validation_error",
      });
      endTimer({ status: "validation_error" });
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

    const { query, page, limit, filters, sort, personalize } = value;

    // Check cache first
    const cacheKey = `search:${JSON.stringify({
      query,
      page,
      limit,
      filters,
      sort,
    })}`;
    let result = await CacheManager.getMultiLevel(
      cacheKey,
      personalize ? userId : null
    );

    if (result) {
      logger.info(`[${requestId}] Advanced search from cache`, {
        userId,
        query,
        page,
        limit,
        duration: Date.now() - startTime,
      });
      searchRequests.inc({ search_type: "advanced", status: "cache_hit" });
      endTimer({ status: "cache_hit" });
      activeSearches.dec();
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
          data: result,
        })
      );
    }

    // Get user profile for personalization
    let userProfile = null;
    if (userId && personalize) {
      userProfile = await PersonalizationEngine.getUserProfile(userId);
    }

    // Try Elasticsearch first, fallback to MongoDB
    try {
      result = await esCircuitBreaker.fire(() =>
        AdvancedSearchEngine.searchElasticsearch(
          query,
          filters,
          page,
          limit,
          sort,
          userProfile
        )
      );
      logger.info(`[${requestId}] Search via Elasticsearch successful`);
    } catch (esError) {
      logger.warn(`[${requestId}] Elasticsearch failed, using MongoDB`, {
        error: esError.message,
      });
      result = await dbCircuitBreaker.fire(() =>
        AdvancedSearchEngine.searchMongoDB(
          query,
          filters,
          page,
          limit,
          sort,
          userProfile
        )
      );
    }

    // Sort by personalization score if personalized
    if (userProfile && personalize) {
      result.hits.sort((a, b) => {
        if (sort === "relevance") {
          return (
            b.personalizationScore * 0.3 +
            (b.score || 0) * 0.7 -
            (a.personalizationScore * 0.3 + (a.score || 0) * 0.7)
          );
        }
        return b.personalizationScore - a.personalizationScore;
      });
    }

    const responseData = {
      jobs: result.hits,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNextPage: page < Math.ceil(result.total / limit),
        hasPrevPage: page > 1,
      },
      metadata: {
        searchTime: Date.now() - startTime,
        personalized: !!userProfile,
        source: "elasticsearch", // Could be dynamic
        filters: filters,
        sort: sort,
      },
    };

    // Cache the result
    await CacheManager.setMultiLevel(
      cacheKey,
      responseData,
      personalize ? userId : null
    );

    // Store search in recent searches
    if (userId) {
      await redisCluster.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "advanced",
          query,
          filters,
          timestamp: new Date().toISOString(),
          resultCount: result.total,
        })
      );
      await redisCluster.lTrim(`recent:searches:${userId}`, 0, 19); // Keep last 20
    }

    // Add to analytics buffer
    AnalyticsProcessor.addEvent({
      userId,
      type: "advanced_search",
      query,
      filters,
      resultCount: result.total,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        personalized: !!userProfile,
        searchTime: Date.now() - startTime,
      },
    });

    // Track user activity
    if (userId) {
      UserActivity.create({
        userId,
        type: "search",
        metadata: {
          query,
          filters,
          resultCount: result.total,
          page,
          searchTime: Date.now() - startTime,
        },
      }).catch((err) => logger.error("Acttivity tracking failed", err));
    }

    logger.info(`[${requestId}] Advanced search completed`, {
      userId,
      query,
      filters,
      resultCount: result.total,
      page,
      limit,
      personalized: !!userProfile,
      duration: Date.now() - startTime,
    });

    searchRequests.inc({ search_type: "advanced", status: "success" });
    endTimer({ status: "success" });
    activeSearches.dec();

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
        data: responseData,
      })
    );
  } catch (error) {
    logger.error([`${requestId}`]`Advanced search failed: ${error.message}`, {
      userId,
      query: req.query.query,
      error: error.stack,
      duration: Date.now() - startTime,
    });

    searchRequests.inc({ search_type: "advanced", status: "error" });
    endTimer({ status: "error" });
    activeSearches.dec();

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    );
  }
};

// GET /jobs/recommendations - Personalized job recommendations
export const getJobRecommendations = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { limit = 20, type = "mixed" } = req.query;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      new CustomError({
        success: false,
        message: "Authentication required for recommendations",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
  }

  try {
    // Check cache first
    const cacheKey = `recommendations:${type}:${userId}:${limit}`;
    let recommendations = await CacheManager.getMultiLevel(cacheKey, userId);

    if (recommendations) {
      logger.info(`[${requestId}] Recommendations from cache`, {
        userId,
        type,
        limit,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: "Job recommendations retrieved successfully",
          data: recommendations,
        })
      );
    }

    // Get user profile and generate recommendations
    const userProfile = await PersonalizationEngine.getUserProfile(userId);
    recommendations = await RecommendationEngine.generateRecommendations(
      userId,
      userProfile,
      type,
      limit
    );

    // Cache recommendations
    await CacheManager.setMultiLevel(cacheKey, recommendations, userId);

    // Track recommendation view
    AnalyticsProcessor.addEvent({
      userId,
      type: "recommendation_view",
      recommendationType: type,
      count: recommendations.jobs?.length || 0,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    logger.info(`[${requestId}] Recommendations generated`, {
      userId,
      type,
      count: recommendations.jobs?.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Job recommendations retrieved successfully",
        data: recommendations,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Recommendations failed: ${error.message}`, {
      userId,
      type,
      error: error.stack,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    );
  }
};

// GET /jobs/search/title - Search jobs by title
// Controller: Searches jobs by title
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

    // Increment score for the search query in trending:searches
    await redisClient.zIncrBy("trending:searches", 1, value.query);

    // Store search in Redis for recent searches (if authenticated)
    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "title",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    // Emit search event
    JobEventService.emit("analytics:search", {
      userId,
      type: "title",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
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
// Controller: Searches jobs by company
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
          message: "Search query is required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    // Perform text search on company name (assume companyName field in Job)
    const jobs = await Job.find({
      companyName: { $regex: value.query, $options: "i" },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .limit(parseInt(value.limit))
      .exec();

    const total = await Job.countDocuments({
      companyName: { $regex: value.query, $options: "i" },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    });

    await redisClient.zIncrBy("trending:searches", 1, value.query);

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
// Controller: Searches jobs by skills
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

    await redisClient.zIncrBy("trending:searches", 1, value.skills.join(", "));

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
// Controller: Searches jobs by keyword
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

    await redisClient.zIncrBy("trending:searches", 1, value.query);

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
// Controller: Gets autocomplete suggestions for job search
export const getAutoCompleteSuggestions = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, type = "mixed", limit = 15 } = req.query;

  try {
    if (!query || query.length < 1) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Query parameter is required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    // Check cache
    const cacheKey = `autocomplete:enhanced:${type}:${query}:${limit}`;
    let suggestions = await CacheManager.getMultiLevel(cacheKey, userId);

    if (suggestions) {
      logger.info(`[${requestId}] Enhanced autocomplete from cache`, {
        userId,
        query,
        type,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: SUCCESS_MESSAGES.AUTOCOMPLETE_RETRIEVED,
          data: suggestions,
        })
      );
    }

    // Get user profile for personalization
    let userProfile = null;
    if (userId) {
      userProfile = await PersonalizationEngine.getUserProfile(userId);
    }

    // Generate enhanced suggestions
    suggestions = await this.generateEnhancedSuggestions(
      query,
      type,
      userProfile,
      parseInt(limit)
    );

    // Cache suggestions
    await CacheManager.setMultiLevel(cacheKey, suggestions, userId);

    // Track autocomplete usage
    AnalyticsProcessor.addEvent({
      userId,
      type: "autocomplete",
      query,
      suggestionType: type,
      suggestionCount: suggestions.suggestions?.length || 0,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    logger.info(`[${requestId}] Enhanced autocomplete completed`, {
      userId,
      query,
      type,
      count: suggestions.suggestions?.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: SUCCESS_MESSAGES.AUTOCOMPLETE_RETRIEVED,
        data: suggestions,
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Enhanced autocomplete failed: ${error.message}`,
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
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    );
  }
};

// GET /jobs/recent-searches - Fetch user's recent searches
// Controller: Gets recent job searches for a user
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
// Controller: Searches jobs by location
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
      location: { $regex: value.query, $options: "i" },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    })
      .limit(parseInt(value.limit))
      .exec();

    // Increment score for the location query in trending:searches
    await redisClient.zIncrBy("trending:searches", 1, value.query);

    // Store search in Redis for recent searches (if authenticated)
    if (userId) {
      await redisClient.lPush(
        `recent:searches:${userId}`,
        JSON.stringify({
          type: "location",
          query: value.query,
          timestamp: new Date().toISOString(),
        })
      );
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9); // Keep last 10 searches
    }

    // Emit search event for Kafka
    JobEventService.emit("analytics:search", {
      userId,
      type: "location",
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
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
// Controller: Gets search suggestions for jobs
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
// Controller: Searches jobs by any field
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
// Controller: Gets trending job searches
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
      "trending:searches",
      0,
      parseInt(sanitizedInput.limit) - 1,
      { REV: true } // Reverse to get highest scores first
    );

    const formattedTrending = trending.map((item) => ({
      query: item.value,
      score: item.score,
    }));

    // Emit Kafka event for analytics
    JobEventService.emit("analytics:trending", {
      userId,
      type: "trending",
      queries: formattedTrending.map((item) => item.query),
      resultCount: formattedTrending.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
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
// Controller: Gets saved job searches for a user
export const getSavedSearches = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { limit = 10 } = req.query;

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

    const sanitizedInput = sanitizeInput({ limit });

    // Fetch saved searches from Redis list 'saved:searches:userId'
    const saved = await redisClient.lRange(
      `saved:searches:${userId}`,
      0,
      parseInt(sanitizedInput.limit) - 1
    );
    const parsedSaved = saved.map((item) => JSON.parse(item));

    // Emit Kafka event for analytics
    JobEventService.emit("analytics:saved_searches", {
      userId,
      type: "saved_searches",
      queries: parsedSaved.map((item) => item.query),
      resultCount: parsedSaved.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
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
// Controller: Searches jobs excluding certain keywords
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
// Controller: Searches jobs using natural language
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
// Controller: Gets job search history for a user
export const getSearchHistory = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { period = "30d", limit = 50 } = req.query;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      new CustomError({
        success: false,
        message: "Authentication required for search history",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
  }

  try {
    // Check cache
    const cacheKey = `search:history:${userId}:${period}:${limit}`;
    let analysis = await CacheManager.getMultiLevel(cacheKey, userId);

    if (analysis) {
      logger.info(`[${requestId}] Search history from cache`, {
        userId,
        period,
        limit,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: "Search history analysis retrieved successfully",
          data: analysis,
        })
      );
    }

    // Calculate date range
    const periodDays = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
    const days = periodDays[period] || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get search history
    const searchHistory = await SearchHistory.find({
      userId,
      createdAt: { $gte: startDate },
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Analyze search patterns
    analysis = await this.analyzeSearchHistory(searchHistory, userId);
    analysis.metadata = {
      period,
      totalSearches: searchHistory.length,
      analyzedAt: new Date(),
      dateRange: { start: startDate, end: new Date() },
    };

    // Cache the analysis
    await CacheManager.setMultiLevel(cacheKey, analysis, userId);

    logger.info(`[${requestId}] Search history analysis completed`, {
      userId,
      period,
      searchCount: searchHistory.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Search history analysis retrieved successfully",
        data: analysis,
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Search history analysis failed: ${error.message}`,
      {
        userId,
        period,
        error: error.stack,
        duration: Date.now() - startTime,
      }
    );

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    );
  }
};

// GET /jobs/similar/:jobId - Similar job suggestions
export const searchSimilarJobs = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { jobId } = req.params;
  const { limit = 10 } = req.query;

  try {
    // Validate jobId
    if (!jobId || !ObjectId.isValid(jobId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Valid job ID is required",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    // Check cache
    const cacheKey = `similar:${jobId}:${limit}`;
    let similarJobs = await CacheManager.getMultiLevel(cacheKey);

    if (similarJobs) {
      logger.info(`[${requestId}] Similar jobs from cache`, {
        userId,
        jobId,
        limit,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: "Similar jobs retrieved successfully",
          data: similarJobs,
        })
      );
    }

    // Get the reference job
    const referenceJob = await Job.findById(jobId)
      .select(
        "title skills location companyName jobType experienceLevel salary"
      )
      .lean();

    if (!referenceJob) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          message: "Job not found",
          statusCode: HTTP_STATUS.NOT_FOUND,
        })
      );
    }

    // Find similar jobs using content-based similarity
    const similarJobsQuery = {
      _id: { $ne: new ObjectId(jobId) },
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
    };

    // Add similarity filters
    const orConditions = [];

    // Similar skills
    if (referenceJob.skills?.length) {
      orConditions.push({
        "skills.name": { $in: referenceJob.skills.map((s) => s.name) },
      });
    }

    // Same job type
    if (referenceJob.jobType) {
      orConditions.push({ jobType: referenceJob.jobType });
    }

    // Same location
    if (referenceJob.location?.city) {
      orConditions.push({ "location.city": referenceJob.location.city });
    }

    // Same company (for other positions)
    if (referenceJob.companyName) {
      orConditions.push({ companyName: referenceJob.companyName });
    }

    if (orConditions.length > 0) {
      similarJobsQuery.$or = orConditions;
    }

    const jobs = await Job.find(similarJobsQuery)
      .select(
        "jobId title companyName location salary jobType skills dates.posted remote experienceLevel"
      )
      .sort({ "dates.posted": -1 })
      .limit(parseInt(limit) * 2) // Get more for better similarity scoring
      .lean();

    // Calculate similarity scores
    const jobsWithScores = jobs.map((job) => ({
      ...job,
      similarityScore: this.calculateSimilarityScore(referenceJob, job),
    }));

    // Sort by similarity score and take top results
    const sortedJobs = jobsWithScores
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, parseInt(limit));

    const result = {
      referenceJob: {
        jobId: referenceJob._id,
        title: referenceJob.title,
        companyName: referenceJob.companyName,
      },
      similarJobs: sortedJobs,
      metadata: {
        totalFound: jobs.length,
        algorithm: "content_based_similarity",
        generatedAt: new Date(),
      },
    };

    // Cache the result
    await CacheManager.setMultiLevel(cacheKey, result);

    // Track similar jobs view
    if (userId) {
      AnalyticsProcessor.addEvent({
        userId,
        type: "similar_jobs_view",
        referenceJobId: jobId,
        count: sortedJobs.length,
        metadata: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });
    }

    logger.info(`[${requestId}] Similar jobs retrieved`, {
      userId,
      jobId,
      count: sortedJobs.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Similar jobs retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Similar jobs failed: ${error.message}`, {
      userId,
      jobId,
      error: error.stack,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    );
  }
};

// GET /jobs/search/exact - Exact phrase search for jobs
// Controller: Searches jobs by exact phrase
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

// POST /jobs/bulk-search
// Controller: Performs bulk job search for admin/batch operations
export const bulkSearchJobs = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const isAdmin = req.user?.role === "admin";
  const { queries, filters = {}, limit = 1000 } = req.body;

  // Rate limiting for admin bulk operations
  if (!isAdmin) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      new CustomError({
        success: false,
        message: "Bulk search is restricted to admin users.",
        statusCode: HTTP_STATUS.FORBIDDEN,
      })
    );
  }

  try {
    // Input validation
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Queries array is required for bulk search.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }
    if (queries.length > 1000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: "Bulk search limited to 1000 queries per request.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      );
    }

    // Sanitize input
    const sanitizedQueries = queries.map(q => sanitizeInput(q));
    const sanitizedFilters = sanitizeInput(filters);

    // Check Redis cache for batch results
    const cacheKey = `bulksearch:${JSON.stringify(sanitizedQueries)}:${JSON.stringify(sanitizedFilters)}:${limit}`;
    let cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Bulk search from cache`, {
        userId,
        queries: sanitizedQueries.length,
        filters: sanitizedFilters,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
          message: "Bulk search results retrieved from cache.",
          data: JSON.parse(cachedResults),
        })
      );
    }

    // MongoDB aggregation for batch search
    const aggregationPipeline = [
      {
        $match: {
          $or: sanitizedQueries.map(q => ({
            $text: { $search: q }
          })),
          ...sanitizedFilters,
          status: "active",
          isDeleted: false,
          "dates.expires": { $gt: new Date() }
        }
      },
      {
        $project: {
          jobId: 1,
          title: 1,
          companyName: 1,
          location: 1,
          jobType: 1,
          skills: 1,
          createdAt: 1,
          score: { $meta: "textScore" }
        }
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: parseInt(limit) }
    ];

    const jobs = await Job.aggregate(aggregationPipeline);

    // Cache results in Redis for 10 minutes
    await redisClient.set(cacheKey, JSON.stringify(jobs), { EX: 600 });

    // Emit Kafka event for analytics
    JobEventService.emit("analytics:bulk_search", {
      userId,
      queries: sanitizedQueries,
      filters: sanitizedFilters,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers["user-agent"] },
    }).catch(err => logger.error(`[${requestId}] Bulk search analytics failed`, { err }));

    logger.info(`[${requestId}] Bulk search completed`, {
      userId,
      queries: sanitizedQueries.length,
      filters: sanitizedFilters,
      count: jobs.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Bulk search completed successfully.",
        data: { jobs, total: jobs.length },
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Bulk search failed: ${error.message}`, {
      userId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Bulk search failed due to server error.",
        error: error.message,
      })
    );
  }
};

// *UNIFIED RECENTLY VIEWED JOBS CONTROLLER* (Advanced with personalization, facets, pagination)
export const getRecentlyViewedJobs = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    // *INPUT VALIDATION*
    const sanitizedInput = sanitizeInput(req.query);
    const { error, value } = validateRecentlyViewedInput({
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

    // *PERSONALIZATION*
    let userProfile = null;
    if (userId) {
      userProfile = await PersonalizationEngine.getUserProfile(userId);
    }

    // *CACHE KEY GENERATION*
    const cacheKey = `jobs:recently_viewed:${Buffer.from(
      JSON.stringify({
        ...value,
        userId: userId || "anonymous",
      })
    )
      .toString("base64")
      .slice(0, 200)}`;

    // *CACHE CHECK WITH FALLBACK*
    let cachedResults;
    try {
      cachedResults = await redisClient.get(cacheKey);
    } catch (redisErr) {
      logger.warn(
        `[${requestId}] Redis cache error - falling back to no cache`,
        { error: redisErr.message }
      );
      cachedResults = null;
    }
    if (cachedResults) {
      const parsedResults = JSON.parse(cachedResults);
      logger.info(`[${requestId}] Cache hit for recently viewed jobs`, {
        userId,
        cacheKey: cacheKey.slice(0, 50) + "...",
        resultCount: parsedResults.data?.jobs?.length || 0,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(parsedResults);
    }

    // *QUERY BUILDING*
    const query = buildRecentlyViewedQuery(value, userProfile);
    const sortOptions = getSortOptions(value.sortBy, value.sortOrder);

    // *AGGREGATION PIPELINE FOR PERFORMANCE* (Includes facets for job types, locations, etc.)
    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "jobs",
          localField: "entityId",
          foreignField: "_id",
          as: "job",
          pipeline: [
            {
              $project: {
                title: 1,
                companyId: 1,
                location: 1,
                jobType: 1,
                salary: 1,
                skills: 1,
                features: 1,
                benefits: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$job" },
      { $replaceRoot: { newRoot: "$job" } },
      {
        $facet: {
          jobs: [
            { $sort: sortOptions },
            { $skip: (value.page - 1) * value.limit },
            { $limit: value.limit },
            {
              $project: {
                title: 1,
                companyId: 1,
                location: 1,
                jobType: 1,
                salary: 1,
                skills: { $slice: ["$skills", 5] },
                features: 1,
                benefits: { $slice: ["$benefits", 3] },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
          facets: [
            {
              $group: {
                _id: null,
                jobTypes: { $addToSet: "$jobType" },
                locations: { $addToSet: "$location.city" },
                industries: { $addToSet: "$industry" },
              },
            },
          ],
        },
      },
    ];

    // *EXECUTE AGGREGATION WITH TIMEOUT HANDLING*
    const [results] = await UserActivity.aggregate(aggregationPipeline).option({
      maxTimeMS: 30000,
    });

    const jobs = results.jobs || [];
    const totalCount = results.totalCount[0]?.count || 0;
    const facets = results.facets[0] || {};

    // Integrate SearchVectorService for vector-based personalization if needed
    if (userProfile?.vectorEmbeddings) {
      // Example: Re-rank jobs using vector similarity (assuming SearchVectorService handles this)
      const reRankedJobs = await SearchVectorService.reRankJobs(
        jobs,
        userProfile.vectorEmbeddings
      );
      jobs = reRankedJobs.slice(0, value.limit); // Update jobs with re-ranked
    }

    // *RESPONSE CONSTRUCTION*
    const response = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
      data: {
        jobs,
        pagination: {
          page: value.page,
          limit: value.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / value.limit),
          hasNext: value.page < Math.ceil(totalCount / value.limit),
          hasPrev: value.page > 1,
        },
        facets: {
          jobTypes: facets.jobTypes || [],
          locations: (facets.locations || []).filter(Boolean).slice(0, 20),
          industries: facets.industries || [],
        },
        meta: {
          resultsFound: totalCount,
          searchTime: Date.now() - startTime,
          sortedBy: value.sortBy,
          cached: false,
          userProfileApplied: !!userProfile,
        },
      },
    });

    // *CACHE THE RESULTS WITH ERROR HANDLING*
    const cacheExpiry = 600; // 10min
    try {
      await redisClient.set(
        cacheKey,
        JSON.stringify(response),
        "EX",
        cacheExpiry
      );
    } catch (redisErr) {
      logger.warn(`[${requestId}] Failed to set cache`, {
        error: redisErr.message,
      });
    }

    // *ANALYTICS EVENT (ASYNC)* using SearchEventService (Kafka)
    SearchEventService.emit("analytics:recently_viewed", {
      userId,
      resultCount: jobs.length,
      totalResults: totalCount,
      searchTime: Date.now() - startTime,
      page: value.page,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        cached: false,
      },
    }).catch((err) =>
      logger.error(`[${requestId}] Analytics event failed`, {
        error: err.message,
      })
    );

    // Integrate SearchStatsService for stats update
    await SearchStatsService.updateStats({
      type: "recently_viewed",
      count: jobs.length,
      userId,
    });

    // *SUCCESS LOG*
    logger.info(`[${requestId}] Recently viewed jobs completed successfully`, {
      userId,
      resultCount: jobs.length,
      totalResults: totalCount,
      page: value.page,
      duration: Date.now() - startTime,
      cached: false,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(
      `[${requestId}] Recently viewed jobs failed: ${error.message}`,
      {
        userId,
        error: error.stack,
        query: req.query,
        duration: Date.now() - startTime,
      }
    );

    // Monitor index health with SearchIndexMonitoringService
    SearchIndexMonitoringService.reportError({
      error,
      context: "recently_viewed",
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

// *UNIFIED OFFLINE JOB VIEWING CONTROLLER* (Advanced with personalization, facets, pagination)
export const getOfflineJobs = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    // *INPUT VALIDATION*
    const sanitizedInput = sanitizeInput(req.query);
    const { error, value } = validateOfflineJobsInput({
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

    // *PERSONALIZATION*
    let userProfile = null;
    if (userId) {
      userProfile = await PersonalizationEngine.getUserProfile(userId);
    }

    // *CACHE KEY GENERATION*
    const cacheKey = `jobs:offline:${Buffer.from(
      JSON.stringify({
        ...value,
        userId: userId || "anonymous",
      })
    )
      .toString("base64")
      .slice(0, 200)}`;

    // *CACHE CHECK WITH FALLBACK*
    let cachedResults;
    try {
      cachedResults = await redisClient.get(cacheKey);
    } catch (redisErr) {
      logger.warn(
        `[${requestId}] Redis cache error - falling back to no cache`,
        { error: redisErr.message }
      );
      cachedResults = null;
    }
    if (cachedResults) {
      const parsedResults = JSON.parse(cachedResults);
      logger.info(`[${requestId}] Cache hit for offline jobs`, {
        userId,
        cacheKey: cacheKey.slice(0, 50) + "...",
        resultCount: parsedResults.data?.jobs?.length || 0,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(parsedResults);
    }

    // *QUERY BUILDING*
    let query = {
      status: "active",
      isDeleted: false,
      "dates.expires": { $gt: new Date() },
      offlineAvailable: true,
    };
    if (userProfile?.preferences?.locations) {
      query["location.city"] = { $in: userProfile.preferences.locations };
    }
    const sortOptions = getSortOptions(value.sortBy, value.sortOrder);

    // *AGGREGATION PIPELINE FOR PERFORMANCE*
    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "companyDetails",
          pipeline: [{ $project: { name: 1, logo: 1, rating: 1 } }],
        },
      },
      { $addFields: { company: { $arrayElemAt: ["$companyDetails", 0] } } },
      {
        $facet: {
          jobs: [
            { $sort: sortOptions },
            { $skip: (value.page - 1) * value.limit },
            { $limit: value.limit },
            {
              $project: {
                title: 1,
                companyId: 1,
                "company.name": 1,
                "company.logo": 1,
                location: 1,
                jobType: 1,
                salary: 1,
                skills: { $slice: ["$skills", 5] },
                features: 1,
                benefits: { $slice: ["$benefits", 3] },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
          facets: [
            {
              $group: {
                _id: null,
                jobTypes: { $addToSet: "$jobType" },
                locations: { $addToSet: "$location.city" },
                benefits: { $addToSet: "$benefits" },
              },
            },
          ],
        },
      },
    ];

    // *EXECUTE AGGREGATION WITH TIMEOUT HANDLING*
    const [results] = await Job.aggregate(aggregationPipeline).option({
      maxTimeMS: 30000,
    });

    let jobs = results.jobs || [];
    const totalCount = results.totalCount[0]?.count || 0;
    const facets = results.facets[0] || {};

    // Use SearchMaintenanceService to check if any maintenance affects offline jobs
    const maintenanceStatus = await SearchMaintenanceService.getStatus(
      "offline_jobs"
    );
    if (maintenanceStatus.active) {
      jobs = []; // Or handle accordingly
      logger.warn(`[${requestId}] Offline jobs under maintenance`);
    }

    // *RESPONSE CONSTRUCTION*
    const response = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
      data: {
        jobs,
        pagination: {
          page: value.page,
          limit: value.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / value.limit),
          hasNext: value.page < Math.ceil(totalCount / value.limit),
          hasPrev: value.page > 1,
        },
        facets: {
          jobTypes: facets.jobTypes || [],
          locations: (facets.locations || []).filter(Boolean).slice(0, 20),
          benefits: (facets.benefits || []).filter(Boolean).slice(0, 20),
        },
        meta: {
          resultsFound: totalCount,
          searchTime: Date.now() - startTime,
          sortedBy: value.sortBy,
          cached: false,
          userProfileApplied: !!userProfile,
        },
      },
    });

    // *CACHE THE RESULTS WITH ERROR HANDLING*
    const cacheExpiry = 600; // 10min
    try {
      await redisClient.set(
        cacheKey,
        JSON.stringify(response),
        "EX",
        cacheExpiry
      );
    } catch (redisErr) {
      logger.warn(`[${requestId}] Failed to set cache`, {
        error: redisErr.message,
      });
    }

    // *ANALYTICS EVENT (ASYNC)*
    SearchEventService.emit("analytics:offline_jobs", {
      userId,
      resultCount: jobs.length,
      totalResults: totalCount,
      searchTime: Date.now() - startTime,
      page: value.page,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        cached: false,
      },
    }).catch((err) =>
      logger.error(`[${requestId}] Analytics event failed`, {
        error: err.message,
      })
    );

    // Update stats
    await SearchStatsService.updateStats({
      type: "offline_jobs",
      count: jobs.length,
      userId,
    });

    // *SUCCESS LOG*
    logger.info(`[${requestId}] Offline jobs completed successfully`, {
      userId,
      resultCount: jobs.length,
      totalResults: totalCount,
      page: value.page,
      duration: Date.now() - startTime,
      cached: false,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Offline jobs failed: ${error.message}`, {
      userId,
      error: error.stack,
      query: req.query,
      duration: Date.now() - startTime,
    });

    SearchIndexMonitoringService.reportError({
      error,
      context: "offline_jobs",
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
