import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createStore } from './redis.js';
import { ERROR_MESSAGES } from '../constants/messages.js';

export const premiumLimiter = rateLimit({
  store: createStore("rate:premium:"),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many premium requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

// Rate limit configurations
export const createFollowUpReminderRateLimit = rateLimit({
  store: createStore('rate:followUpReminder:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 30 : 20),
  message: { success: false, error: 'Follow-up reminder rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const getFollowUpRemindersRateLimit = rateLimit({
  store: createStore('rate:getFollowUpReminders:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 150 : 100),
  message: { success: false, error: 'Get follow-up reminders rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createInterviewRateLimit = rateLimit({
  store: createStore('rate:createInterview:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 75 : 50),
  message: { success: false, error: 'Create interview rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const updateInterviewStatusRateLimit = rateLimit({
  store: createStore('rate:updateInterviewStatus:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 75 : 50),
  message: { success: false, error: 'Update interview status rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createOfferRateLimit = rateLimit({
  store: createStore('rate:createOffer:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 30 : 20),
  message: { success: false, error: 'Create offer rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const compareOffersRateLimit = rateLimit({
  store: createStore('rate:compareOffers:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 75 : 50),
  message: { success: false, error: 'Compare offers rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createApplicationNoteRateLimit = rateLimit({
  store: createStore('rate:createApplicationNote:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 150 : 100),
  message: { success: false, error: 'Create application note rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const getApplicationNotesRateLimit = rateLimit({
  store: createStore('rate:getApplicationNotes:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 150 : 100),
  message: { success: false, error: 'Get application notes rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createBatchApplicationRateLimit = rateLimit({
  store: createStore('rate:createBatchApplication:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 15 : 10),
  message: { success: false, error: 'Create batch application rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createApplicationTemplateRateLimit = rateLimit({
  store: createStore('rate:createApplicationTemplate:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 30 : 20),
  message: { success: false, error: 'Create application template rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const updateQuickApplySettingsRateLimit = rateLimit({
  store: createStore('rate:updateQuickApplySettings:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 30 : 20),
  message: { success: false, error: 'Update quick apply settings rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const calculateApplicationScoreRateLimit = rateLimit({
  store: createStore('rate:calculateApplicationScore:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 75 : 50),
  message: { success: false, error: 'Calculate application score rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const exportApplicationDataRateLimit = rateLimit({
  store: createStore('rate:exportApplicationData:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 7 : 5),
  message: { success: false, error: 'Export application data rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createThankYouNoteRateLimit = rateLimit({
  store: createStore('rate:createThankYouNote:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 30 : 20),
  message: { success: false, error: 'Create thank you note rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const saveVideoIntroductionRateLimit = rateLimit({
  store: createStore('rate:saveVideoIntroduction:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 15 : 10),
  message: { success: false, error: 'Save video introduction rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const savePortfolioAttachmentRateLimit = rateLimit({
  store: createStore('rate:savePortfolioAttachment:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 15 : 10),
  message: { success: false, error: 'Save portfolio attachment rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const createReferenceRateLimit = rateLimit({
  store: createStore('rate:createReference:'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => (req.user?.subscription === 'premium' ? 30 : 20),
  message: { success: false, error: 'Create reference rate limit exceeded', retryAfter: '1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role === 'admin',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

// professional development Rate limiters
export const skillsAnalysisLimit = rateLimit({ 
  store: createStore('rate:skillsAnalysis:'),
  windowMs: 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 5 : 3),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const assessmentLimit = rateLimit({ 
  store: createStore('rate:assessment:'),
  windowMs: 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 10 : 5),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const interviewLimit = rateLimit({ 
  store: createStore('rate:interview:'),
  windowMs: 24 * 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 3 : 1),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const resumeLimit = rateLimit({ 
  store: createStore('rate:resume:'),
  windowMs: 24 * 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 2 : 1),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const coachingLimit = rateLimit({ 
  store: createStore('rate:coaching:'),
  windowMs: 7 * 24 * 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 5 : 3),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const salaryLimit = rateLimit({ 
  store: createStore('rate:salary:'),
  windowMs: 24 * 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 5 : 3),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const reportLimit = rateLimit({ 
  store: createStore('rate:report:'),
  windowMs: 24 * 60 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 3 : 1),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

export const generalLimit = rateLimit({ 
  store: createStore('rate:general:'),
  windowMs: 15 * 60 * 1000,
  max: async (req) => (req.user?.subscription === 'premium' ? 100 : 50),
  message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});
