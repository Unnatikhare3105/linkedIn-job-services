import rateLimit from "express-rate-limit";
// import {redisCluster} from './redis.cluster.js';

export const searchRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisCluster.call(...args),
  }),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: async (req) => {
    const userType = req.user?.subscription || "free";
    return userType === "premium" ? 100 : 30;
  },
  message: "Search rate limit exceeded. Upgrade to premium for higher limits.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === "admin",
});

export const autocompleteRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisCluster.call(...args),
  }),
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: "Autocomplete rate limit exceeded",
});

export const filterRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes per IP
  message: {
    success: false,
    message: "Too many filter requests. Please try again after 15 minutes.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// *RATE LIMITING FOR 1M+ USERS*
export const sortRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 300, // 300 requests per 10 minutes per IP
  message: {
    success: false,
    message: "Too many sort requests. Please try again after 10 minutes.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiters
export const companyVerificationLimiter = rateLimit({
  windowMs: RATE_LIMITS.COMPANY_VERIFICATION.windowMs,
  max: RATE_LIMITS.COMPANY_VERIFICATION.max,
  message: "Too many company verification requests",
});

export const jobSpamLimiter = rateLimit({
  windowMs: RATE_LIMITS.JOB_SPAM.windowMs,
  max: RATE_LIMITS.JOB_SPAM.max,
  message: "Too many job spam check requests",
});

export const salaryVerificationLimiter = rateLimit({
  windowMs: RATE_LIMITS.SALARY_VERIFICATION.windowMs,
  max: RATE_LIMITS.SALARY_VERIFICATION.max,
  message: "Too many salary verification requests",
});

export const duplicateApplicationLimiter = rateLimit({
  windowMs: RATE_LIMITS.DUPLICATE_APPLICATION.windowMs,
  max: RATE_LIMITS.DUPLICATE_APPLICATION.max,
  message: "Too many duplicate application check requests",
});

export const jobQualityLimiter = rateLimit({
  windowMs: RATE_LIMITS.JOB_QUALITY.windowMs,
  max: RATE_LIMITS.JOB_QUALITY.max,
  message: "Too many job quality check requests",
});

// Rate limiting configurations
const RATE_LIMITS = {
  COMPANY_PAGE: { windowMs: 60000, max: 50 },
  POST_REVIEW: { windowMs: 86400000, max: 5 }, // Per user, daily
  CULTURE_INFO: { windowMs: 60000, max: 30 },

  MATCH_CALCULATION: { windowMs: 60000, max: 100 },
  RECOMMENDATIONS: { windowMs: 60000, max: 50 },
  INVITATIONS: { windowMs: 60000, max: 10 },
  BATCH_OPERATIONS: { windowMs: 300000, max: 5 },
  INVITATIONS_PER_USER: { windowMs: 86400000, max: 5 }, // Per user daily limit

  COMPANY_VERIFICATION: { windowMs: 86400000, max: 5 }, // Daily
  JOB_SPAM: { windowMs: 60000, max: 50 }, // Per minute
  SALARY_VERIFICATION: { windowMs: 86400000, max: 10 }, // Daily
  DUPLICATE_APPLICATION: { windowMs: 60000, max: 100 }, // Per minute
  JOB_QUALITY: { windowMs: 60000, max: 50 }, // Per minute

  RESUME_OPTIMIZATION: { windowMs: 3600000, max: 10 }, // Per user, hourly
  JOB_MATCHING: { windowMs: 60000, max: 50 }, // Per user, per minute
  JOB_ANALYSIS: { windowMs: 60000, max: 30 },
  COMPANY_VERIFICATION: { windowMs: 86400000, max: 5 }, // Daily
  SALARY_VERIFICATION: { windowMs: 86400000, max: 10 },
};
