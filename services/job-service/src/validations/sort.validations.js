import Joi from "joi";
// *COMPREHENSIVE SORT VALIDATION*
export const validateSortInput = (input) => {
  const schema = Joi.object({
    // *SORT OPTIONS*
    sortBy: Joi.string().valid(
      'relevance', 'date', 'salary-high', 'salary-low', 
      'company-rating', 'applications', 'views', 'trending',
      'match-score', 'distance', 'company-size', 'experience-match',
      'deadline', 'alphabetical', 'featured', 'urgency'
    ).optional().default('relevance'),
    
    sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
    
    // *FILTERS FOR SORTING CONTEXT*
    query: Joi.string().max(200).optional().allow(''),
    location: Joi.string().max(100).optional().allow(''),
    userLat: Joi.number().optional(), // For distance sorting
    userLng: Joi.number().optional(),
    userSkills: Joi.array().items(Joi.string()).optional(), // For match scoring
    userExperience: Joi.number().min(0).max(50).optional(),
    
    // *PAGINATION*
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    
    // *ADDITIONAL CONTEXT*
    userId: Joi.string().optional(),
    includeExpired: Joi.boolean().optional().default(false),
    minSalary: Joi.number().optional(),
    maxSalary: Joi.number().optional(),
  });
  
  return schema.validate(input, { abortEarly: false });
};