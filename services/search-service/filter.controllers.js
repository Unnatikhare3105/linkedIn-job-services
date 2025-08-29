// controllers/filterController.js
// Production-ready filter controllers for job platform
// Optimized for scalability with 10M users:
// - Uses MongoDB indexes for efficient filtering
// - Redis caching for frequently accessed filter results
// - Kafka events for filter analytics
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

// Validation schema for location filter
const validateLocationFilterInput = (input) => {
  const schema = Joi.object({
    city: Joi.string().max(100).optional().allow(''),
    state: Joi.string().max(100).optional().allow(''),
    remote: Joi.boolean().optional().default(false),
    nearMe: Joi.string().optional().allow(''), // Format: "lat,lng,radius" (e.g., "40.7128,-74.0060,50")
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for salary filter
const validateSalaryFilterInput = (input) => {
  const schema = Joi.object({
    minSalary: Joi.number().min(0).optional(),
    maxSalary: Joi.number().min(0).optional(),
    range: Joi.string().valid('0-50k', '50k-100k', '100k-150k', '150k+').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }).xor('range', 'minSalary'); // Either range or minSalary/maxSalary
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for job type filter
const validateJobTypeFilterInput = (input) => {
  const schema = Joi.object({
    jobType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship', 'temporary').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for experience filter

const validateExperienceFilterInput = (input) => {
  const schema = Joi.object({
    experienceLevel: Joi.string().valid('fresher', 'mid-level', 'senior', 'executive').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for industry filter
const validateIndustryFilterInput = (input) => {
  const schema = Joi.object({
    industry: Joi.string().valid('tech', 'healthcare', 'finance', 'education', 'retail', 'manufacturing').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for skills filter
const validateSkillsFilterInput = (input) => {
  const schema = Joi.object({
    skills: Joi.array().items(Joi.string().min(1).max(50)).min(1).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for education filter
const validateEducationFilterInput = (input) => {
  const schema = Joi.object({
    education: Joi.string().valid('10th', '12th', 'graduate', 'post-graduate', 'phd').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for smart filters
const validateSmartFiltersInput = (input) => {
  const schema = Joi.object({
    datePosted: Joi.string().valid('any', 'past-24h', 'past-week', 'past-month').optional(),
    companySize: Joi.string().valid('small', 'medium', 'large').optional(),
    workMode: Joi.string().valid('remote', 'hybrid', 'onsite').optional(),
    benefits: Joi.array().items(Joi.string().valid('health-insurance', 'retirement-plan', 'paid-leave', 'flexible-hours')).optional(),
    diversityTags: Joi.array().items(Joi.string().valid('women-led', 'minority-led', 'veteran-friendly')).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// GET /jobs/filter/location - Filter jobs by location
export const filterByLocation = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { city, state, remote, nearMe, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ city, state, remote, nearMe, page, limit });
    const { error, value } = validateLocationFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    if (value.city) query['location.city'] = new RegExp(value.city, 'i');
    if (value.state) query['location.state'] = new RegExp(value.state, 'i');
    if (value.remote) query['location.remote'] = true;
    if (value.nearMe) {
      const [lat, lng, radius] = value.nearMe.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
          success: false,
          message: 'Invalid nearMe format. Use lat,lng,radius (e.g., 40.7128,-74.0060,50)',
          statusCode: HTTP_STATUS.BAD_REQUEST,
        }));
      }
      query['location.coordinates'] = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius / 3963.2], // Radius in miles
        },
      };
    }

    const cacheKey = `filter:location:${JSON.stringify({ city: value.city, state: value.state, remote: value.remote, nearMe: value.nearMe, page: value.page, limit: value.limit })}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Location filter results from cache`, {
        userId,
        query: value,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800); // Cache for 30 minutes

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'location',
      query: value,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Location filter completed`, {
      userId,
      query: value,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by location: ${error.message}`, {
      userId,
      query: { city, state, remote, nearMe },
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

// GET /jobs/filter/salary - Filter jobs by salary
export const filterBySalary = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { minSalary, maxSalary, range, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ minSalary, maxSalary, range, page, limit });
    const { error, value } = validateSalaryFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    if (value.range) {
      const [min, max] = value.range.split('-').map(s => s === '50k' ? 50000 : s === '100k' ? 100000 : s === '150k' ? 150000 : Infinity);
      query['salary.min'] = { $gte: min };
      if (max !== Infinity) query['salary.max'] = { $lte: max };
    } else {
      if (value.minSalary) query['salary.min'] = { $gte: parseInt(value.minSalary) };
      if (value.maxSalary) query['salary.max'] = { $lte: parseInt(value.maxSalary) };
    }

    const cacheKey = `filter:salary:${JSON.stringify({ minSalary: value.minSalary, maxSalary: value.maxSalary, range: value.range, page: value.page, limit: value.limit })}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Salary filter results from cache`, {
        userId,
        query: value,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId salary jobType createdAt')
      .sort({ 'salary.min': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'salary',
      query: value,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Salary filter completed`, {
      userId,
      query: value,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by salary: ${error.message}`, {
      userId,
      query: { minSalary, maxSalary, range },
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

// GET /jobs/filter/job-type - Filter jobs by job type
export const filterByJobType = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { jobType, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ jobType, page, limit });
    const { error, value } = validateJobTypeFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      jobType: value.jobType,
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    const cacheKey = `filter:jobType:${value.jobType}:${value.page}:${value.limit}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Job type filter results from cache`, {
        userId,
        jobType: value.jobType,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'jobType',
      query: value.jobType,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Job type filter completed`, {
      userId,
      jobType: value.jobType,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by job type: ${error.message}`, {
      userId,
      jobType,
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

// GET /jobs/filter/experience - Filter jobs by experience level
export const filterByExperience = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { experienceLevel, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ experienceLevel, page, limit });
    const { error, value } = validateExperienceFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      'experience.level': value.experienceLevel,
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    const cacheKey = `filter:experience:${value.experienceLevel}:${value.page}:${value.limit}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Experience filter results from cache`, {
        userId,
        experienceLevel: value.experienceLevel,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType experience createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'experience',
      query: value.experienceLevel,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Experience filter completed`, {
      userId,
      experienceLevel: value.experienceLevel,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by experience: ${error.message}`, {
      userId,
      experienceLevel,
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

// GET /jobs/filter/industry - Filter jobs by industry
export const filterByIndustry = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { industry, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ industry, page, limit });
    const { error, value } = validateIndustryFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      industry: value.industry,
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    const cacheKey = `filter:industry:${value.industry}:${value.page}:${value.limit}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Industry filter results from cache`, {
        userId,
        industry: value.industry,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType industry createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'industry',
      query: value.industry,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Industry filter completed`, {
      userId,
      industry: value.industry,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by industry: ${error.message}`, {
      userId,
      industry,
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

// GET /jobs/filter/skills - Filter jobs by skills
export const filterBySkills = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { skills, page = 1, limit = 20 } = req.query;

  try {
    const normalizedSkills = typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills;
    const sanitizedInput = sanitizeInput({ skills: normalizedSkills, page, limit });
    const { error, value } = validateSkillsFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      'skills.name': { $in: value.skills.map(s => new RegExp(s, 'i')) },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    const cacheKey = `filter:skills:${value.skills.sort().join(',')}:${value.page}:${value.limit}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Skills filter results from cache`, {
        userId,
        skills: value.skills,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType skills createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'skills',
      query: value.skills,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Skills filter completed`, {
      userId,
      skills: value.skills,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by skills: ${error.message}`, {
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

// GET /jobs/filter/education - Filter jobs by education level
export const filterByEducation = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { education, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ education, page, limit });
    const { error, value } = validateEducationFilterInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      'requirements.education': value.education,
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    const cacheKey = `filter:education:${value.education}:${value.page}:${value.limit}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Education filter results from cache`, {
        userId,
        education: value.education,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType requirements createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'education',
      query: value.education,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Education filter completed`, {
      userId,
      education: value.education,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to filter jobs by education: ${error.message}`, {
      userId,
      education,
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

// GET /jobs/filter/smart - Apply smart filters
export const applySmartFilters = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;
  const { datePosted, companySize, workMode, benefits, diversityTags, page = 1, limit = 20 } = req.query;

  try {
    const sanitizedInput = sanitizeInput({ datePosted, companySize, workMode, benefits, diversityTags, page, limit });
    const { error, value } = validateSmartFiltersInput(sanitizedInput);
    if (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: `Validation error: ${error.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error,
      }));
    }

    const query = {
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() },
    };

    if (value.datePosted && value.datePosted !== 'any') {
      const now = new Date();
      if (value.datePosted === 'past-24h') {
        query['dates.posted'] = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
      } else if (value.datePosted === 'past-week') {
        query['dates.posted'] = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
      } else if (value.datePosted === 'past-month') {
        query['dates.posted'] = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
      }
    }

    if (value.companySize) query['company.size'] = value.companySize;
    if (value.workMode) query['location.workMode'] = value.workMode;
    if (value.benefits && value.benefits.length > 0) query.benefits = { $all: value.benefits };
    if (value.diversityTags && value.diversityTags.length > 0) query.diversityTags = { $all: value.diversityTags };

    const cacheKey = `filter:smart:${JSON.stringify({ datePosted: value.datePosted, companySize: value.companySize, workMode: value.workMode, benefits: value.benefits?.sort(), diversityTags: value.diversityTags?.sort(), page: value.page, limit: value.limit })}`;
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      logger.info(`[${requestId}] Smart filter results from cache`, {
        userId,
        query: value,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
    }

    const jobs = await Job.find(query)
      .select('jobId title companyId location jobType benefits diversityTags createdAt')
      .sort({ 'dates.posted': -1 })
      .skip((parseInt(value.page) - 1) * parseInt(value.limit))
      .limit(parseInt(value.limit))
      .lean();

    const total = await Job.countDocuments(query);

    const response = new CustomSuccess({
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
    });

    await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

    JobEventService.emit('analytics:filter', {
      userId,
      type: 'smart',
      query: value,
      resultCount: jobs.length,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

    logger.info(`[${requestId}] Smart filter completed`, {
      userId,
      query: value,
      count: jobs.length,
      page: value.page,
      limit: value.limit,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Failed to apply smart filters: ${error.message}`, {
      userId,
      query: { datePosted, companySize, workMode, benefits, diversityTags },
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