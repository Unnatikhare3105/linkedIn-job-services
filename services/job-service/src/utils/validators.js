import Joi from "joi";

// Add this helper function
export const normalizeArrayFields = (data) => {
  const arrayFields = ["skills", "searchKeywords", "tags", "diversityTags"];

  const nestedArrayFields = {
    requirements: ["certifications", "mandatorySkills", "preferredSkills"],
    benefits: ["others"],
  };

  // Normalize top-level array fields
  arrayFields.forEach((field) => {
    if (
      data[field] &&
      typeof data[field] === "object" &&
      !Array.isArray(data[field])
    ) {
      data[field] = Object.values(data[field]);
    }
  });

  // Normalize nested array fields
  Object.keys(nestedArrayFields).forEach((parent) => {
    if (data[parent]) {
      nestedArrayFields[parent].forEach((field) => {
        if (
          data[parent][field] &&
          typeof data[parent][field] === "object" &&
          !Array.isArray(data[parent][field])
        ) {
          data[parent][field] = Object.values(data[parent][field]);
        }
      });
    }
  });

  return data;
};

// Validation schema for creating a job
export const validateCreateJobInput = (input) => {
  const schema = Joi.object({
    title: Joi.string()
      .trim()
      .max(200)
      .required()
      .pattern(/^[a-zA-Z0-9\s\-\.,&()]+$/)
      .messages({
        "string.pattern.base": "Title contains invalid characters",
        "string.max": "Title must not exceed 200 characters",
        "any.required": "Title is required",
      }),

    companyId: Joi.string()
      .required()
      .max(36)
      .pattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      .messages({
        "string.pattern.base": "Invalid company ID format",
        "any.required": "Company ID is required",
      }),

    description: Joi.string()
      .max(5000)
      .required()
      .custom((value, helpers) => {
        if (/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(value)) {
          return helpers.error("string.unsafeContent");
        }
        return value;
      })
      .messages({
        "string.unsafeContent": "Description contains unsafe content",
        "string.max": "Description must not exceed 5000 characters",
        "any.required": "Description is required",
      }),

    skills: Joi.array()
      .items(
        Joi.object({
          name: Joi.string()
            .trim()
            .lowercase()
            .max(50)
            .required()
            .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
            .messages({
              "string.pattern.base": "Skill name contains invalid characters",
              "string.max": "Skill name must not exceed 50 characters",
              "any.required": "Skill name is required",
            }),
          weight: Joi.number().min(0).max(1).default(0.5),
          category: Joi.string()
            .valid("technical", "soft", "domain", "tool", "framework")
            .default("technical"),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one skill is required",
        "any.required": "Skills are required",
      }),

    location: Joi.object({
      city: Joi.string()
        .trim()
        .max(100)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .allow("")
        .messages({
          "string.pattern.base": "City name contains invalid characters",
        }),
      state: Joi.string()
        .trim()
        .max(50)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .allow("")
        .messages({
          "string.pattern.base": "State name contains invalid characters",
        }),
      country: Joi.string()
        .trim()
        .max(50)
        .default("India")
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .messages({
          "string.pattern.base": "Country name contains invalid characters",
        }),
      isRemote: Joi.boolean().default(false),
      coordinates: Joi.object({
        type: Joi.string().valid("Point").default("Point"),
        coordinates: Joi.array()
          .items(Joi.number())
          .length(2)
          .custom((value, helpers) => {
            const [lon, lat] = value;
            if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
              return helpers.error("array.coordinatesInvalid");
            }
            return value;
          })
          .optional()
          .messages({
            "array.coordinatesInvalid": "Invalid coordinates format",
          }),
      }).optional(),
    }).optional(),

    searchKeywords: Joi.array()
      .items(Joi.string().max(50).lowercase())
      .optional(),

    tags: Joi.array().items(Joi.string().max(30).lowercase()).optional(),

    createdBy: Joi.string()
      .pattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      .required(),

    jobType: Joi.string()
      .valid("full-time", "part-time", "contract", "freelance", "internship")
      .required()
      .messages({
        "any.only": "Invalid job type",
        "any.required": "Job type is required",
      }),

    salary: Joi.object({
      min: Joi.number().integer().min(0).max(100000000).optional().messages({
        "number.base": "Salary min must be a number",
        "number.min": "Salary min must be at least 0",
        "number.max": "Salary min must not exceed 100000000",
      }),
      max: Joi.number().integer().min(0).max(100000000).optional().messages({
        "number.base": "Salary max must be a number",
        "number.min": "Salary max must be at least 0",
        "number.max": "Salary max must not exceed 100000000",
      }),
      currency: Joi.string().valid("INR", "USD", "EUR", "GBP").default("INR"),
      isNegotiable: Joi.boolean().default(true),
      frequency: Joi.string()
        .valid("hourly", "monthly", "yearly")
        .default("yearly"),
    }).optional(),

    experience: Joi.object({
      level: Joi.string()
        .valid(
          "entry",
          "junior",
          "mid",
          "senior",
          "lead",
          "principal",
          "executive"
        )
        .required()
        .messages({
          "any.only": "Invalid experience level",
          "any.required": "Experience level is required",
        }),
      minYears: Joi.number().min(0).max(50).default(0),
      maxYears: Joi.number().min(0).max(50).optional(),
    })
      .required()
      .messages({
        "any.required": "Experience is required",
      }),

    requirements: Joi.object({
      education: Joi.string()
        .max(200)
        .optional()
        .pattern(/^[^<>]+$/)
        .messages({
          "string.pattern.base": "Education field contains unsafe characters",
        }),
      certifications: Joi.array()
        .items(
          Joi.string()
            .max(100)
            .pattern(/^[a-zA-Z0-9\s\-\.,()]+$/)
            .messages({
              "string.pattern.base":
                "Certification name contains invalid characters",
            })
        )
        .optional(),
      mandatorySkills: Joi.array()
        .items(
          Joi.string()
            .max(50)
            .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
            .messages({
              "string.pattern.base":
                "Mandatory skill name contains invalid characters",
            })
        )
        .optional(),
      preferredSkills: Joi.array()
        .items(
          Joi.string()
            .max(50)
            .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
            .messages({
              "string.pattern.base":
                "Preferred skill name contains invalid characters",
            })
        )
        .optional(),
    }).optional(),

    benefits: Joi.object({
      healthInsurance: Joi.boolean().default(false),
      paidLeave: Joi.number().min(0).max(365).optional(),
      stockOptions: Joi.boolean().default(false),
      remoteWork: Joi.boolean().default(false),
      flexibleHours: Joi.boolean().default(false),
      others: Joi.array()
        .items(
          Joi.string()
            .max(100)
            .pattern(/^[a-zA-Z0-9\s\-\.,()]+$/)
            .messages({
              "string.pattern.base":
                "Benefit description contains invalid characters",
            })
        )
        .optional(),
    }).optional(),

    department: Joi.string()
      .max(100)
      .optional()
      .pattern(/^[a-zA-Z0-9\s\-&]+$/)
      .messages({
        "string.pattern.base": "Department name contains invalid characters",
      }),

    industry: Joi.string()
      .valid(
        "technology",
        "healthcare",
        "finance",
        "education",
        "manufacturing",
        "retail",
        "consulting",
        "other"
      )
      .optional(),

    updatedBy: Joi.string()
      .pattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      .optional(),

    version: Joi.number().integer().min(1).default(1),

    isDeleted: Joi.boolean().default(false),

    applicationMethod: Joi.string()
      .valid("internal", "external", "email", "linkedin")
      .default("internal"),

    applicationUrl: Joi.string()
      .max(500)
      .optional()
      .pattern(/^https:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/)
      .messages({
        "string.pattern.base": "Application URL must be a valid HTTPS URL",
      }),

    isFeatured: Joi.boolean().default(false),
    isUrgent: Joi.boolean().default(false),

    diversityTags: Joi.array()
      .items(
        Joi.string().valid(
          "women-friendly",
          "lgbtq-friendly",
          "disability-friendly",
          "minority-friendly"
        )
      )
      .optional(),
  })
    .custom((value, helpers) => {
      if (
        value.salary?.min &&
        value.salary?.max &&
        value.salary.min > value.salary.max
      ) {
        return helpers.error("object.salaryRangeInvalid");
      }
      if (
        value.experience?.minYears &&
        value.experience?.maxYears &&
        value.experience.minYears > value.experience.maxYears
      ) {
        return helpers.error("object.experienceRangeInvalid");
      }
      return value;
    })
    .messages({
      "object.salaryRangeInvalid": "Invalid salary range",
      "object.experienceRangeInvalid": "Invalid experience range",
    });

  return schema.validate(input, { abortEarly: false });
};

// Validation schema for updating a job
export const validateUpdateJobInput = (input) => {
  const schema = Joi.object({
    title: Joi.string()
      .trim()
      .max(200)
      .optional()
      .pattern(/^[a-zA-Z0-9\s\-\.,&()]+$/)
      .messages({
        "string.pattern.base": "Title contains invalid characters",
        "string.max": "Title must not exceed 200 characters",
      }),

    description: Joi.string()
      .max(5000)
      .optional()
      .custom((value, helpers) => {
        if (/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(value)) {
          return helpers.error("string.unsafeContent");
        }
        return value;
      })
      .messages({
        "string.unsafeContent": "Description contains unsafe content",
        "string.max": "Description must not exceed 5000 characters",
      }),

    skills: Joi.array()
      .items(
        Joi.object({
          name: Joi.string()
            .trim()
            .lowercase()
            .max(50)
            .required()
            .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
            .messages({
              "string.pattern.base": "Skill name contains invalid characters",
              "string.max": "Skill name must not exceed 50 characters",
              "any.required": "Skill name is required",
            }),
          weight: Joi.number().min(0).max(1).default(0.5),
          category: Joi.string()
            .valid("technical", "soft", "domain", "tool", "framework")
            .default("technical"),
        })
      )
      .optional()
      .messages({
        "array.min": "At least one skill is required if skills are provided",
      }),

    location: Joi.object({
      city: Joi.string()
        .trim()
        .max(100)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .allow("")
        .messages({
          "string.pattern.base": "City name contains invalid characters",
        }),
      state: Joi.string()
        .trim()
        .max(50)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .allow("")
        .messages({
          "string.pattern.base": "State name contains invalid characters",
        }),
      country: Joi.string()
        .trim()
        .max(50)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .messages({
          "string.pattern.base": "Country name contains invalid characters",
        }),
      isRemote: Joi.boolean().optional(),
      coordinates: Joi.object({
        type: Joi.string().valid("Point").default("Point"),
        coordinates: Joi.array()
          .items(Joi.number())
          .length(2)
          .custom((value, helpers) => {
            const [lon, lat] = value;
            if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
              return helpers.error("array.coordinatesInvalid");
            }
            return value;
          })
          .optional()
          .messages({
            "array.coordinatesInvalid": "Invalid coordinates format",
          }),
      }).optional(),
    }).optional(),

    jobType: Joi.string()
      .valid("full-time", "part-time", "contract", "freelance", "internship")
      .optional()
      .messages({
        "any.only": "Invalid job type",
      }),

    salary: Joi.object({
      min: Joi.number().integer().min(0).max(100000000).optional().messages({
        "number.base": "Salary min must be a number",
        "number.min": "Salary min must be at least 0",
        "number.max": "Salary min must not exceed 100000000",
      }),
      max: Joi.number().integer().min(0).max(100000000).optional().messages({
        "number.base": "Salary max must be a number",
        "number.min": "Salary max must be at least 0",
        "number.max": "Salary max must not exceed 100000000",
      }),
      currency: Joi.string().valid("INR", "USD", "EUR", "GBP").optional(),
      isNegotiable: Joi.boolean().optional(),
      frequency: Joi.string().valid("hourly", "monthly", "yearly").optional(),
    }).optional(),

    experience: Joi.object({
      level: Joi.string()
        .valid(
          "entry",
          "junior",
          "mid",
          "senior",
          "lead",
          "principal",
          "executive"
        )
        .optional()
        .messages({
          "any.only": "Invalid experience level",
        }),
      minYears: Joi.number().min(0).max(50).optional(),
      maxYears: Joi.number().min(0).max(50).optional(),
    }).optional(),

    status: Joi.string()
      .valid("draft", "active", "paused", "expired", "filled", "cancelled")
      .optional()
      .messages({
        "any.only": "Invalid status",
      }),

    requirements: Joi.object({
      education: Joi.string()
        .max(200)
        .optional()
        .pattern(/^[^<>]+$/)
        .messages({
          "string.pattern.base": "Education field contains unsafe characters",
        }),
      certifications: Joi.array()
        .items(
          Joi.string()
            .max(100)
            .pattern(/^[a-zA-Z0-9\s\-\.,()]+$/)
            .messages({
              "string.pattern.base":
                "Certification name contains invalid characters",
            })
        )
        .optional(),
      mandatorySkills: Joi.array()
        .items(
          Joi.string()
            .max(50)
            .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
            .messages({
              "string.pattern.base":
                "Mandatory skill name contains invalid characters",
            })
        )
        .optional(),
      preferredSkills: Joi.array()
        .items(
          Joi.string()
            .max(50)
            .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
            .messages({
              "string.pattern.base":
                "Preferred skill name contains invalid characters",
            })
        )
        .optional(),
    }).optional(),

    benefits: Joi.object({
      healthInsurance: Joi.boolean().optional(),
      paidLeave: Joi.number().min(0).max(365).optional(),
      stockOptions: Joi.boolean().optional(),
      remoteWork: Joi.boolean().optional(),
      flexibleHours: Joi.boolean().optional(),
      others: Joi.array()
        .items(
          Joi.string()
            .max(100)
            .pattern(/^[a-zA-Z0-9\s\-\.,()]+$/)
            .messages({
              "string.pattern.base":
                "Benefit description contains invalid characters",
            })
        )
        .optional(),
    }).optional(),

    department: Joi.string()
      .max(100)
      .optional()
      .pattern(/^[a-zA-Z0-9\s\-&]+$/)
      .messages({
        "string.pattern.base": "Department name contains invalid characters",
      }),

    industry: Joi.string()
      .valid(
        "technology",
        "healthcare",
        "finance",
        "education",
        "manufacturing",
        "retail",
        "consulting",
        "other"
      )
      .optional(),

    applicationMethod: Joi.string()
      .valid("internal", "external", "email", "linkedin")
      .optional(),

    applicationUrl: Joi.string()
      .max(500)
      .optional()
      .pattern(/^https:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/)
      .messages({
        "string.pattern.base": "Application URL must be a valid HTTPS URL",
      }),

    isFeatured: Joi.boolean().optional(),
    isUrgent: Joi.boolean().optional(),

    diversityTags: Joi.array()
      .items(
        Joi.string().valid(
          "women-friendly",
          "lgbtq-friendly",
          "disability-friendly",
          "minority-friendly"
        )
      )
      .optional(),
  })
    .custom((value, helpers) => {
      if (
        value.salary?.min &&
        value.salary?.max &&
        value.salary.min > value.salary.max
      ) {
        return helpers.error("object.salaryRangeInvalid");
      }
      if (
        value.experience?.minYears &&
        value.experience?.maxYears &&
        value.experience.minYears > value.experience.maxYears
      ) {
        return helpers.error("object.experienceRangeInvalid");
      }
      return value;
    })
    .min(1)
    .messages({
      "object.salaryRangeInvalid": "Invalid salary range",
      "object.experienceRangeInvalid": "Invalid experience range",
      "object.min": "At least one field must be provided for update",
    });

  return schema.validate(input, { abortEarly: false });
};

// Validation schema for listing/filtering jobs
export const validateListJobsFilters = (input) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit must not exceed 100",
    }),
    title: Joi.string()
      .trim()
      .max(200)
      .optional()
      .pattern(/^[a-zA-Z0-9\s\-\.,&()]+$/)
      .messages({
        "string.pattern.base": "Title contains invalid characters",
        "string.max": "Title must not exceed 200 characters",
      }),
    companyId: Joi.string()
      .optional()
      .max(36)
      .pattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
      .messages({
        "string.pattern.base": "Invalid company ID format",
      }),
    jobType: Joi.string()
      .valid("full-time", "part-time", "contract", "freelance", "internship")
      .optional()
      .messages({
        "any.only": "Invalid job type",
      }),
    location: Joi.object({
      city: Joi.string()
        .trim()
        .max(100)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .allow("")
        .messages({
          "string.pattern.base": "City name contains invalid characters",
        }),
      state: Joi.string()
        .trim()
        .max(50)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .allow("")
        .messages({
          "string.pattern.base": "State name contains invalid characters",
        }),
      country: Joi.string()
        .trim()
        .max(50)
        .optional()
        .pattern(/^[a-zA-Z\s\-'\.]+$/)
        .messages({
          "string.pattern.base": "Country name contains invalid characters",
        }),
      isRemote: Joi.boolean().optional(),
    }).optional(),
    experience: Joi.object({
      level: Joi.string()
        .valid(
          "entry",
          "junior",
          "mid",
          "senior",
          "lead",
          "principal",
          "executive"
        )
        .optional()
        .messages({
          "any.only": "Invalid experience level",
        }),
      minYears: Joi.number().min(0).max(50).optional(),
      maxYears: Joi.number().min(0).max(50).optional(),
    }).optional(),
    skills: Joi.array()
      .items(
        Joi.string()
          .trim()
          .lowercase()
          .max(50)
          .pattern(/^[a-zA-Z0-9\s\-\.+#]+$/)
          .messages({
            "string.pattern.base": "Skill name contains invalid characters",
            "string.max": "Skill name must not exceed 50 characters",
          })
      )
      .optional(),
    industry: Joi.string()
      .valid(
        "technology",
        "healthcare",
        "finance",
        "education",
        "manufacturing",
        "retail",
        "consulting",
        "other"
      )
      .optional(),
    isFeatured: Joi.boolean().optional(),
    isUrgent: Joi.boolean().optional(),
    diversityTags: Joi.array()
      .items(
        Joi.string().valid(
          "women-friendly",
          "lgbtq-friendly",
          "disability-friendly",
          "minority-friendly"
        )
      )
      .optional(),
  })
    .custom((value, helpers) => {
      if (
        value.experience?.minYears &&
        value.experience?.maxYears &&
        value.experience.minYears > value.experience.maxYears
      ) {
        return helpers.error("object.experienceRangeInvalid");
      }
      return value;
    })
    .messages({
      "object.experienceRangeInvalid": "Invalid experience range",
    });

  return schema.validate(input, { abortEarly: false });
};

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

// Validation for searchSimilarJobs input
export function validateSearchSimilarJobsInput(input) {
  const schema = Joi.object({
    queryText: Joi.string().required().messages({
      'any.required': 'Query text is required',
      'string.empty': 'Query text cannot be empty'
    }),
    queryEmbedding: Joi.array()
      .items(Joi.number())
      .length(1536) // Adjust based on your embedding model
      .required()
      .messages({
        'array.length': 'Query embedding must be 1536-dimensional',
        'any.required': 'Query embedding is required'
      }),
    filters: Joi.object({
      skills: Joi.array().items(Joi.string()).optional(),
      experienceLevel: Joi.string().optional(),
      location: Joi.string().optional(),
      jobType: Joi.string().optional()
    }).optional()
  });

  return schema.validate(input, { abortEarly: false });
}

// Validation schema for search queries
export const validateSearchInput = (input) => {
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

// Validation schema for saving searches
export const validateSaveSearchInput = (input) => {
  const schema = Joi.object({
    type: Joi.string().valid('location', 'company', 'keyword', 'title').required(),
    query: Joi.string().min(1).required(),
  });
  return schema.validate(input);
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

// Validation schema for sort queries
export const validateSortInput = (input) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
    query: Joi.string().optional().allow('').max(100).messages({
      'string.max': 'Search query cannot exceed 100 characters',
    }),
  });
  return schema.validate(input, { abortEarly: false });
};
