import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createStore } from './redis.js';

// Rate limiting configurations
export const RATE_LIMITS = {
  COMPANY_PAGE: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.subscription === "premium" ? 100 : 50,
    message: "Too many company page requests",
  },
  POST_REVIEW: {
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 5,
    message: "Too many reviews posted",
  },
  CULTURE_INFO: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.subscription === "premium" ? 60 : 30,
    message: "Too many culture info requests",
  },
  MATCH_CALCULATION: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.subscription === "premium" ? 200 : 100,
    message: "Too many match calculation requests",
  },
  RECOMMENDATIONS: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.subscription === "premium" ? 100 : 50,
    message: "Too many recommendations requests",
  },
  INVITATIONS: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.isRecruiter ? 20 : 10,
    message: "Too many invitations requests",
  },
  BATCH_OPERATIONS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5,
    message: "Too many batch operations requests",
  },
  COMPANY_VERIFICATION: {
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 5,
    message: "Too many company verification requests",
  },
  JOB_SPAM: {
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    message: "Too many job spam requests",
  },
  SALARY_VERIFICATION: {
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 10,
    message: "Too many salary verification requests",
  },
  DUPLICATE_APPLICATION: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: "Too many duplicate application requests",
  },
  JOB_QUALITY: {
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    message: "Too many job quality requests",
  },
  RESUME_OPTIMIZATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Too many resume optimization requests",
  },
  JOB_MATCHING: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.subscription === "premium" ? 100 : 50,
    message: "Too many job matching requests",
  },
  JOB_ANALYSIS: {
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => req.user?.subscription === "premium" ? 60 : 30,
    message: "Too many job analysis requests",
  },
  
};

// Rate limiters
export const searchRateLimit = rateLimit({
  store: createStore("rate:search:"),
  windowMs: 60 * 1000,
  max: async (req) => req.user?.subscription === "premium" ? 100 : 30,
  message: { error: "Search rate limit exceeded. Upgrade to premium for higher limits.", retryAfter: "60 seconds" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === "admin",
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const autocompleteRateLimit = rateLimit({
  store: createStore("rate:autocomplete:"),
  windowMs: 60 * 1000,
  max: async (req) => req.user?.subscription === "premium" ? 300 : 200,
  message: { error: "Autocomplete rate limit exceeded", retryAfter: "60 seconds" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === "admin",
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const filterRateLimit = rateLimit({
  store: createStore("rate:filter:"),
  windowMs: 15 * 60 * 1000,
  max: async (req) => req.user?.subscription === "premium" ? 300 : 200,
  message: { success: false, message: "Too many filter requests. Please try again after 15 minutes.", statusCode: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const sortRateLimit = rateLimit({
  store: createStore("rate:sort:"),
  windowMs: 10 * 60 * 1000,
  max: async (req) => req.user?.subscription === "premium" ? 400 : 300,
  message: { success: false, message: "Too many sort requests. Please try again after 10 minutes.", statusCode: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const companyVerificationLimiter = rateLimit({
  store: createStore("rate:company_verification:"),
  windowMs: RATE_LIMITS.COMPANY_VERIFICATION.windowMs,
  max: RATE_LIMITS.COMPANY_VERIFICATION.max,
  message: RATE_LIMITS.COMPANY_VERIFICATION.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const jobSpamLimiter = rateLimit({
  store: createStore("rate:job_spam:"),
  windowMs: RATE_LIMITS.JOB_SPAM.windowMs,
  max: RATE_LIMITS.JOB_SPAM.max,
  message: RATE_LIMITS.JOB_SPAM.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const salaryVerificationLimiter = rateLimit({
  store: createStore("rate:salary_verification:"),
  windowMs: RATE_LIMITS.SALARY_VERIFICATION.windowMs,
  max: RATE_LIMITS.SALARY_VERIFICATION.max,
  message: RATE_LIMITS.SALARY_VERIFICATION.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const duplicateApplicationLimiter = rateLimit({
  store: createStore("rate:duplicate_application:"),
  windowMs: RATE_LIMITS.DUPLICATE_APPLICATION.windowMs,
  max: RATE_LIMITS.DUPLICATE_APPLICATION.max,
  message: RATE_LIMITS.DUPLICATE_APPLICATION.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const jobQualityLimiter = rateLimit({
  store: createStore("rate:job_quality:"),
  windowMs: RATE_LIMITS.JOB_QUALITY.windowMs,
  max: RATE_LIMITS.JOB_QUALITY.max,
  message: RATE_LIMITS.JOB_QUALITY.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const companyPageLimiter = rateLimit({
  store: createStore("rate:company_page:"),
  windowMs: RATE_LIMITS.COMPANY_PAGE.windowMs,
  max: RATE_LIMITS.COMPANY_PAGE.max,
  message: RATE_LIMITS.COMPANY_PAGE.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const postReviewLimiter = rateLimit({
  store: createStore("rate:post_review:"),
  windowMs: RATE_LIMITS.POST_REVIEW.windowMs,
  max: RATE_LIMITS.POST_REVIEW.max,
  message: RATE_LIMITS.POST_REVIEW.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const cultureInfoLimiter = rateLimit({
  store: createStore("rate:culture_info:"),
  windowMs: RATE_LIMITS.CULTURE_INFO.windowMs,
  max: RATE_LIMITS.CULTURE_INFO.max,
  message: RATE_LIMITS.CULTURE_INFO.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const matchCalculationLimiter = rateLimit({
  store: createStore("rate:match_calculation:"),
  windowMs: RATE_LIMITS.MATCH_CALCULATION.windowMs,
  max: RATE_LIMITS.MATCH_CALCULATION.max,
  message: RATE_LIMITS.MATCH_CALCULATION.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const recommendationsLimiter = rateLimit({
  store: createStore("rate:recommendations:"),
  windowMs: RATE_LIMITS.RECOMMENDATIONS.windowMs,
  max: RATE_LIMITS.RECOMMENDATIONS.max,
  message: RATE_LIMITS.RECOMMENDATIONS.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const invitationsLimiter = rateLimit({
  store: createStore("rate:invitations:"),
  windowMs: RATE_LIMITS.INVITATIONS.windowMs,
  max: RATE_LIMITS.INVITATIONS.max,
  message: RATE_LIMITS.INVITATIONS.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const batchOperationsLimiter = rateLimit({
  store: createStore("rate:batch_operations:"),
  windowMs: RATE_LIMITS.BATCH_OPERATIONS.windowMs,
  max: RATE_LIMITS.BATCH_OPERATIONS.max,
  message: RATE_LIMITS.BATCH_OPERATIONS.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const resumeOptimizationLimiter = rateLimit({
  store: createStore("rate:resume_optimization:"),
  windowMs: RATE_LIMITS.RESUME_OPTIMIZATION.windowMs,
  max: RATE_LIMITS.RESUME_OPTIMIZATION.max,
  message: RATE_LIMITS.RESUME_OPTIMIZATION.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const jobMatchingLimiter = rateLimit({
  store: createStore("rate:job_matching:"),
  windowMs: RATE_LIMITS.JOB_MATCHING.windowMs,
  max: RATE_LIMITS.JOB_MATCHING.max,
  message: RATE_LIMITS.JOB_MATCHING.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const jobAnalysisLimiter = rateLimit({
  store: createStore("rate:job_analysis:"),
  windowMs: RATE_LIMITS.JOB_ANALYSIS.windowMs,
  max: RATE_LIMITS.JOB_ANALYSIS.max,
  message: RATE_LIMITS.JOB_ANALYSIS.message,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});



