import Joi from "joi";
import NodeCache from 'node-cache';

const schemaCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 }); // Cache schemas for 1 hour

// UUID pattern for all IDs
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Precompile schemas for performance
const compileSchema = (schema) => {
  const cacheKey = schema.describe().flags?.label || JSON.stringify(schema);
  let compiled = schemaCache.get(cacheKey);
  if (!compiled) {
    compiled = schema.compile();
    schemaCache.set(cacheKey, compiled);
  }
  return compiled;
};

export const validateCompanyId = (data) =>
  Joi.object({
    companyId: Joi.string().uuid().required(),
  }).validate(data);

export const validateReviewInput = (data) =>
  Joi.object({
    userId: Joi.string().uuid().required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(1000).required(),
    role: Joi.string().max(100).required(),
    tenure: Joi.string().max(50).required(),
  }).validate(data);

export const validateUserProfile = (data) => {
  const schema = Joi.object({
    userId: Joi.string().pattern(uuidPattern).required().messages({
      'string.pattern.base': 'User ID valid UUID hona chahiye',
      'any.required': 'User ID zaruri hai'
    }),
    firstName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/).required().messages({
      'string.min': 'First name 2 char se chhota nahi hona chahiye',
      'string.max': 'First name 50 char se bada nahi hona chahiye',
      'string.pattern.base': 'First name mein sirf letters aur spaces allowed hain',
      'any.required': 'First name zaruri hai'
    }),
    lastName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/).required().messages({
      'string.min': 'Last name 2 char se chhota nahi hona chahiye',
      'string.max': 'Last name 50 char se bada nahi hona chahiye',
      'string.pattern.base': 'Last name mein sirf letters aur spaces allowed hain',
      'any.required': 'Last name zaruri hai'
    }),
    email: Joi.string().email({ tlds: { allow: false } }).lowercase().max(100).required().messages({
      'string.email': 'Valid email daal',
      'string.max': 'Email 100 char se bada nahi hona chahiye',
      'any.required': 'Email zaruri hai'
    }),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).max(16).optional().messages({
      'string.pattern.base': 'Valid phone number daal'
    }),
    headline: Joi.string().min(10).max(200).required().messages({
      'string.min': 'Headline 10 char se chhota nahi hona chahiye',
      'string.max': 'Headline 200 char se bada nahi hona chahiye',
      'any.required': 'Headline zaruri hai'
    }),
    summary: Joi.string().min(50).max(1000).optional().messages({
      'string.min': 'Summary 50 char se chhota nahi hona chahiye',
      'string.max': 'Summary 1000 char se bada nahi hona chahiye'
    }),
    location: Joi.object({
      city: Joi.string().min(2).max(50).required(),
      state: Joi.string().min(2).max(50).optional(),
      country: Joi.string().min(2).max(50).required(),
      zipCode: Joi.string().pattern(/^[0-9]{5,10}$/).optional()
    }).required(),
    experience: Joi.array().items(
      Joi.object({
        experienceId: Joi.string().pattern(uuidPattern).required().messages({
          'string.pattern.base': 'Experience ID valid UUID hona chahiye',
          'any.required': 'Experience ID zaruri hai'
        }),
        title: Joi.string().min(2).max(50).required(),
        company: Joi.string().min(2).max(50).required(),
        location: Joi.string().max(50).optional(),
        startDate: Joi.date().max('now').required(),
        endDate: Joi.date().greater(Joi.ref('startDate')).optional(),
        current: Joi.boolean().default(false),
        description: Joi.string().max(500).optional(),
        skills: Joi.array().items(Joi.string().min(2).max(30)).max(10).optional()
      })
    ).min(1).max(5).required(),
    education: Joi.array().items(
      Joi.object({
        educationId: Joi.string().pattern(uuidPattern).required().messages({
          'string.pattern.base': 'Education ID valid UUID hona chahiye',
          'any.required': 'Education ID zaruri hai'
        }),
        institution: Joi.string().min(2).max(50).required(),
        degree: Joi.string().min(2).max(50).required(),
        fieldOfStudy: Joi.string().min(2).max(50).optional(),
        startDate: Joi.date().required(),
        endDate: Joi.date().greater(Joi.ref('startDate')).optional(),
        gpa: Joi.number().min(0).max(4.0).precision(2).optional(),
        description: Joi.string().max(250).optional()
      })
    ).min(1).max(3).required(),
    skills: Joi.array().items(
      Joi.object({
        skillId: Joi.string().pattern(uuidPattern).required().messages({
          'string.pattern.base': 'Skill ID valid UUID hona chahiye',
          'any.required': 'Skill ID zaruri hai'
        }),
        name: Joi.string().min(2).max(30).required(),
        level: Joi.string().valid('Beginner', 'Intermediate', 'Advanced', 'Expert').default('Intermediate'),
        endorsed: Joi.boolean().default(false),
        yearsOfExperience: Joi.number().min(0).max(30).optional()
      })
    ).min(3).max(20).required(),
    jobPreferences: Joi.object({
      jobTypes: Joi.array().items(Joi.string().valid('Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship')).min(1).required(),
      salaryRange: Joi.object({
        min: Joi.number().min(0).required(),
        max: Joi.number().greater(Joi.ref('min')).required(),
        currency: Joi.string().valid('USD', 'EUR', 'INR', 'GBP').default('USD')
      }).optional(),
      remoteWork: Joi.boolean().default(false),
      willingToRelocate: Joi.boolean().default(false),
      preferredLocations: Joi.array().items(Joi.string().min(2).max(50)).max(5).optional(),
      industries: Joi.array().items(Joi.string().min(2).max(50)).max(5).optional()
    }).required(),
    socialLinks: Joi.object({
      linkedIn: Joi.string().uri().max(200).optional(),
      github: Joi.string().uri().max(200).optional(),
      portfolio: Joi.string().uri().max(200).optional(),
      twitter: Joi.string().uri().max(200).optional()
    }).optional(),
    privacy: Joi.object({
      profileVisible: Joi.boolean().default(true),
      contactInfoVisible: Joi.boolean().default(false),
      openToOpportunities: Joi.boolean().default(true)
    }).default({})
  }).label('userProfileSchema');

  return compileSchema(schema).validate(data, { abortEarly: false, allowUnknown: false });
};

export const validatePaginationParams = (data) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).max(500).default(1).messages({
      'number.min': 'Page 1 se kam nahi ho sakta',
      'number.max': 'Page 500 se zyada nahi ho sakta'
    }),    
    cursor: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.min': 'Limit 1 se kam nahi ho sakta',
      'number.max': 'Limit 50 se zyada nahi ho sakta'
    }),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'relevance', 'salary', 'experience').default('createdAt').messages({
      'any.only': 'Sort field valid hona chahiye'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
      'any.only': 'Sort order asc ya desc hona chahiye'
    }),
    search: Joi.string().min(1).max(100).optional().messages({
      'string.min': 'Search term 1 char se chhota nahi hona chahiye',
      'string.max': 'Search term 100 char se bada nahi hona chahiye'
    }),
    filters: Joi.object({
      dateRange: Joi.object({
        from: Joi.date().optional(),
        to: Joi.date().min(Joi.ref('from')).optional()
      }).optional(),
      status: Joi.array().items(Joi.string().valid('active', 'inactive', 'pending', 'archived')).max(4).optional(),
      category: Joi.array().items(Joi.string().min(2).max(30)).max(5).optional()
    }).optional()
  }).label('paginationSchema');

  return compileSchema(schema).validate(data, { abortEarly: false, allowUnknown: false });
};

export const validateMatchingParams = (data) => {
  const schema = Joi.object({
    userId: Joi.string().pattern(uuidPattern).required().messages({
      'string.pattern.base': 'User ID valid UUID hona chahiye',
      'any.required': 'User ID zaruri hai'
    }),
    jobTitle: Joi.string().min(2).max(50).optional().messages({
      'string.min': 'Job title 2 char se chhota nahi hona chahiye',
      'string.max': 'Job title 50 char se bada nahi hona chahiye'
    }),
    keywords: Joi.array().items(Joi.string().min(2).max(30)).min(1).max(10).optional().messages({
      'array.min': 'Kam se kam ek keyword chahiye',
      'array.max': '10 se zyada keywords nahi ho sakte'
    }),
    location: Joi.object({
      city: Joi.string().min(2).max(50).optional(),
      state: Joi.string().min(2).max(50).optional(),
      country: Joi.string().min(2).max(50).optional(),
      radius: Joi.number().min(0).max(200).default(25).optional(),
      remote: Joi.boolean().default(false)
    }).optional(),
    jobType: Joi.array().items(Joi.string().valid('Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary')).max(3).optional(),
    experienceLevel: Joi.array().items(Joi.string().valid('Entry-level', 'Mid-level', 'Senior-level', 'Executive', 'Internship')).max(3).optional(),
    salaryRange: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().greater(Joi.ref('min')).optional(),
      currency: Joi.string().valid('USD', 'EUR', 'INR', 'GBP').default('USD'),
      period: Joi.string().valid('hourly', 'monthly', 'yearly').default('yearly')
    }).optional(),
    industries: Joi.array().items(Joi.string().min(2).max(30)).max(5).optional(),
    companySize: Joi.array().items(Joi.string().valid('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+')).max(3).optional(),
    matchingCriteria: Joi.object({
      skillsWeight: Joi.number().min(0).max(1).default(0.4),
      experienceWeight: Joi.number().min(0).max(1).default(0.3),
      locationWeight: Joi.number().min(0).max(1).default(0.2),
      salaryWeight: Joi.number().min(0).max(1).default(0.1),
      minimumMatchScore: Joi.number().min(0).max(100).default(70)
    }).default({}),
    requiredSkills: Joi.array().items(Joi.string().min(2).max(30)).max(5).optional(),
    preferredSkills: Joi.array().items(Joi.string().min(2).max(30)).max(10).optional(),
    excludedCompanies: Joi.array().items(Joi.string().pattern(uuidPattern)).max(20).optional().messages({
      'string.pattern.base': 'Excluded company ID valid UUID hona chahiye'
    }),
    datePosted: Joi.string().valid('today', 'last-3-days', 'last-week', 'last-month', 'any-time').default('any-time'),
    booleanQuery: Joi.string().max(200).pattern(/^[a-zA-Z0-9\s\(\)\&\|\!\-\"]+$/).optional().messages({
      'string.pattern.base': 'Boolean query mein invalid characters hain'
    })
  }).label('matchingParamsSchema');

  return compileSchema(schema).validate(data, { abortEarly: false, allowUnknown: false });
};
