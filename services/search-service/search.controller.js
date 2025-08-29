// controllers/searchController.js
// Production-ready search controllers for job platform
// Optimized for scalability with 10M users:
// - Uses MongoDB text indexes for efficient search
// - Redis caching for autocomplete and recent searches
// - Kafka events for search analytics
// - Input sanitization and validation for security
// - Pagination for large result sets
// - Recommendations: Redis rate limiting, monitor with Prometheus, scale with PM2

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/http.js';
import { CustomError, CustomSuccess } from '../utils/customResponses.js';
import Job from '../models/Job.js'; // Assume Job model exists
import JobEventService from '../services/JobEventService.js'; // From previous code
import StatsService from '../services/StatsService.js'; // From previous code
import redisClient from '../config/redis.js';
import { sanitizeInput } from '../utils/validation.js'; // From previous code
import Joi from 'joi';



// constants/http.js
export const SUCCESS_MESSAGES = {
  // ... other messages
  JOBS_RETRIEVED: 'Jobs retrieved successfully',
  AUTOCOMPLETE_RETRIEVED: 'Autocomplete suggestions retrieved successfully',
  RECENT_SEARCHES_RETRIEVED: 'Recent searches retrieved successfully',
};

export const ERROR_MESSAGES = {
  // ... other messages
  JOBS_NOT_FOUND: 'No jobs found',
  AUTOCOMPLETE_NOT_FOUND: 'No autocomplete suggestions found',
  RECENT_SEARCHES_NOT_FOUND: 'No recent searches found',
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

// Validation schema for search queries
const validateSearchInput = (input) => {
  const schema = Joi.object({
    query: Joi.string().min(1).max(100).required().messages({
      'string.empty': 'Search query cannot be empty',
      'string.min': 'Search query must be at least 1 character',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required',
    }),
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for skills search
const validateSkillsSearchInput = (input) => {
  const schema = Joi.object({
    skills: Joi.array().items(Joi.string().min(1).max(50)).min(1).required().messages({
      'array.min': 'At least one skill is required',
      'string.empty': 'Skill cannot be empty',
      'string.max': 'Skill cannot exceed 50 characters',
      'any.required': 'Skills are required',
    }),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// GET /jobs/search/title - Search jobs by title
export const searchJobsByTitle = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, page = 1, limit = 20 } = req.query;

  try {
    // Validate input
    const sanitizedInput = sanitizeInput({ query, page, limit });
    const { error, value } = validateSearchInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
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

    // Store search in Redis for recent searches (if authenticated)
    if (userId) {
      await redisClient.lPush(`recent:searches:${userId}`, JSON.stringify({
        type: 'title',
        query: value.query,
        timestamp: new Date().toISOString(),
      }));
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9); // Keep last 10 searches
    }

    // Emit search event
    JobEventService.emit('analytics:search', {
      userId,
      type: 'title',
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Job title search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
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
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to search jobs by title: ${error.message}`, {
      userId,
      query,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message,
    }));
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    // Perform text search on company name (assume companyName field in Job)
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    })
      .select('jobId title companyId companyName location jobType createdAt')
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

    if (userId) {
      await redisClient.lPush(`recent:searches:${userId}`, JSON.stringify({
        type: 'company',
        query: value.query,
        timestamp: new Date().toISOString(),
      }));
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit('analytics:search', {
      userId,
      type: 'company',
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Job company search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
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
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to search jobs by company: ${error.message}`, {
      userId,
      query,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message,
    }));
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
    const normalizedSkills = typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills;
    const sanitizedInput = sanitizeInput({ skills: normalizedSkills, page, limit });
    const { error, value } = validateSkillsSearchInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    // Search jobs with matching skills
    const jobs = await Job.find({
      'skills.name': { $in: value.skills.map(s => new RegExp(s, 'i')) },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    })
      .select('jobId title companyId location jobType skills createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments({
      'skills.name': { $in: value.skills.map(s => new RegExp(s, 'i')) },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    });

    if (userId) {
      await redisClient.lPush(`recent:searches:${userId}`, JSON.stringify({
        type: 'skills',
        query: value.skills.join(', '),
        timestamp: new Date().toISOString(),
      }));
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit('analytics:search', {
      userId,
      type: 'skills',
      query: value.skills.join(', '),
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Job skills search completed`, {
      userId,
      skills: value.skills,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
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
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to search jobs by skills: ${error.message}`, {
      userId,
      skills,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message,
    }));
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    // Search across multiple fields using text index
    const jobs = await Job.find({
      $text: { $search: value.query },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    })
      .select('jobId title companyId location jobType skills createdAt')
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

    if (userId) {
      await redisClient.lPush(`recent:searches:${userId}`, JSON.stringify({
        type: 'keyword',
        query: value.query,
        timestamp: new Date().toISOString(),
      }));
      await redisClient.lTrim(`recent:searches:${userId}`, 0, 9);
    }

    JobEventService.emit('analytics:search', {
      userId,
      type: 'keyword',
      query: value.query,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Keyword search completed`, {
      userId,
      query: value.query,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
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
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to search jobs by keyword: ${error.message}`, {
      userId,
      query,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message,
    }));
  }
};

// GET /jobs/autocomplete - Get autocomplete suggestions
export const getAutoCompleteSuggestions = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { query, type = 'keyword', limit = 10 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ query, limit });
    const { error, value } = validateSearchInput({ ...sanitizedInput, page: 1 });
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
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
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        message: SUCCESS_MESSAGES.AUTOCOMPLETE_RETRIEVED,
        data: { suggestions: JSON.parse(cachedSuggestions) },
      }));
    }

    let suggestions = [];
    if (type === 'title') {
      suggestions = await Job.aggregate([
        {
          $match: {
            $text: { $search: value.query },
            status: 'active',
            isDeleted: false,
            'dates.expires': { $gt: new Date() },
          },
        },
        { $group: { _id: '$title', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: '$_id' } },
      ]);
    } else if (type === 'company') {
      suggestions = await Job.aggregate([
        {
          $match: {
            $text: { $search: value.query },
            status: 'active',
            isDeleted: false,
            'dates.expires': { $gt: new Date() },
          },
        },
        { $group: { _id: '$companyName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: '$_id' } },
      ]);
    } else if (type === 'skills') {
      suggestions = await Job.aggregate([
        {
          $match: {
            'skills.name': { $regex: value.query, $options: 'i' },
            status: 'active',
            isDeleted: false,
            'dates.expires': { $gt: new Date() },
          },
        },
        { $unwind: '$skills' },
        { $group: { _id: '$skills.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: '$_id' } },
      ]);
    } else {
      suggestions = await Job.aggregate([
        {
          $match: {
            $text: { $search: value.query },
            status: 'active',
            isDeleted: false,
            'dates.expires': { $gt: new Date() },
          },
        },
        {
          $project: {
            terms: { $concatArrays: ['$title', '$skills.name', ['$companyName']] },
          },
        },
        { $unwind: '$terms' },
        { $group: { _id: '$terms', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(value.limit) },
        { $project: { _id: 0, value: '$_id' } },
      ]);
    }

    const suggestionValues = suggestions.map(s => s.value);
    await redisClient.set(cacheKey, JSON.stringify(suggestionValues), 'EX', 3600); // Cache for 1 hour

    JobEventService.emit('analytics:autocomplete', {
      userId,
      type,
      query: value.query,
      suggestionCount: suggestionValues.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Autocomplete suggestions retrieved`, {
      userId,
      query: value.query,
      type,
      count: suggestionValues.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
      message: SUCCESS_MESSAGES.AUTOCOMPLETE_RETRIEVED,
      data: { suggestions: suggestionValues },
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to retrieve autocomplete suggestions: ${error.message}`, {
      userId,
      query,
      type,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message,
    }));
  }
};

// GET /jobs/recent-searches - Fetch user's recent searches
export const getRecentSearches = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    if (!userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: 'User authentication is required',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      }));
    }

    const searches = await redisClient.lRange(`recent:searches:${userId}`, 0, 9);
    const parsedSearches = searches.map(s => JSON.parse(s));

    logger.info(`[${requestId}] Recent searches retrieved`, {
      userId,
      count: parsedSearches.length,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
      message: SUCCESS_MESSAGES.RECENT_SEARCHES_RETRIEVED,
      data: { searches: parsedSearches },
    }));
  } catch (error) {
    logger.error(`[${requestId}] Failed to retrieve recent searches: ${error.message}`, {
      userId,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message,
    }));
  }
};