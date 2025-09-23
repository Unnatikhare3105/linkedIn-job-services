import mongoose from 'mongoose';
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';
import { createHash } from 'crypto';
import logger from '../utils/logger.js';
import { SearchEventService, SearchVectorService } from '../services/search.services.js';
import redisClient from '../config/redis.js';
import { generateSecureId, sanitizeUserId } from '../utils/security.js';
import { searchDuration, searchRequests, activeSearches, cacheHits } from '../utils/metrics.js';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const searchSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: (v) => validUUIDRegex.test(v),
        message: 'Invalid userId UUID',
      },
    },
    searches: [{
      searchId: {
        type: String,
        default: uuidv4,
        validate: { validator: uuidValidate, message: 'Invalid searchId UUID' },
      },
      query: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
        validate: {
          validator: (v) => !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v),
          message: 'Query contains unsafe content',
        },
      },
      queryHash: { type: String },
      metadata: {
        type: { type: String, enum: ['location', 'company', 'keyword', 'title', 'natural'], required: true },
        filters: {
          skills: [{ name: { type: String, maxlength: 50, lowercase: true, trim: true }, weight: { type: Number, min: 0, max: 1, default: 0.5 } }],
          locations: [{ city: String, state: String, country: { type: String, default: 'India' } }],
          excludeKeywords: [{ type: String, maxlength: 50, lowercase: true, trim: true }],
          jobTypes: [{ type: String, enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'] }],
          experienceLevels: [{ type: String, enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive'] }],
          salaryRange: { min: { type: Number, min: 0 }, max: { type: Number, min: 0 }, currency: { type: String, default: 'INR' } },
          companySize: { type: String, enum: ['startup', 'small', 'medium', 'large', 'enterprise'] },
          workMode: { type: String, enum: ['remote', 'onsite', 'hybrid'] },
          industry: { type: String, maxlength: 100, trim: true },
          postedWithin: { type: Number, min: 0 },
        },
        ip: { type: String, maxlength: 45 },
        userAgent: { type: String, maxlength: 500 },
        sessionId: { type: String, maxlength: 50 },
        referrer: { type: String, maxlength: 200 },
      },
      stats: {
        resultCount: { type: Number, default: 0, min: 0 },
        executionTime: { type: Number, default: 0, min: 0 },
        clickCount: { type: Number, default: 0, min: 0 },
        saveCount: { type: Number, default: 0, min: 0 },
        applyCount: { type: Number, default: 0, min: 0 },
        shareCount: { type: Number, default: 0, min: 0 },
        lastClickedAt: { type: Date },
        avgClickPosition: { type: Number, min: 0 },
      },
      resultJobIds: [{ type: String, maxlength: 36 }],
      searchKeywords: [{ type: String, maxlength: 50, lowercase: true }],
      embedding: { type: [Number], select: false },
      priority: { type: Number, default: 0, min: 0, max: 10 },
      quality: {
        relevanceScore: { type: Number, min: 0, max: 1 },
        userSatisfaction: { type: Number, min: 0, max: 5 },
        conversionRate: { type: Number, min: 0, max: 1 },
      },
      searchType: { type: String, enum: ['simple', 'boolean', 'advanced'], default: 'simple' },
      booleanOperators: [{ type: String, enum: ['AND', 'OR', 'NOT'] }],
      searchContext: { type: String, enum: ['trending', 'network', 'alumni', 'newgrad', 'senior', 'contract', 'startup', 'fortune500', 'no_experience'] },
      resultMetrics: {
        totalResults: { type: Number, default: 0 },
        clickedResults: { type: Number, default: 0 },
        applicationsMade: { type: Number, default: 0 },
        timeSpentOnResults: { type: Number, default: 0 },
      },
      isSaved: { type: Boolean, default: false },
      saveName: { type: String, maxlength: 100, trim: true, default: 'My Search' },
      alertSettings: {
        enabled: { type: Boolean, default: true },
        frequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'daily' },
        lastAlertSent: { type: Date },
        alertCount: { type: Number, default: 0 },
      },
      searchPerformance: {
        totalRuns: { type: Number, default: 0 },
        avgResultCount: { type: Number, default: 0 },
        lastResultCount: { type: Number, default: 0 },
        lastRunAt: { type: Date },
      },
      isAdvancedSearch: { type: Boolean, default: false },
      expiresAt: { type: Date, default: () => new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) },
    }],
    preferences: {
      searchFilters: {
        skills: [{ type: String, maxlength: 50 }],
        locations: [{ type: String, maxlength: 100 }],
        experienceLevel: [{ type: String, enum: ['entry', 'mid', 'senior', 'executive'] }],
        salaryRange: { min: { type: Number, min: 0 }, max: { type: Number, min: 0 } },
        jobType: [{ type: String, enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'] }],
      },
      quickApplySettings: {
        enabled: { type: Boolean, default: false },
        maxApplicationsPerDay: { type: Number, min: 1, max: 50, default: 10 },
        resumeId: { type: String, validate: { validator: (v) => !v || validUUIDRegex.test(v), message: 'Invalid resumeId UUID' } },
        source: { type: String, enum: ['direct', 'linkedin', 'referral', 'job-board'], default: 'direct' },
        templates: [{
          id: { type: String, default: generateSecureId, validate: validUUIDRegex },
          name: { type: String, maxlength: 100, required: true },
          coverLetter: { type: String, maxlength: 2000 },
          customization: { type: Object, default: {} },
          createdAt: { type: Date, default: Date.now },
        }],
      },
    },
    createdBy: {
      type: String,
      required: true,
      validate: { validator: (v) => validUUIDRegex.test(v), message: 'Invalid createdBy UUID' },
    },
    updatedBy: {
      type: String,
      validate: { validator: (v) => !v || validUUIDRegex.test(v), message: 'Invalid updatedBy UUID' },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'searches',
    shardKey: { userId: 1 },
  }
);

// Optimized Indexes for 10M+ Users
searchSchema.index({ userId: 1, 'searches.createdAt': -1 });
searchSchema.index({ 'searches.searchId': 1 });
searchSchema.index({ 'searches.queryHash': 1 });
searchSchema.index({ 'searches.metadata.type': 1, 'searches.createdAt': -1 });
searchSchema.index({ 'searches.priority': -1, 'searches.createdAt': -1 });
searchSchema.index({ isDeleted: 1 });
searchSchema.index({ 'searches.stats.resultCount': 1 });
searchSchema.index({ 'searches.metadata.sessionId': 1 });
searchSchema.index({ 'searches.searchKeywords': 'text' }, { name: 'search_text_index' });
searchSchema.index({ 'searches.expiresAt': 1 }, { expireAfterSeconds: 0 });
searchSchema.index({ 'searches.alertSettings.lastAlertSent': 1 });
searchSchema.index({ 'searches.alertSettings.frequency': 1, 'searches.isActive': 1 });

// Pre-save Middleware
searchSchema.pre('save', async function (next) {
  try {
    this.updatedAt = new Date();
    if (this.createdBy) this.createdBy = sanitizeUserId(this.createdBy);
    if (this.updatedBy) this.updatedBy = sanitizeUserId(this.updatedBy);

    for (const search of this.searches) {
      if (!search.queryHash) {
        search.queryHash = createHash('md5')
          .update(`${this.userId}:${search.query}:${JSON.stringify(search.metadata.filters)}`)
          .digest('hex');
      }
      search.searchKeywords = [
        ...search.query.toLowerCase().split(/\s+/),
        ...search.metadata.filters.skills.map((s) => s.name),
        ...search.metadata.filters.excludeKeywords,
        search.metadata.type,
      ].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 20);

      if (search.stats.clickCount > 0) {
        search.priority = Math.min(10, search.stats.clickCount * 2);
      }

      if (this.isNew || search.isNew) {
        await SearchEventService.emit('analytics:search_created', {
          searchId: search.searchId,
          userId: this.userId,
          query: search.query,
          type: search.metadata.type,
          filters: search.metadata.filters,
        });
      } else if (this.isModified()) {
        await SearchEventService.emit('analytics:search_updated', {
          searchId: search.searchId,
          changes: this.modifiedPaths(),
        });
      }

      await SearchVectorService.generateSearchEmbedding(search);
    }

    next();
  } catch (error) {
    logger.error('Search pre-save error:', error);
    next(error);
  }
});

// Static Methods
searchSchema.statics.findUserSearches = async function (userId, pagination = {}) {
  const { page = 1, limit = 20, sortBy = 'searches.createdAt', sortOrder = -1 } = pagination;
  return this.findOne({ userId, isDeleted: false })
    .select('searches preferences')
    .slice('searches', [(page - 1) * limit, limit])
    .sort({ [sortBy]: sortOrder })
    .lean();
};

searchSchema.statics.findPopularSearches = async function (timeFrame = '7d', limit = 10) {
  const days = timeFrame === '7d' ? 7 : 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $unwind: '$searches' },
    { $match: { 'searches.createdAt': { $gte: startDate } } },
    {
      $group: {
        _id: '$searches.queryHash',
        query: { $first: '$searches.query' },
        count: { $sum: 1 },
        avgResults: { $avg: '$searches.stats.resultCount' },
        totalClicks: { $sum: '$searches.stats.clickCount' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
};

searchSchema.statics.getActiveAlerts = async function (frequency, limit = 1000) {
  return this.find({
    'searches.alertSettings.frequency': frequency,
    'searches.isActive': true,
    $or: [
      { 'searches.alertSettings.lastAlertSent': { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { 'searches.alertSettings.lastAlertSent': null },
    ],
  })
    .select('userId searches')
    .slice('searches', limit)
    .lean();
};

searchSchema.statics.updateLastAlertSent = async function (userId, searchId) {
  return this.updateOne(
    { userId, 'searches.searchId': searchId, 'searches.isActive': true },
    { $set: { 'searches.$.alertSettings.lastAlertSent': new Date() } }
  );
};

// Cache Manager (Integrated from SearchHistory)
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

const Search = mongoose.model('Search', searchSchema);

export { CacheManager };
export default Search;