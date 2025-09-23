import { consumer, publishJobEvent } from '../../config/kafka.js';
import redisClient from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { CACHE_TTL } from '../../constants/cache.js';
import Job from '../../model/job.model.js';
import JobApplication from '../../model/jobApplication.model.js';

class PremiumService {
  async handleMessage(topic, message) {
    try {
      const { type, payload, requestId } = message;
      let result;

      switch (type) {
        case 'competitive_analysis':
          result = await this.processCompetitiveAnalysis({ jobId: payload.jobId, userId: payload.userId });
          await publishJobEvent('premium_results', { type, payload: result, requestId });
          break;
        case 'salary_benchmark':
          result = await this.processSalaryBenchmark({
            title: payload.title,
            location: payload.location,
            experience: payload.experience,
          });
          await publishJobEvent('premium_results', { type, payload: result, requestId });
          break;
        case 'interview_questions':
          result = await this.processInterviewQuestions({ jobId: payload.jobId });
          await publishJobEvent('premium_results', { type, payload: result, requestId });
          break;
        case 'interview_tips':
          result = await this.processInterviewTips({ companyId: payload.companyId, roleType: payload.roleType });
          await publishJobEvent('premium_results', { type, payload: result, requestId });
          break;
        default:
          throw new Error(`Unknown task type: ${type}`);
      }
      logger.info(`Processed ${topic} message`, { service: 'premium-service', requestId, type });
      return result;
    } catch (error) {
      logger.error(`Error processing ${topic} message: ${error.message}`, {
        service: 'premium-service',
        requestId,
        type: message.type,
        stack: error.stack,
      });
      throw error;
    }
  }

  async processCompetitiveAnalysis({ jobId, userId }) {
    const job = await Job.findById(jobId).lean();
    if (!job) throw new Error('Job not found');

    const result = {
      similarJobs: [{ id: 'job2', title: job.title, company: 'Example Co' }],
      averageSalary: 100000,
      salaryRange: { min: 80000, max: 120000 },
      competitorInsights: ['Competitor hiring for similar roles'],
      marketTrends: ['High demand for ' + job.title],
    };

    await redisClient.setex(`job_competition:${jobId}`, CACHE_TTL.JOB_COMPETITION || 86400, JSON.stringify(result));
    return result;
  }

  async processSalaryBenchmark({ title, location, experience }) {
    const result = {
      averageSalary: 95000,
      percentile25: 80000,
      percentile75: 110000,
      marketRate: 'competitive',
    };

    await redisClient.setex(`salary_benchmark:${title}:${location}:${experience}`, CACHE_TTL.SALARY_BENCHMARK || 86400, JSON.stringify(result));
    return result;
  }

  async processInterviewQuestions({ jobId }) {
    const job = await Job.findById(jobId).lean();
    if (!job) throw new Error('Job not found');

    const result = {
      behavioralQuestions: ['Tell me about a challenge you faced'],
      technicalQuestions: ['Explain a technical concept'],
      roleSpecificQuestions: [`How would you handle ${job.title} tasks?`],
      companyQuestions: ['Why do you want to work here?'],
    };

    await redisClient.setex(`interview_questions:${jobId}`, CACHE_TTL.INTERVIEW_QUESTIONS || 86400, JSON.stringify(result));
    return result;
  }

  async processInterviewTips({ companyId, roleType }) {
    const result = {
      generalTips: ['Be confident', 'Prepare questions'],
      companySpecificTips: ['Research company values'],
      roleSpecificTips: [`Focus on ${roleType} skills`],
      dresscode: 'business-casual',
      interviewFormat: 'hybrid',
    };

    await redisClient.setex(`interview_tips:${companyId}:${roleType}`, CACHE_TTL.INTERVIEW_TIPS || 86400, JSON.stringify(result));
    return result;
  }
}

export const premiumService = new PremiumService();

// Premium Basics Functions

export const hasPremiumAccess = async (user) => {
  try {
    const cacheKey = `premium:access:${user.id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const hasAccess = user.isPremium || false;
    await redisClient.setex(cacheKey, CACHE_TTL.PREMIUM_ACCESS || 3600, JSON.stringify(hasAccess));
    return hasAccess;
  } catch (err) {
    logger.error(`hasPremiumAccess failed: ${err.message}`, { userId: user.id });
    throw err;
  }
};

export const getPremiumFeatures = async (userId) => {
  try {
    const cacheKey = `premium:features:${userId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const credits = await getInmailCredits(userId);
    const features = {
      applicantInsights: true,
      competitiveAnalysis: true,
      inmailCredits: credits.availableCredits,
      interviewPrep: true,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.PREMIUM_FEATURES || 3600, JSON.stringify(features));
    return features;
  } catch (err) {
    logger.error(`getPremiumFeatures failed: ${err.message}`, { userId });
    throw err;
  }
};

// Applicant Insights Functions

export const getJobApplicantInsights = async (jobId, user) => {
  try {
    if (!(await hasPremiumAccess(user))) throw new Error('Premium access required');
    const usage = await checkFeatureLimit(user.id, 'applicantInsights');
    if (!usage.hasAccess) throw new Error('Applicant insights limit reached');

    const cacheKey = `applicant_insights:${jobId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const applications = await JobApplication.find({ jobId, status: { $ne: 'withdrawn' } }).lean();
    const totalApplicants = applications.length;
    const averageExperience = applications.reduce((sum, app) => sum + (app.experienceYears || 0), 0) / (totalApplicants || 1);
    const skills = applications.flatMap(app => app.skills || []).reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});
    const topSkills = Object.entries(skills)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([skill]) => skill);
    const locationDistribution = applications.reduce((acc, app) => {
      const loc = app.location || 'Unknown';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

    const result = {
      totalApplicants,
      applicantProfiles: applications.map(app => ({ id: app._id, experience: app.experienceYears, skills: app.skills })),
      averageExperience,
      topSkills,
      locationDistribution,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.APPLICANT_INSIGHTS || 86400, JSON.stringify(result));
    await logFeatureUsage(user.id, 'applicantInsights', { jobId });
    return result;
  } catch (err) {
    logger.error(`getJobApplicantInsights failed: ${err.message}`, { jobId, userId: user.id });
    throw err;
  }
};

export const getCompetitionLevel = async (jobId) => {
  try {
    const cacheKey = `competition_level:${jobId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;

    const applicantCount = await JobApplication.countDocuments({ jobId, status: { $ne: 'withdrawn' } });
    let level;
    if (applicantCount < 10) level = 'Low';
    else if (applicantCount < 50) level = 'Medium';
    else level = 'High';

    await redisClient.setex(cacheKey, CACHE_TTL.COMPETITION_LEVEL || 86400, level);
    return level;
  } catch (err) {
    logger.error(`getCompetitionLevel failed: ${err.message}`, { jobId });
    throw err;
  }
};

// Competitive Analysis Functions

export const analyzeJobCompetition = async (jobId, user) => {
  try {
    if (!(await hasPremiumAccess(user))) throw new Error('Premium access required');
    const usage = await checkFeatureLimit(user.id, 'competitiveAnalysis');
    if (!usage.hasAccess) throw new Error('Competitive analysis limit reached');

    const cacheKey = `job_competition:${jobId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const job = await Job.findById(jobId).lean();
    if (!job) throw new Error('Job not found');

    const requestId = `comp_${jobId}_${Date.now()}`;
    await publishJobEvent('competitive_analysis', { jobId, userId: user.id, requestId });

    const result = {
      similarJobs: [],
      averageSalary: 0,
      salaryRange: { min: 0, max: 0 },
      competitorInsights: [],
      marketTrends: [],
      status: 'pending',
      requestId,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.JOB_COMPETITION || 86400, JSON.stringify(result));
    await logFeatureUsage(user.id, 'competitiveAnalysis', { jobId });
    return result;
  } catch (err) {
    logger.error(`analyzeJobCompetition failed: ${err.message}`, { jobId, userId: user.id });
    throw err;
  }
};

export const getSalaryBenchmark = async (title, location, experience) => {
  try {
    const cacheKey = `salary_benchmark:${title}:${location}:${experience}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const requestId = `salary_${title}_${location}_${Date.now()}`;
    await publishJobEvent('salary_benchmark', { title, location, experience, requestId });

    const result = {
      averageSalary: 0,
      percentile25: 0,
      percentile75: 0,
      marketRate: 'pending',
      requestId,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.SALARY_BENCHMARK || 86400, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`getSalaryBenchmark failed: ${err.message}`, { title, location });
    throw err;
  }
};

// InMail Credits Functions

export const getInmailCredits = async (userId) => {
  try {
    const cacheKey = `inmail_credits:${userId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const credits = await redisClient.get(`user_credits:${userId}`);
    const defaultCredits = { availableCredits: 5, usedThisMonth: 0, resetDate: new Date() };
    const result = credits ? JSON.parse(credits) : defaultCredits;

    await redisClient.setex(cacheKey, CACHE_TTL.INMAIL_CREDITS || 3600, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`getInmailCredits failed: ${err.message}`, { userId });
    throw err;
  }
};

export const useInmailCredit = async (userId, recipientId) => {
  try {
    if (!(await canSendInmail(userId))) throw new Error('No InMail credits available');

    const cacheKey = `inmail_credits:${userId}`;
    const userCreditsKey = `user_credits:${userId}`;
    let credits = await redisClient.get(userCreditsKey);
    credits = credits ? JSON.parse(credits) : { availableCredits: 5, usedThisMonth: 0, resetDate: new Date() };

    credits.availableCredits -= 1;
    credits.usedThisMonth += 1;

    await redisClient.setex(userCreditsKey, CACHE_TTL.INMAIL_CREDITS || 30 * 86400, JSON.stringify(credits));
    await redisClient.setex(cacheKey, CACHE_TTL.INMAIL_CREDITS || 3600, JSON.stringify(credits));
    await logFeatureUsage(user.id, 'inmailCredits', { recipientId });

    return {
      success: true,
      remainingCredits: credits.availableCredits,
      messageId: `msg_${Date.now()}`,
    };
  } catch (err) {
    logger.error(`useInmailCredit failed: ${err.message}`, { userId, recipientId });
    throw err;
  }
};

export const canSendInmail = async (userId) => {
  try {
    const credits = await getInmailCredits(userId);
    return credits.availableCredits > 0;
  } catch (err) {
    logger.error(`canSendInmail failed: ${err.message}`, { userId });
    return false;
  }
};

export const refillMonthlyCredits = async (userId) => {
  try {
    const cacheKey = `inmail_credits:${userId}`;
    const userCreditsKey = `user_credits:${userId}`;
    const credits = {
      availableCredits: 5,
      usedThisMonth: 0,
      resetDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    };

    await redisClient.setex(userCreditsKey, CACHE_TTL.INMAIL_CREDITS || 30 * 86400, JSON.stringify(credits));
    await redisClient.setex(cacheKey, CACHE_TTL.INMAIL_CREDITS || 3600, JSON.stringify(credits));
    return { creditsRefilled: 5 };
  } catch (err) {
    logger.error(`refillMonthlyCredits failed: ${err.message}`, { userId });
    throw err;
  }
};

// Interview Preparation Functions

export const getInterviewQuestions = async (jobId, user) => {
  try {
    if (!(await hasPremiumAccess(user))) throw new Error('Premium access required');

    const cacheKey = `interview_questions:${jobId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const job = await Job.findById(jobId).lean();
    if (!job) throw new Error('Job not found');

    const requestId = `interview_questions_${jobId}_${Date.now()}`;
    await publishJobEvent('interview_questions', { jobId, userId: user.id, requestId });

    const result = {
      behavioralQuestions: [],
      technicalQuestions: [],
      roleSpecificQuestions: [],
      companyQuestions: [],
      status: 'pending',
      requestId,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.INTERVIEW_QUESTIONS || 86400, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`getInterviewQuestions failed: ${err.message}`, { jobId, userId: user.id });
    throw err;
  }
};

export const generateInterviewPrep = async (jobId, user) => {
  try {
    if (!(await hasPremiumAccess(user))) throw new Error('Premium access required');

    const cacheKey = `interview_prep:${jobId}:${user.id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const requestId = `interview_prep_${jobId}_${Date.now()}`;
    await publishJobEvent('interview_prep', { jobId, userProfile: user, requestId });

    const result = {
      recommendedTopics: [],
      skillsToEmphasize: [],
      weaknessesToAddress: [],
      practiceQuestions: [],
      companyResearch: [],
      status: 'pending',
      requestId,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.INTERVIEW_PREP || 86400, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`generateInterviewPrep failed: ${err.message}`, { jobId, userId: user.id });
    throw err;
  }
};

export const updatePrepProgress = async (userId, jobId, completedItems) => {
  try {
    const cacheKey = `prep_progress:${userId}:${jobId}`;
    const userProgressKey = `user_progress:${userId}:${jobId}`;
    const progress = {
      progress: completedItems.length / 10 * 100, // Example: 10 total items
      completedSections: completedItems,
      timeSpent: completedItems.reduce((sum, item) => sum + (item.timeSpent || 0), 0),
    };

    await redisClient.setex(userProgressKey, CACHE_TTL.PREP_PROGRESS || 30 * 86400, JSON.stringify(progress));
    await redisClient.setex(cacheKey, CACHE_TTL.PREP_PROGRESS || 86400, JSON.stringify(progress));
    return progress;
  } catch (err) {
    logger.error(`updatePrepProgress failed: ${err.message}`, { userId, jobId });
    throw err;
  }
};

export const getInterviewTips = async (companyId, roleType) => {
  try {
    const cacheKey = `interview_tips:${companyId}:${roleType}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const requestId = `interview_tips_${companyId}_${Date.now()}`;
    await publishJobEvent('interview_tips', { companyId, roleType, requestId });

    const result = {
      generalTips: [],
      companySpecificTips: [],
      roleSpecificTips: [],
      dresscode: 'business-casual',
      interviewFormat: 'hybrid',
      status: 'pending',
      requestId,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.INTERVIEW_TIPS || 86400, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`getInterviewTips failed: ${err.message}`, { companyId, roleType });
    throw err;
  }
};

// Utility Functions

export const checkFeatureLimit = async (userId, feature) => {
  try {
    const limits = {
      applicantInsights: 10,
      competitiveAnalysis: 5,
      inmailCredits: 5,
      interviewPrep: 'unlimited',
    };
    const cacheKey = `feature_limit:${userId}:${feature}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const usageKey = `feature_usage:${userId}:${feature}:${new Date().getMonth()}`;
    const usageCount = parseInt(await redisClient.get(usageKey) || '0');
    const hasAccess = limits[feature] === 'unlimited' || usageCount < limits[feature];
    const remaining = limits[feature] === 'unlimited' ? 'unlimited' : limits[feature] - usageCount;
    const resetDate = new Date(new Date().setMonth(new Date().getMonth() + 1));

    const result = { hasAccess, remaining, resetDate };
    await redisClient.setex(cacheKey, CACHE_TTL.FEATURE_LIMIT || 3600, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`checkFeatureLimit failed: ${err.message}`, { userId, feature });
    throw err;
  }
};

export const logFeatureUsage = async (userId, feature, details = {}) => {
  try {
    const usageKey = `feature_usage:${userId}:${feature}:${new Date().getMonth()}`;
    await redisClient.incr(usageKey);
    await redisClient.expire(usageKey, CACHE_TTL.FEATURE_USAGE || 30 * 86400);
    return { logged: true, timestamp: new Date(), feature, userId, details };
  } catch (err) {
    logger.error(`logFeatureUsage failed: ${err.message}`, { userId, feature });
    throw err;
  }
};

export const getPremiumAnalytics = async (userId) => {
  try {
    const cacheKey = `premium_analytics:${userId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const features = ['applicantInsights', 'competitiveAnalysis', 'inmailCredits', 'interviewPrep'];
    const featuresUsed = {};
    let usageThisMonth = 0;
    let mostUsedFeature = '';

    for (const feature of features) {
      const usageKey = `feature_usage:${userId}:${feature}:${new Date().getMonth()}`;
      const count = parseInt(await redisClient.get(usageKey) || '0');
      featuresUsed[feature] = count;
      usageThisMonth += count;
      if (count > (featuresUsed[mostUsedFeature] || 0)) mostUsedFeature = feature;
    }

    const result = {
      featuresUsed,
      mostUsedFeature,
      usageThisMonth,
      valueGenerated: usageThisMonth * 10,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.PREMIUM_ANALYTICS || 86400, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error(`getPremiumAnalytics failed: ${err.message}`, { userId });
    throw err;
  }
};

export class JobSearchService {
  constructor(searchService, cacheService) {
    this.searchService = searchService;
    this.cacheService = cacheService;
  }

  async initialize() {
    await this.cacheService.getClient().ping();
    await initKafka();
  }

  async searchJobs(params, userId, useScroll = false) {
    const { error, value: validatedParams } = searchValidationSchema.validate(params);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    const sanitizedParams = sanitizeInput(validatedParams);
    
    const paramHash = require('crypto').createHash('md5').update(JSON.stringify(sanitizedParams)).digest('hex');
    const cacheKey = `search:${paramHash}:${userId.slice(-8)}`;
    
    let results = await this.cacheService.get(cacheKey);
    
    if (!results) {
      results = await this.searchService.searchJobs(sanitizedParams, useScroll);
      if (results.took < 1000 || results.total < 100) {
        await this.cacheService.set(cacheKey, results, 300);
      }
    }

    this.trackSearchEvent(userId, sanitizedParams, results).catch(console.error);
    
    return results;
  }

  async getTrendingJobs(limit = 50) {
    const cacheKey = `trending_jobs:${limit}`;
    let trendingJobs = await this.cacheService.get(cacheKey);
    
    if (!trendingJobs) {
      trendingJobs = await this.searchService.getTrendingJobs(limit);
      await this.cacheService.set(cacheKey, trendingJobs, 600);
    }
    
    return trendingJobs;
  }

  async getJobsInNetwork(userId, limit = 20) {
    const cacheKey = `network_jobs:${userId}`;
    let networkJobs = await this.cacheService.get(cacheKey);
    
    if (!networkJobs) {
      const userConnections = await this.getUserConnections(userId);
      networkJobs = await this.searchService.getJobsInNetwork(userId, userConnections, limit);
      await this.cacheService.set(cacheKey, networkJobs, 1800);
    }
    
    return networkJobs;
  }

  async getAlumniJobs(userId, limit = 20) {
    const cacheKey = `alumni_jobs:${userId}`;
    let alumniJobs = await this.cacheService.get(cacheKey);
    
    if (!alumniJobs) {
      const userEducation = await this.getUserEducation(userId);
      alumniJobs = await this.searchService.getAlumniJobs(userId, userEducation, limit);
      await this.cacheService.set(cacheKey, alumniJobs, 1800);
    }
    
    return alumniJobs;
  }

  async getFilteredJobs(filterType, params, userId) {
    const baseParams = { ...params };
    
    switch (filterType) {
      case 'newgrad':
        baseParams.experienceLevel = 'entry';
        baseParams.noExperienceRequired = true;
        break;
      case 'senior':
        baseParams.experienceLevel = 'senior';
        break;
      case 'executive':
        baseParams.experienceLevel = 'executive';
        break;
      case 'contract':
        baseParams.jobType = 'contract';
        break;
      case 'freelance':
        baseParams.jobType = 'freelance';
        break;
      case 'startup':
        baseParams.companySize = 'startup';
        break;
      case 'fortune500':
        baseParams.companySize = 'fortune500';
        break;
      case 'no_experience':
        baseParams.noExperienceRequired = true;
        break;
    }
    
    return await this.searchJobs(baseParams, userId);
  }

  async trackSearchEvent(userId, params, results) {
    const event = {
      type: 'job_search',
      userId,
      timestamp: new Date().toISOString(),
      searchParams: { ...params, sensitive: undefined },
      resultCount: results.total,
      took: results.took
    };

    await publishJobEvent('job-search-events', event);
  }

  async getUserConnections(userId) {
    return [];
  }

  async getUserEducation(userId) {
    return [];
  }

  async disconnect() {
    await this.cacheService.disconnect();
    await this.searchService.disconnect();
  }
};