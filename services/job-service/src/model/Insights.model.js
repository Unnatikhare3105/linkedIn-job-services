import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import redisClient from '../config/redis.js';
import { SearchEventService } from '../services/search.services.js';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { cacheHits } from '../utils/metrics.js';

const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const insightsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: (v) => validUUIDRegex.test(v),
        message: 'Invalid userId UUID',
      },
    },
    jobAnalytics: [{
      jobId: {
        type: String,
        required: true,
        validate: {
          validator: (v) => validUUIDRegex.test(v),
          message: 'Invalid jobId UUID',
        },
      },
      offerMetrics: {
        offerCount: { type: Number, default: 0, min: 0 },
        averageSalary: { type: Number, default: 0, min: 0 },
        averageEquity: { type: Number, default: 0, min: 0 },
      },
      trendingScore: { type: Number, default: 0, min: 0, max: 100 },
      metrics: {
        views: { type: Number, default: 0, min: 0 },
        uniqueViews: { type: Number, default: 0, min: 0 },
        applications: { type: Number, default: 0, min: 0 },
        saves: { type: Number, default: 0, min: 0 },
        shares: { type: Number, default: 0, min: 0 },
        clicks: { type: Number, default: 0, min: 0 },
      },
      sources: {
        direct: { type: Number, default: 0, min: 0 },
        linkedin: { type: Number, default: 0, min: 0 },
        google: { type: Number, default: 0, min: 0 },
        referral: { type: Number, default: 0, min: 0 },
      },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }],
    salaryNegotiation: {
      jobTitle: String,
      location: String,
      industry: String,
      experienceYears: Number,
      currentSalary: Number,
      offerSalary: Number,
      marketData: {
        percentile25: Number,
        percentile50: Number,
        percentile75: Number,
        percentile90: Number,
        average: Number,
        dataPoints: Number,
        lastUpdated: Date,
      },
      comparableRoles: [{
        title: String,
        salaryRange: { min: Number, max: Number },
        similarity: Number,
      }],
      benchmarkScore: Number,
      negotiationStrategy: {
        suggestedOffer: Number,
        negotiationPoints: [String],
        marketPosition: String,
        recommendedApproach: String,
      },
      lastAnalyzed: Date,
    },
    marketReports: [{
      reportId: {
        type: String,
        default: uuidv4,
        validate: { validator: uuidValidate, message: 'Invalid reportId UUID' },
      },
      reportType: String,
      filters: {
        industry: String,
        location: String,
        experienceLevel: String,
      },
      generatedAt: { type: Date, default: Date.now },
      summary: String,
      data: {
        demandTrends: [String],
        topSkills: [String],
        salaryTrends: { median: Number, growthRate: String },
        hiringTrends: { activeListings: Number, growthRate: String },
      },
      recommendations: [String],
    }],
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'insights',
    shardKey: { userId: 1 },
  }
);

// Optimized Indexes for 10M+ Users
insightsSchema.index({ userId: 1, 'jobAnalytics.createdAt': -1 });
insightsSchema.index({ 'jobAnalytics.jobId': 1, 'jobAnalytics.trendingScore': -1 });
insightsSchema.index({ 'marketReports.reportId': 1 });
insightsSchema.index({ 'salaryNegotiation.lastAnalyzed': 1 });
insightsSchema.index({ isDeleted: 1 });
insightsSchema.index({ 'jobAnalytics.createdAt': 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL for job analytics

// Pre-save Middleware
insightsSchema.pre('save', async function (next) {
  try {
    this.updatedAt = new Date();
    for (const job of this.jobAnalytics) {
      if (!job.createdAt) job.createdAt = new Date();
      job.updatedAt = new Date();
    }
    if (this.isNew || this.isModified()) {
      await SearchEventService.emit('analytics:insights_updated', {
        userId: this.userId,
        jobIds: this.jobAnalytics.map(j => j.jobId),
        reportIds: this.marketReports.map(r => r.reportId),
      });
    }
    next();
  } catch (error) {
    logger.error('Insights pre-save error:', error);
    next(error);
  }
});

// Static Methods
insightsSchema.statics.updateJobMetrics = async function (userId, jobId, metrics) {
  const update = {
    $inc: {
      'jobAnalytics.$.offerMetrics.offerCount': metrics.offerCount || 0,
      'jobAnalytics.$.metrics.views': metrics.views || 0,
      'jobAnalytics.$.metrics.uniqueViews': metrics.uniqueViews || 0,
      'jobAnalytics.$.metrics.applications': metrics.applications || 0,
      'jobAnalytics.$.metrics.saves': metrics.saves || 0,
      'jobAnalytics.$.metrics.shares': metrics.shares || 0,
      'jobAnalytics.$.metrics.clicks': metrics.clicks || 0,
      'jobAnalytics.$.sources.direct': metrics.sources?.direct || 0,
      'jobAnalytics.$.sources.linkedin': metrics.sources?.linkedin || 0,
      'jobAnalytics.$.sources.google': metrics.sources?.google || 0,
      'jobAnalytics.$.sources.referral': metrics.sources?.referral || 0,
    },
    $set: { 'jobAnalytics.$.updatedAt': new Date() },
  };
  if (metrics.averageSalary) update.$set['jobAnalytics.$.offerMetrics.averageSalary'] = metrics.averageSalary;
  if (metrics.averageEquity) update.$set['jobAnalytics.$.offerMetrics.averageEquity'] = metrics.averageEquity;
  if (metrics.trendingScore) update.$set['jobAnalytics.$.trendingScore'] = metrics.trendingScore;

  return this.updateOne(
    { userId, 'jobAnalytics.jobId': jobId },
    update,
    { upsert: true }
  );
};

insightsSchema.statics.findUserInsights = async function (userId, pagination = {}) {
  const { page = 1, limit = 20, sortBy = 'jobAnalytics.createdAt', sortOrder = -1 } = pagination;
  return this.findOne({ userId, isDeleted: false })
    .select('jobAnalytics salaryNegotiation marketReports')
    .slice('jobAnalytics', [(page - 1) * limit, limit])
    .slice('marketReports', [(page - 1) * limit, limit])
    .sort({ [sortBy]: sortOrder })
    .lean();
};

insightsSchema.statics.findPopularJobs = async function (timeFrame = '7d', limit = 10) {
  const days = timeFrame === '7d' ? 7 : 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $unwind: '$jobAnalytics' },
    { $match: { 'jobAnalytics.createdAt': { $gte: startDate } } },
    {
      $group: {
        _id: '$jobAnalytics.jobId',
        trendingScore: { $avg: '$jobAnalytics.trendingScore' },
        totalViews: { $sum: '$jobAnalytics.metrics.views' },
        totalApplications: { $sum: '$jobAnalytics.metrics.applications' },
      },
    },
    { $sort: { trendingScore: -1 } },
    { $limit: limit },
  ]);
};

// Cache Manager
class CacheManager {
  static async getMultiLevel(key, userId = null) {
    const userKey = userId ? `${key}:${userId}` : key;
    try {
      let result = await redisClient.get(`hot:${userKey}`);
      if (result) {
        cacheHits.inc({ cache_type: 'hot' });
        return JSON.parse(result);
      }
      result = await redisClient.get(`warm:${userKey}`);
      if (result) {
        cacheHits.inc({ cache_type: 'warm' });
        await redisClient.setEx(`hot:${userKey}`, 30, result);
        return JSON.parse(result);
      }
      result = await redisClient.get(`cold:${key}`);
      if (result) {
        cacheHits.inc({ cache_type: 'cold' });
        return JSON.parse(result);
      }
    } catch (error) {
      logger.error('Cache get error:', error);
    }
    return null;
  }

  static async setMultiLevel(key, data, userId = null) {
    const userKey = userId ? `${key}:${userId}` : key;
    const dataStr = JSON.stringify(data);
    try {
      await Promise.all([
        redisClient.setEx(`hot:${userKey}`, 30, dataStr),
        redisClient.setEx(`warm:${userKey}`, 300, dataStr),
        redisClient.setEx(`cold:${key}`, 1800, dataStr),
      ]);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }
}

const InsightsModel = mongoose.model('Insights', insightsSchema);

export { CacheManager };
export default InsightsModel;