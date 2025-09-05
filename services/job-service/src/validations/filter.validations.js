import Joi from "joi";

// *COMPREHENSIVE VALIDATION SCHEMA*
export const validateCompleteFilterInput = (input) => {
  const schema = Joi.object({
    // *SEARCH PARAMETERS*
    q: Joi.string().max(200).optional().allow(''), // Main search query
    title: Joi.string().max(100).optional().allow(''), // Job title search
    company: Joi.string().max(100).optional().allow(''), // Company name search
    skills: Joi.array().items(Joi.string().max(50)).max(10).optional(), // Skills array
    keywords: Joi.string().max(300).optional().allow(''), // Keywords in description
   
    // *LOCATION FILTERS*
    location: Joi.string().max(100).optional().allow(''),
    city: Joi.array().items(Joi.string().max(50)).max(5).optional(), // Multiple cities
    state: Joi.array().items(Joi.string().max(50)).max(3).optional(),
    country: Joi.string().max(50).optional().default('India'),
    remote: Joi.boolean().optional(),
    workMode: Joi.array().items(Joi.string().valid('remote', 'hybrid', 'onsite')).optional(),
    nearMe: Joi.string().optional().allow(''), // "lat,lng,radius"
   
    // *SALARY & COMPENSATION*
    minSalary: Joi.number().min(0).max(10000000).optional(),
    maxSalary: Joi.number().min(0).max(10000000).optional(),
    salaryRange: Joi.string().valid('0-3L', '3L-6L', '6L-10L', '10L-15L', '15L-25L', '25L-50L', '50L+').optional(),
    currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').optional().default('INR'),
    showSalary: Joi.boolean().optional(), // Only jobs with salary disclosed
   
    // *JOB TYPE & EMPLOYMENT*
    jobType: Joi.array().items(Joi.string().valid('full-time', 'part-time', 'contract', 'internship', 'temporary', 'freelance')).optional(),
    employmentStatus: Joi.array().items(Joi.string().valid('permanent', 'contract', 'temporary', 'consultant')).optional(),
   
    // *EXPERIENCE & SENIORITY*
    experienceLevel: Joi.array().items(Joi.string().valid('fresher', 'entry-level', 'mid-level', 'senior-level', 'lead', 'manager', 'director', 'vp', 'c-level')).optional(),
    minExperience: Joi.number().min(0).max(50).optional(),
    maxExperience: Joi.number().min(0).max(50).optional(),
   
    // *COMPANY FILTERS* (Missing in original)
    companyIds: Joi.array().items(Joi.string()).max(20).optional(),
    companySize: Joi.array().items(Joi.string().valid('startup', '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')).optional(),
    companyType: Joi.array().items(Joi.string().valid('startup', 'mnc', 'public', 'private', 'non-profit', 'government')).optional(),
    companyRating: Joi.number().min(1).max(5).optional(), // Minimum company rating
    fundingStage: Joi.array().items(Joi.string().valid('pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'ipo', 'acquired')).optional(),
   
    // *INDUSTRY & FUNCTION*
    industry: Joi.array().items(Joi.string().valid('technology', 'healthcare', 'finance', 'education', 'retail', 'manufacturing', 'consulting', 'media', 'real-estate', 'automotive')).optional(),
    jobFunction: Joi.array().items(Joi.string().valid('engineering', 'product', 'design', 'marketing', 'sales', 'hr', 'finance', 'operations', 'legal', 'customer-success')).optional(),
    department: Joi.array().items(Joi.string().max(50)).optional(),
   
    // *EDUCATION & SKILLS*
    education: Joi.array().items(Joi.string().valid('10th', '12th', 'diploma', 'graduate', 'post-graduate', 'mba', 'phd')).optional(),
    degree: Joi.array().items(Joi.string().valid('btech', 'mtech', 'bca', 'mca', 'bba', 'mba', 'bcom', 'mcom', 'ba', 'ma', 'bsc', 'msc')).optional(),
    certifications: Joi.array().items(Joi.string().max(100)).optional(),
    languages: Joi.array().items(Joi.string().valid('english', 'hindi', 'bengali', 'tamil', 'telugu', 'marathi', 'gujarati', 'kannada', 'malayalam', 'punjabi')).optional(),
   
    // *DATE & TIME FILTERS* (Missing in original)
    datePosted: Joi.string().valid('any', 'past-24h', 'past-week', 'past-month', 'past-3-months').optional().default('any'),
    applicationDeadline: Joi.string().valid('any', 'next-week', 'next-month', 'next-3-months').optional(),
    startDate: Joi.string().valid('immediate', 'within-month', 'within-3-months', 'flexible').optional(),
   
    // *BENEFITS & PERKS* (Missing in original)
    benefits: Joi.array().items(Joi.string().valid(
      'health-insurance', 'dental-insurance', 'life-insurance',
      'pf-esi', 'gratuity', 'bonus', 'stock-options', 'esop',
      'flexible-hours', 'work-from-home', 'hybrid-work',
      'paid-leave', 'maternity-leave', 'paternity-leave',
      'learning-budget', 'certification-support', 'conference-budget',
      'gym-membership', 'meal-allowance', 'transport-allowance',
      'mobile-allowance', 'internet-allowance', 'laptop-provided',
      'free-snacks', 'team-outings', 'flexible-vacation'
    )).optional(),
   
    // *JOB FEATURES & URGENCY* (Missing in original)
    jobFeatures: Joi.array().items(Joi.string().valid(
      'easy-apply', 'quick-apply', 'actively-recruiting', 'urgent-hiring',
      'few-applicants', 'recently-posted', 'promoted-job', 'featured-job',
      'verified-company', 'background-check-required', 'reference-check-required',
      'portfolio-required', 'github-required', 'assessment-required'
    )).optional(),
   
    // *DIVERSITY & INCLUSION* (Missing in original)
    diversityTags: Joi.array().items(Joi.string().valid(
      'women-friendly', 'lgbtq-friendly', 'disability-friendly',
      'veteran-friendly', 'equal-opportunity', 'diverse-leadership',
      'women-led', 'minority-led', 'inclusive-culture'
    )).optional(),
   
    // *WORK ENVIRONMENT*
    workCulture: Joi.array().items(Joi.string().valid('collaborative', 'independent', 'fast-paced', 'innovative', 'traditional', 'startup-culture', 'corporate-culture')).optional(),
    teamSize: Joi.string().valid('individual', '2-5', '6-10', '11-25', '25+').optional(),
   
    // *APPLICATION FILTERS*
    applicationStatus: Joi.string().valid('not-applied', 'applied', 'in-progress', 'rejected', 'shortlisted').optional(),
    saveStatus: Joi.string().valid('all', 'saved', 'not-saved').optional(),
   
    // *ADVANCED FILTERS*
    postedBy: Joi.string().valid('company', 'recruiter', 'hr', 'hiring-manager').optional(),
    jobSource: Joi.array().items(Joi.string().valid('direct', 'consultant', 'referral', 'job-portal')).optional(),
   
    // *SORTING & PAGINATION*
    sortBy: Joi.string().valid('relevance', 'date', 'salary-high', 'salary-low', 'company-rating', 'experience-match').optional().default('relevance'),
    sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
    page: Joi.number().integer().min(1).max(1000).default(1), // Max 1000 pages for performance
    limit: Joi.number().integer().min(1).max(50).default(20), // Max 50 for mobile optimization
   
    // *ADVANCED SEARCH OPTIONS*
    exactPhrase: Joi.boolean().optional(), // Exact phrase matching
    excludeWords: Joi.string().max(200).optional(), // Words to exclude
    includeExpired: Joi.boolean().optional().default(false), // Include expired jobs
  });
 
  return schema.validate(input, { abortEarly: false, allowUnknown: false });
};
// *OPTIMIZED QUERY BUILDER FOR 1M+ SCALE*
export const buildOptimizedQuery = (filters, userProfile = null) => {
  const baseQuery = {
    status: 'active',
    isDeleted: false,
  };
 
  // Only add expiry check if not including expired jobs
  if (!filters.includeExpired) {
    baseQuery['dates.expires'] = { $gt: new Date() };
  }
 
  // *TEXT SEARCH AGGREGATION*
  const textSearchConditions = [];
  if (filters.q) {
    textSearchConditions.push({
      $or: [
        { title: new RegExp(filters.q.split(' ').join('|'), 'i') },
        { 'description.summary': new RegExp(filters.q.split(' ').join('|'), 'i') },
        { 'skills.name': { $in: filters.q.split(' ').map(s => new RegExp(s, 'i')) } },
        { 'company.name': new RegExp(filters.q, 'i') }
      ]
    });
  }
 
  // *LOCATION FILTERS*
  if (filters.city && filters.city.length > 0) {
    baseQuery['location.city'] = { $in: filters.city.map(c => new RegExp(c, 'i')) };
  }
  if (filters.state && filters.state.length > 0) {
    baseQuery['location.state'] = { $in: filters.state.map(s => new RegExp(s, 'i')) };
  }
  if (filters.country) baseQuery['location.country'] = filters.country;
  if (filters.remote !== undefined) baseQuery['location.remote'] = filters.remote;
  if (filters.workMode && filters.workMode.length > 0) {
    baseQuery['location.workMode'] = { $in: filters.workMode };
  }
 
  // *GEO LOCATION*
  if (filters.nearMe) {
    const [lat, lng, radius] = filters.nearMe.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
      baseQuery['location.coordinates'] = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius / 6371] // Radius in kilometers
        }
      };
    }
  }
 
  // *SALARY FILTERS*
  if (filters.salaryRange) {
    const ranges = {
      '0-3L': [0, 300000],
      '3L-6L': [300000, 600000],
      '6L-10L': [600000, 1000000],
      '10L-15L': [1000000, 1500000],
      '15L-25L': [1500000, 2500000],
      '25L-50L': [2500000, 5000000],
      '50L+': [5000000, Infinity]
    };
    const [min, max] = ranges[filters.salaryRange];
    baseQuery['salary.min'] = { $gte: min };
    if (max !== Infinity) baseQuery['salary.max'] = { $lte: max };
  } else {
    if (filters.minSalary) baseQuery['salary.min'] = { $gte: filters.minSalary };
    if (filters.maxSalary) baseQuery['salary.max'] = { $lte: filters.maxSalary };
  }
  if (filters.showSalary) baseQuery['salary.disclosed'] = true;
 
  // *JOB TYPE & EMPLOYMENT*
  if (filters.jobType && filters.jobType.length > 0) {
    baseQuery.jobType = { $in: filters.jobType };
  }
  if (filters.employmentStatus && filters.employmentStatus.length > 0) {
    baseQuery.employmentStatus = { $in: filters.employmentStatus };
  }
 
  // *EXPERIENCE FILTERS*
  if (filters.experienceLevel && filters.experienceLevel.length > 0) {
    baseQuery['experience.level'] = { $in: filters.experienceLevel };
  }
  if (filters.minExperience !== undefined) {
    baseQuery['experience.min'] = { $gte: filters.minExperience };
  }
  if (filters.maxExperience !== undefined) {
    baseQuery['experience.max'] = { $lte: filters.maxExperience };
  }
 
  // *COMPANY FILTERS*
  if (filters.companyIds && filters.companyIds.length > 0) {
    baseQuery.companyId = { $in: filters.companyIds };
  }
  if (filters.companySize && filters.companySize.length > 0) {
    baseQuery['company.size'] = { $in: filters.companySize };
  }
  if (filters.companyType && filters.companyType.length > 0) {
    baseQuery['company.type'] = { $in: filters.companyType };
  }
  if (filters.companyRating) {
    baseQuery['company.rating'] = { $gte: filters.companyRating };
  }
  if (filters.fundingStage && filters.fundingStage.length > 0) {
    baseQuery['company.fundingStage'] = { $in: filters.fundingStage };
  }
 
  // *INDUSTRY & FUNCTION*
  if (filters.industry && filters.industry.length > 0) {
    baseQuery.industry = { $in: filters.industry };
  }
  if (filters.jobFunction && filters.jobFunction.length > 0) {
    baseQuery.jobFunction = { $in: filters.jobFunction };
  }
  if (filters.department && filters.department.length > 0) {
    baseQuery.department = { $in: filters.department.map(d => new RegExp(d, 'i')) };
  }
 
  // *EDUCATION & SKILLS*
  if (filters.education && filters.education.length > 0) {
    baseQuery['requirements.education'] = { $in: filters.education };
  }
  if (filters.degree && filters.degree.length > 0) {
    baseQuery['requirements.degree'] = { $in: filters.degree };
  }
  if (filters.skills && filters.skills.length > 0) {
    baseQuery['skills.name'] = { $in: filters.skills.map(s => new RegExp(s, 'i')) };
  }
  if (filters.certifications && filters.certifications.length > 0) {
    baseQuery['requirements.certifications'] = { $in: filters.certifications.map(c => new RegExp(c, 'i')) };
  }
  if (filters.languages && filters.languages.length > 0) {
    baseQuery['requirements.languages'] = { $in: filters.languages };
  }
 
  // *DATE FILTERS*
  if (filters.datePosted && filters.datePosted !== 'any') {
    const now = new Date();
    const dateFilters = {
      'past-24h': new Date(now - 24 * 60 * 60 * 1000),
      'past-week': new Date(now - 7 * 24 * 60 * 60 * 1000),
      'past-month': new Date(now - 30 * 24 * 60 * 60 * 1000),
      'past-3-months': new Date(now - 90 * 24 * 60 * 60 * 1000)
    };
    baseQuery['dates.posted'] = { $gte: dateFilters[filters.datePosted] };
  }
 
  // *BENEFITS & FEATURES*
  if (filters.benefits && filters.benefits.length > 0) {
    baseQuery.benefits = { $in: filters.benefits };
  }
  if (filters.jobFeatures && filters.jobFeatures.length > 0) {
    baseQuery.features = { $in: filters.jobFeatures };
  }
  if (filters.diversityTags && filters.diversityTags.length > 0) {
    baseQuery.diversityTags = { $in: filters.diversityTags };
  }
 
  // *WORK ENVIRONMENT*
  if (filters.workCulture && filters.workCulture.length > 0) {
    baseQuery.workCulture = { $in: filters.workCulture };
  }
  if (filters.teamSize) {
    baseQuery.teamSize = filters.teamSize;
  }
 
  // *ADVANCED FILTERS*
  if (filters.postedBy) baseQuery.postedBy = filters.postedBy;
  if (filters.jobSource && filters.jobSource.length > 0) {
    baseQuery.source = { $in: filters.jobSource };
  }
 
  // Combine text search conditions
  if (textSearchConditions.length > 0) {
    baseQuery.$and = baseQuery.$and || [];
    baseQuery.$and.push(...textSearchConditions);
  }
 
  // *PERSONALIZATION (Added)*
  if (userProfile) {
    // Example: Boost based on user skills
    if (userProfile.skills && userProfile.skills.length > 0) {
      baseQuery.$or = baseQuery.$or || [];
      baseQuery.$or.push({
        'skills.name': { $in: userProfile.skills }
      });
    }
  }
 
  return baseQuery;
};
// *OPTIMIZED SORTING LOGIC*
export const getSortOptions = (sortBy, sortOrder) => {
  const sortOptions = {
    'relevance': { score: { $meta: 'textScore' }, 'dates.posted': -1 },
    'date': { 'dates.posted': sortOrder === 'asc' ? 1 : -1 },
    'salary-high': { 'salary.max': -1, 'dates.posted': -1 },
    'salary-low': { 'salary.min': 1, 'dates.posted': -1 },
    'company-rating': { 'company.rating': -1, 'dates.posted': -1 },
    'experience-match': { 'experience.min': 1, 'dates.posted': -1 }
  };
  return sortOptions[sortBy] || sortOptions['relevance'];
};

// Validation schema for location filter
export const validateLocationFilterInput = (input) => {
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
export const validateSalaryFilterInput = (input) => {
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
export const validateJobTypeFilterInput = (input) => {
  const schema = Joi.object({
    jobType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship', 'temporary').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for experience filter

export const validateExperienceFilterInput = (input) => {
  const schema = Joi.object({
    experienceLevel: Joi.string().valid('fresher', 'mid-level', 'senior', 'executive').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for industry filter
export const validateIndustryFilterInput = (input) => {
  const schema = Joi.object({
    industry: Joi.string().valid('tech', 'healthcare', 'finance', 'education', 'retail', 'manufacturing').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for skills filter
export const validateSkillsFilterInput = (input) => {
  const schema = Joi.object({
    skills: Joi.array().items(Joi.string().min(1).max(50)).min(1).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for education filter
export const validateEducationFilterInput = (input) => {
  const schema = Joi.object({
    education: Joi.string().valid('10th', '12th', 'graduate', 'post-graduate', 'phd').required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });
  return schema.validate(input, { abortEarly: false });
};

// Validation schema for smart filters
export const validateSmartFiltersInput = (input) => {
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

