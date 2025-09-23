import Joi from 'joi';
import { HTTP_STATUS } from '../constants/http.js';
import CustomError from '../utils/CustomError.js';
import JobApplication from '../model/jobApplication.model.js';

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

// Validation schema for applying to a job (POST /jobs/:jobId/apply)
export function validateApplyJobInput(input) {
  const schema = Joi.object({
    jobId: Joi.string()
      .pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      .required()
      .messages({
        'string.pattern.base': 'Invalid job ID format',
        'any.required': 'Job ID is required',
      }),
    userId: Joi.string()
      .pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      .required()
      .messages({
        'string.pattern.base': 'Invalid user ID format',
        'any.required': 'User ID is required',
      }),
    companyId: Joi.string()
      .pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      .required()
      .messages({
        'string.pattern.base': 'Invalid company ID format',
        'any.required': 'Company ID is required',
      }),
    resumeVersion: Joi.string()
      .pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'Invalid resume ID format',
      }),
    coverLetter: Joi.string()
      .max(2000)
      .optional()
      .allow('')
      .custom((value, helpers) => {
        if (value && /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(value)) {
          return helpers.error('string.unsafe');
        }
        return value;
      })
      .messages({
        'string.max': 'Cover letter must not exceed 2000 characters',
        'string.unsafe': 'Cover letter contains unsafe content',
      }),
    source: Joi.string()
      .valid('direct', 'linkedin', 'referral', 'job-board')
      .default('direct')
      .messages({
        'any.only': 'Invalid source value',
      }),
  });

  return schema.validate(input, { abortEarly: false });
}

// Validation schema for updating application status (PATCH /applications/:applicationId/status)
export function validateUpdateApplicationStatus(input) {
  const schema = Joi.object({
    status: Joi.string()
      .valid('submitted', 'reviewed', 'shortlisted', 'interviewed', 'rejected', 'hired')
      .required()
      .messages({
        'any.only': 'Invalid status value',
        'any.required': 'Status is required',
      }),
  });

  return schema.validate(input, { abortEarly: false });
}

// *VALIDATE RESUME SELECTION INPUT*
export const validateResumeSelectionInput = async (input) => {
  const schema = Joi.object({
    userId: objectIdSchema.required().messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required'
    }),
    applicationId: objectIdSchema.required().messages({
      'string.empty': 'Application ID is required',
      'any.required': 'Application ID is required'
    }),
    resumeUrl: urlSchema.required().messages({
      'any.required': 'Resume URL is required'
    })
  });

  const result = schema.validate(input, { abortEarly: false });
  if (result.error) return result;

  // Async validation to ensure application exists and belongs to the user
  try {
    const application = await JobApplication.findOne({ _id: input.applicationId, userId: input.userId });
    if (!application) {
      return {
        error: new CustomError({
          success: false,
          message: 'Application not found or unauthorized',
          statusCode: HTTP_STATUS.NOT_FOUND
        })
      };
    }
    return result;
  } catch (error) {
    return {
      error: new CustomError({
        success: false,
        message: 'Validation error during database check',
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: error.message
      })
    };
  }
};

// *VALIDATE COVER LETTER INPUT*
export const validateCoverLetterInput = async (input) => {
  const schema = Joi.object({
    userId: objectIdSchema.required().messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required'
    }),
    applicationId: objectIdSchema.required().messages({
      'string.empty': 'Application ID is required',
      'any.required': 'Application ID is required'
    }),
    coverLetter: Joi.string().min(50).max(5000).required().messages({
      'string.base': 'Cover letter must be a string',
      'string.min': 'Cover letter must be at least 50 characters',
      'string.max': 'Cover letter cannot exceed 5000 characters',
      'any.required': 'Cover letter is required'
    })
  });

  const result = schema.validate(input, { abortEarly: false });
  if (result.error) return result;

  // Async validation to ensure application exists and belongs to the user
  try {
    const application = await JobApplication.findOne({ _id: input.applicationId, userId: input.userId });
    if (!application) {
      return {
        error: new CustomError({
          success: false,
          message: 'Application not found or unauthorized',
          statusCode: HTTP_STATUS.NOT_FOUND
        })
      };
    }
    return result;
  } catch (error) {
    return {
      error: new CustomError({
        success: false,
        message: 'Validation error during database check',
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: error.message
      })
    };
  }
};