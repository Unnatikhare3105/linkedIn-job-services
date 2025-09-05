
import Joi from 'joi';
import { HTTP_STATUS } from '../constants/http.js';
import CustomError from '../utils/CustomError.js';
import UserActivity from '../models/UserActivity.js';

export const validateSearchInput = (input) => {
  const schema = Joi.object({
    query: Joi.string().min(1).max(200).required().messages({
      'string.empty': 'Search query cannot be empty',
      'string.min': 'Search query must be at least 1 character',
      'string.max': 'Search query cannot exceed 200 characters',
      'any.required': 'Search query is required',
    }),
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    filters: Joi.object({
      location: Joi.array().items(Joi.string()).max(10),
      skills: Joi.array().items(Joi.string()).max(20),
      experience: Joi.array().items(Joi.string().valid('entry', 'mid', 'senior', 'lead', 'executive')),
      jobType: Joi.array().items(Joi.string().valid('full-time', 'part-time', 'contract', 'freelance', 'internship')),
      salary: Joi.object({
        min: Joi.number().min(0),
        max: Joi.number().min(0)
      }),
      remote: Joi.boolean(),
      companySize: Joi.array().items(Joi.string().valid('startup', 'small', 'medium', 'large', 'enterprise')),
      postedDate: Joi.string().valid('24h', '3d', '7d', '14d', '30d')
    }).default({}),
    sort: Joi.string().valid('relevance', 'date', 'salary', 'company').default('relevance'),
    personalize: Joi.boolean().default(true)
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for skills search
export const validateSkillsSearchInput = (input) => {
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




// Helper to validate MongoDB ObjectId
const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

// Helper to validate URLs (for resume links or file paths)
const urlSchema = Joi.string()
  .uri({ scheme: ['http', 'https', 's3'] }) // Allow HTTP, HTTPS, or S3 URLs
  .max(2000)
  .messages({
    'string.uri': 'Resume must be a valid URL (http, https, or s3)',
    'string.max': 'Resume URL cannot exceed 2000 characters'
  });

// *VALIDATE RECENTLY VIEWED INPUT*
export const validateRecentlyViewedInput = async (input) => {
  const schema = Joi.object({
    userId: objectIdSchema.required().messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required'
    }),
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    sortBy: Joi.string().valid('createdAt', 'title', 'salary').default('createdAt').messages({
      'string.base': 'SortBy must be a string',
      'any.only': 'SortBy must be one of: createdAt, title, salary'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
      'string.base': 'SortOrder must be a string',
      'any.only': 'SortOrder must be one of: asc, desc'
    })
  });

  const result = schema.validate(input, { abortEarly: false });
  if (result.error) return result;

  // Async validation to ensure user has activity records
  try {
    const hasActivity = await UserActivity.exists({ userId: input.userId, type: 'view', entityType: 'job' });
    if (!hasActivity) {
      return {
        error: new CustomError({
          success: false,
          message: 'No job view activity found for user',
          statusCode: HTTP_STATUS.NOT_FOUND
        })
      };
    }
    return result;
  } catch (error) {
    return {
      error: new CustomError({
        success: false,
        message: 'Validation error during activity check',
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: error.message
      })
    };
  }
};

// *VALIDATE OFFLINE JOBS INPUT*
export const validateOfflineJobsInput = (input) => {
  const schema = Joi.object({
    userId: objectIdSchema.required().messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required'
    }),
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    sortBy: Joi.string().valid('createdAt', 'title', 'salary').default('createdAt').messages({
      'string.base': 'SortBy must be a string',
      'any.only': 'SortBy must be one of: createdAt, title, salary'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
      'string.base': 'SortOrder must be a string',
      'any.only': 'SortOrder must be one of: asc, desc'
    }),
    jobType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').optional().messages({
      'string.base': 'JobType must be a string',
      'any.only': 'JobType must be one of: full-time, part-time, contract, internship'
    }),
    location: Joi.string().max(100).optional().messages({
      'string.base': 'Location must be a string',
      'string.max': 'Location cannot exceed 100 characters'
    })
  });

  return schema.validate(input, { abortEarly: false });
};

// *VALIDATE PUSH NOTIFICATION INPUT*
export const validatePushNotificationInput = (input) => {
  const schema = Joi.object({
    userId: objectIdSchema.required().messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required'
    }),
    message: Joi.string().min(10).max(255).required().messages({
      'string.base': 'Message must be a string',
      'string.min': 'Message must be at least 10 characters',
      'string.max': 'Message cannot exceed 255 characters',
      'any.required': 'Message is required'
    }),
    type: Joi.string().valid('job_alert', 'application_update', 'reminder').default('job_alert').messages({
      'string.base': 'Type must be a string',
      'any.only': 'Type must be one of: job_alert, application_update, reminder'
    }),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium').messages({
      'string.base': 'Priority must be a string',
      'any.only': 'Priority must be one of: low, medium, high'
    })
  });

  return schema.validate(input, { abortEarly: false });
};