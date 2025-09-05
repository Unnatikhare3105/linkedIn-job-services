import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import Job, { JobEventService } from "../model/job.model.js";
import UserActivity from '../models/UserActivity.js';
import JobApplication from '../model/jobApplication.model.js';
import { redisCluster } from '../config/redis.js';
import mongoose from "mongoose";
import pkg from '@pinecone-database/pinecone';
import { sanitizeUserId } from '../utils/security.js'; // Adjust path as needed
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from "openai";
dotenv.config();
const { Pinecone } = pkg;
import {searchDuration, searchRequests, activeSearches, cacheHits} from '../utils/metrics.js';
const searchHistorySchema = new mongoose.Schema(
  {
    // Primary identifier - UUID v4 format
    searchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 36,
      default: uuidv4,
      match: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    // Reference to User
    userId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: 'Invalid user ID format',
      },
    },
    // Search query
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      validate: {
        validator: function (v) {
          return !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v);
        },
        message: 'Query contains unsafe content',
      },
    },
    // Search query hash for deduplication
    queryHash: {
      type: String,
      index: true,
    },
    // Detailed metadata for search
    metadata: {
      type: {
        type: String,
        enum: ['location', 'company', 'keyword', 'title', 'natural'],
        required: true,
      },
      filters: {
        skills: [
          {
            name: {
              type: String,
              maxlength: 50,
              lowercase: true,
              trim: true,
              validate: {
                validator: function (v) {
                  return /^[a-zA-Z0-9\s\-\.+#]+$/.test(v);
                },
                message: 'Skill name contains invalid characters',
              },
            },
            weight: {
              type: Number,
              min: 0,
              max: 1,
              default: 0.5,
            },
          },
        ],
        locations: [
          {
            city: {
              type: String,
              maxlength: 100,
              trim: true,
              validate: {
                validator: function (v) {
                  return !v || /^[a-zA-Z\s\-'\.]+$/.test(v);
                },
                message: 'City name contains invalid characters',
              },
            },
            state: {
              type: String,
              maxlength: 50,
              trim: true,
              validate: {
                validator: function (v) {
                  return !v || /^[a-zA-Z\s\-'\.]+$/.test(v);
                },
                message: 'State name contains invalid characters',
              },
            },
            country: {
              type: String,
              maxlength: 50,
              trim: true,
              default: 'India',
              validate: {
                validator: function (v) {
                  return /^[a-zA-Z\s\-'\.]+$/.test(v);
                },
                message: 'Country name contains invalid characters',
              },
            },
          },
        ],
        excludeKeywords: [
          {
            type: String,
            maxlength: 50,
            lowercase: true,
            trim: true,
            validate: {
              validator: function (v) {
                return /^[a-zA-Z0-9\s\-\.]+$/.test(v);
              },
              message: 'Exclude keyword contains invalid characters',
            },
          },
        ],
        jobTypes: [
          {
            type: String,
            enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'],
          },
        ],
        experienceLevels: [
          {
            type: String,
            enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive'],
          },
        ],
        salaryRange: {
          min: { type: Number, min: 0 },
          max: { type: Number, min: 0 },
          currency: { type: String, default: 'INR', maxlength: 3 }
        },
        companySize: {
          type: String,
          enum: ['startup', 'small', 'medium', 'large', 'enterprise']
        },
        workMode: {
          type: String,
          enum: ['remote', 'onsite', 'hybrid']
        }
      },
      ip: {
        type: String,
        maxlength: 45,
        validate: {
          validator: function (v) {
            return !v || /^([0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v);
          },
          message: 'Invalid IP address format',
        },
      },
      userAgent: {
        type: String,
        maxlength: 500,
      },
      sessionId: {
        type: String,
        maxlength: 50,
      },
      referrer: {
        type: String,
        maxlength: 200,
      }
    },
    // Search statistics
    stats: {
      resultCount: { type: Number, default: 0, min: 0 },
      executionTime: { type: Number, default: 0, min: 0 },
      clickCount: { type: Number, default: 0, min: 0 },
      saveCount: { type: Number, default: 0, min: 0 },
      applyCount: { type: Number, default: 0, min: 0 },
      shareCount: { type: Number, default: 0, min: 0 },
      lastClickedAt: { type: Date },
      avgClickPosition: { type: Number, min: 0 }
    },
    // Search result IDs for tracking
    resultJobIds: [{
      type: String,
      maxlength: 36
    }],
    // Search keywords for text search
    searchKeywords: [
      {
        type: String,
        maxlength: 50,
        lowercase: true,
        validate: {
          validator: function (v) {
            return /^[a-zA-Z0-9\s\-\.]+$/.test(v);
          },
          message: 'Search keyword contains invalid characters',
        },
      },
    ],
    // Vector embedding for semantic search
    embedding: {
      type: [Number],
      select: false, // Don't include in normal queries
    },
    // Performance optimization fields
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
      index: true
    },
    // Search success indicators
    quality: {
      relevanceScore: { type: Number, min: 0, max: 1 },
      userSatisfaction: { type: Number, min: 0, max: 5 },
      conversionRate: { type: Number, min: 0, max: 1 }
    },
    // Secure audit fields
    createdBy: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: 'createdBy must be a valid user ID',
      },
    },
    updatedBy: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: 'updatedBy must be a valid user ID',
      },
    },
    version: { type: Number, default: 1, min: 1 },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'search_history',
  }
);

// Optimized compound indexes for 1M+ scale
searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ searchId: 1 });
searchHistorySchema.index({ userId: 1, queryHash: 1 }); // For deduplication
searchHistorySchema.index({ 'metadata.type': 1, createdAt: -1 });
searchHistorySchema.index({ priority: -1, createdAt: -1 }); // For priority searches
searchHistorySchema.index({ isDeleted: 1, createdAt: 1 }); // For cleanup operations
searchHistorySchema.index({ 'stats.resultCount': 1, createdAt: -1 }); // For analytics
searchHistorySchema.index({ 'metadata.sessionId': 1 }); // For session tracking
searchHistorySchema.index({ 'searchKeywords': 'text' }, { name: 'search_text_index' });
// TTL for old searches (90 days for better analytics)
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Search Statistics Service
class SearchStatsService {
  static async getUserSearchStats(userId, timeFrame = '30d') {
    try {
      const timeMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '365d': 365
      };
      const days = timeMap[timeFrame] || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await SearchHistory.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalSearches: { $sum: 1 },
            totalClicks: { $sum: '$stats.clickCount' },
            totalResults: { $sum: '$stats.resultCount' },
            avgExecutionTime: { $avg: '$stats.executionTime' },
            avgResultCount: { $avg: '$stats.resultCount' },
            avgClickCount: { $avg: '$stats.clickCount' },
            topSearchTypes: { $push: '$metadata.type' }
          }
        }
      ]);

      return stats[0] || {};
    } catch (error) {
      logger.error('Failed to get user search stats:', error);
      throw new Error(`Failed to retrieve user search stats: ${error.message}`);
    }
  }

  static async getGlobalSearchStats(timeFrame = '30d') {
    const cacheKey = `global_search_stats:${timeFrame}`;
    try {
      const cached = await redisCluster.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      logger.warn('Redis cache miss for global stats:', error);
      // Fallback: proceed with MongoDB query
    }

    try {
      const timeMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
      const days = timeMap[timeFrame] || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await SearchHistory.aggregate([
        { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
        {
          $group: {
            _id: null,
            totalSearches: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            totalClicks: { $sum: '$stats.clickCount' },
            avgExecutionTime: { $avg: '$stats.executionTime' },
            searchTypes: { $push: '$metadata.type' }
          }
        },
        {
          $project: {
            totalSearches: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            totalClicks: 1,
            avgExecutionTime: 1,
            searchTypes: 1
          }
        }
      ]);

      const result = stats[0] || {};

      try {
        await redisCluster.setex(cacheKey, 300, JSON.stringify(result));
      } catch (error) {
        logger.warn('Redis cache set failed:', error);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get global search stats:', error);
      throw new Error(`Failed to retrieve global search stats: ${error.message}`);
    }
  }

  static async getTrendingSearches(limit = 10, timeFrame = '24h') {
    try {
      const hours = timeFrame === '24h' ? 24 : 168; // 24h or 7d
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await SearchHistory.aggregate([
        { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
        { $unwind: '$searchKeywords' },
        {
          $group: {
            _id: '$searchKeywords',
            count: { $sum: 1 },
            avgResults: { $avg: '$stats.resultCount' },
            avgClicks: { $avg: '$stats.clickCount' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);
    } catch (error) {
      logger.error('Failed to get trending searches:', error);
      throw new Error(`Failed to retrieve trending searches: ${error.message}`);
    }
  }
}

// Search Event Service
class SearchEventService {
  static async emit(eventType, data) {
    try {
      // Log event
      logger.info(`Search Event: ${eventType}`, data);

      // Store in Redis for real-time analytics
      const eventKey = `search_event:${eventType}:${Date.now()}`;
      await redisCluster.setex(eventKey, 3600, JSON.stringify(data));

      // Emit to other services if needed
      if (eventType === 'analytics:search_created') {
        await this.handleSearchCreated(data);
      } else if (eventType === 'analytics:search_clicked') {
        await this.handleSearchClicked(data);
      }
    } catch (error) {
      logger.error('Search event emission failed:', error);
      throw new Error(`Failed to emit search event: ${error.message}`);
    }
  }

  static async handleSearchCreated(data) {
    try {
      await UserActivity.create({
        userId: data.userId,
        activityType: 'search',
        metadata: {
          searchId: data.searchId,
          query: data.query,
          type: data.type
        }
      });
    } catch (error) {
      logger.error('Failed to handle search created event:', error);
      throw new Error(`Failed to handle search created event: ${error.message}`);
    }
  }

  static async handleSearchClicked(data) {
    try {
      await SearchHistory.updateOne(
        { searchId: data.searchId },
        {
          $inc: { 'stats.clickCount': 1 },
          $set: { 'stats.lastClickedAt': new Date() }
        }
      );
    } catch (error) {
      logger.error('Failed to handle search clicked event:', error);
      throw new Error(`Failed to handle search clicked event: ${error.message}`);
    }
  }
}

// Search Vector Service for semantic search
class SearchVectorService {
  static pinecone = null;
  static index = null;

  static async initialize() {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      throw new Error('Missing Pinecone configuration: PINECONE_API_KEY or PINECONE_INDEX_NAME');
    }
    if (!this.pinecone) {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
      this.index = this.pinecone.index(process.env.PINECONE_INDEX_NAME);
      logger.info('Pinecone initialized successfully');
    }
  }

  static async generateSearchEmbedding(searchDoc) {
    try {
      await this.initialize();

      const textContent = [
        searchDoc.query,
        ...searchDoc.searchKeywords,
        searchDoc.metadata.type
      ].join(' ');

      // Generate embedding using OpenAI
      const embedding = await this.generateEmbedding(textContent);

      // Store in Pinecone
      await this.index.upsert([{
        id: searchDoc.searchId,
        values: embedding,
        metadata: {
          userId: searchDoc.userId,
          query: searchDoc.query,
          type: searchDoc.metadata.type,
          createdAt: searchDoc.createdAt
        }
      }]);

      // Store in MongoDB for backup
      searchDoc.embedding = embedding;
    } catch (error) {
      logger.error('Failed to generate search embedding:', error);
      throw new Error(`Failed to generate search embedding: ${error.message}`);
    }
  }

  static async generateEmbedding(text) {
    try {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);
      const response = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: text,
      });
      return response.data.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  static async findSimilarSearches(query, userId, limit = 10) {
    try {
      await this.initialize();

      const queryEmbedding = await this.generateEmbedding(query);

      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK: limit,
        filter: { userId },
        includeMetadata: true
      });

      return searchResponse.matches || [];
    } catch (error) {
      logger.error('Failed to find similar searches:', error);
      throw new Error(`Failed to find similar searches: ${error.message}`);
    }
  }
}

// Search Index Monitoring Service
class SearchIndexMonitoringService {
  static async checkIndexHealth() {
    try {
      const stats = await SearchHistory.collection.stats();
      const indexStats = await SearchHistory.collection.getIndexes();

      const health = {
        collectionSize: stats.size,
        documentCount: stats.count,
        avgDocumentSize: stats.avgObjSize,
        indexCount: indexStats.length,
        indexes: indexStats.map(idx => ({
          name: idx.name,
          keys: idx.key,
          size: idx.size || 0
        })),
        timestamp: new Date()
      };

      await redisCluster.setex('search_index_health', 300, JSON.stringify(health));
      return health;
    } catch (error) {
      logger.error('Index health check failed:', error);
      throw new Error(`Failed to check index health: ${error.message}`);
    }
  }

  static async optimizeIndexes() {
    try {
      await SearchHistory.collection.reIndex();
      logger.info('Search indexes optimized successfully');
      return true;
    } catch (error) {
      logger.error('Index optimization failed:', error);
      throw new Error(`Failed to optimize indexes: ${error.message}`);
    }
  }
}

// Search Maintenance Service
class SearchMaintenanceService {
  static async cleanupOldSearches() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const result = await SearchHistory.deleteMany({
        createdAt: { $lt: cutoffDate },
        isDeleted: true
      });

      logger.info(`Cleaned up ${result.deletedCount} old search records`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Search cleanup failed:', error);
      throw new Error(`Failed to clean up old searches: ${error.message}`);
    }
  }

  static async archiveInactiveSearches() {
    try {
      const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const result = await SearchHistory.updateMany(
        {
          createdAt: { $lt: cutoffDate },
          'stats.clickCount': 0,
          isDeleted: false
        },
        {
          $set: { isDeleted: true, archivedAt: new Date() }
        }
      );

      logger.info(`Archived ${result.modifiedCount} inactive searches`);
      return result.modifiedCount;
    } catch (error) {
      logger.error('Search archival failed:', error);
      throw new Error(`Failed to archive inactive searches: ${error.message}`);
    }
  }

  static async deduplicateSearches() {
    try {
      const duplicates = await SearchHistory.aggregate([
        {
          $group: {
            _id: { userId: '$userId', queryHash: '$queryHash' },
            count: { $sum: 1 },
            docs: { $push: '$_id' }
          }
        },
        { $match: { count: { $gt: 1 } } }
      ]);

      let removedCount = 0;
      for (const duplicate of duplicates) {
        const [keep, ...remove] = duplicate.docs;
        await SearchHistory.deleteMany({ _id: { $in: remove } });
        removedCount += remove.length;
      }

      logger.info(`Removed ${removedCount} duplicate searches`);
      return removedCount;
    } catch (error) {
      logger.error('Search deduplication failed:', error);
      throw new Error(`Failed to deduplicate searches: ${error.message}`);
    }
  }
}

// Pre-save middleware
searchHistorySchema.pre('save', async function (next) {
  try {
    const crypto = await import('crypto');

    this.updatedAt = new Date();
    if (!this.isNew) {
      this.version += 1;
    }

    // Sanitize user IDs
    if (this.createdBy) {
      this.createdBy = sanitizeUserId(this.createdBy);
    }
    if (this.updatedBy) {
      this.updatedBy = sanitizeUserId(this.updatedBy);
    }

    // Generate query hash for deduplication
    this.queryHash = crypto.createHash('md5')
      .update(`${this.userId}:${this.query}:${JSON.stringify(this.metadata.filters)}`)
      .digest('hex');

    // Generate search keywords
    this.searchKeywords = [
      ...this.query.toLowerCase().split(/\s+/),
      ...this.metadata.filters.skills.map((s) => s.name),
      ...this.metadata.filters.excludeKeywords,
      this.metadata.type,
    ]
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 20); // Limit keywords

    // Set priority based on user engagement
    if (this.stats.clickCount > 0) {
      this.priority = Math.min(10, this.stats.clickCount * 2);
    }

    // Emit events
    if (this.isNew) {
      await SearchEventService.emit('analytics:search_created', {
        searchId: this.searchId,
        userId: this.userId,
        query: this.query,
        type: this.metadata.type,
        filters: this.metadata.filters,
      });
    } else if (this.isModified()) {
      await SearchEventService.emit('analytics:search_updated', {
        searchId: this.searchId,
        changes: this.modifiedPaths(),
      });
    }

    // Generate vector embedding
    await SearchVectorService.generateSearchEmbedding(this);

    next();
  } catch (error) {
    logger.error('Search pre-save error:', error);
    next(error);
  }
});

// Enhanced static methods
searchHistorySchema.statics.findUserSearches = function (userId, pagination = {}) {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = pagination;

  return this.find({
    userId,
    isDeleted: false,
  })
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

searchHistorySchema.statics.findPopularSearches = function (timeFrame = '7d', limit = 10) {
  const days = timeFrame === '7d' ? 7 : 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
    {
      $group: {
        _id: '$queryHash',
        query: { $first: '$query' },
        count: { $sum: 1 },
        avgResults: { $avg: '$stats.resultCount' },
        totalClicks: { $sum: '$stats.clickCount' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

searchHistorySchema.statics.bulkInsertSearches = function (searches) {
  return this.insertMany(searches, { ordered: false, rawResult: true });
};

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

export {
  SearchStatsService,
  SearchEventService,
  SearchVectorService,
  SearchIndexMonitoringService,
  SearchMaintenanceService,
};
export default SearchHistory;

////////////////////////////////////////////////////////
export class CacheManager {
  static async getMultiLevel(key, userId = null) {
    const userKey = userId ? `${key}:${userId}` : key;

    try {
      // L1 Cache: Hot data (30 seconds)
      let result = await redisCluster.get(`hot:${userKey}`);
      if (result) {
        cacheHits.inc({ cache_type: 'hot' });
        return JSON.parse(result);
      }

      // L2 Cache: Warm data (5 minutes)
      result = await redisCluster.get(`warm:${userKey}`);
      if (result) {
        cacheHits.inc({ cache_type: 'warm' });
        // Promote to hot cache
        await redisCluster.setex(`hot:${userKey}`, 30, result);
        return JSON.parse(result);
      }

      // L3 Cache: Cold data (30 minutes)
      result = await redisCluster.get(`cold:${key}`); // No user-specific cold cache
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
    const userKey = userId ? `${key}:${userId}` :  key;
    const dataStr = JSON.stringify(data);
    
    try {
      // Set all cache levels
      await Promise.all([
        redisCluster.setex(`hot:${userKey}`, 30, dataStr),
        redisCluster.setex(`warm:${userKey}`, 300, dataStr),
        redisCluster.setex(`cold:${key}`, 1800, dataStr)
      ]);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }
}

/////////////////////////////////////////////////////
export class PersonalizationEngine {
  static async getUserProfile(userId) {
    const cacheKey = `user:profile:${userId}`;
    let profile = await CacheManager.getMultiLevel(cacheKey);
    
    if (!profile) {
      const user = await User.findById(userId).select('profile skills preferences').lean();
      const activities = await UserActivity.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      
      const applications = await JobApplication.find({ userId })
        .populate('jobId', 'skills location salary jobType companyName')
        .limit(20)
        .lean();

      profile = {
        skills: user.skills || [],
        preferences: user.preferences || {},
        behaviorScore: this.calculateBehaviorScore(activities),
        applicationPattern: this.analyzeApplicationPattern(applications),
        lastActive: new Date()
      };
      
      await CacheManager.setMultiLevel(cacheKey, profile, userId);
    }
    
    return profile;
  }

 static calculateBehaviorScore(activities) {
    const scores = {
      skillInterest: new Map(),
      locationInterest: new Map(),
      companyTypeInterest: new Map(),
      salaryRangeInterest: new Map()
    };

    activities.forEach(activity => {
      if (activity.type === 'job_view' || activity.type === 'job_click') {
        const weight = activity.type === 'job_click' ? 2 : 1;
        
        // Score skills
        if (activity.metadata?.skills) {
          activity.metadata.skills.forEach(skill => {
            scores.skillInterest.set(skill, 
              (scores.skillInterest.get(skill) || 0) + weight);
          });
        }
        
        // Score location
        if (activity.metadata?.location) {
          scores.locationInterest.set(activity.metadata.location,
            (scores.locationInterest.get(activity.metadata.location) || 0) + weight);
        }
      }
    });

    return {
      topSkills: Array.from(scores.skillInterest.entries())
  .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([skill]) => skill),
      topLocations: Array.from(scores.locationInterest.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([location]) => location)
    };
  }

  static analyzeApplicationPattern(applications) {
    if (!applications.length) return {};
    
    const patterns = {
      preferredCompanyTypes: new Map(),
      preferredJobTypes: new Map(),
      salaryExpectations: [],
      skillFrequency: new Map()
    };

    applications.forEach(app => {
      if (app.jobId) {
        // Company type analysis
        const companyType = app.jobId.companySize || 'unknown';
        patterns.preferredCompanyTypes.set(companyType,
          (patterns.preferredCompanyTypes.get(companyType) || 0) + 1);
        
        // Job type analysis  
        patterns.preferredJobTypes.set(app.jobId.jobType,
          (patterns.preferredJobTypes.get(app.jobId.jobType) || 0) + 1);
        
        // Salary expectations
        if (app.jobId.salary) {
          patterns.salaryExpectations.push(app.jobId.salary);
        }
        
        // Skills analysis
  if (app.jobId.skills) {
          app.jobId.skills.forEach(skill => {
            patterns.skillFrequency.set(skill,
              (patterns.skillFrequency.get(skill) || 0) + 1);
          });
        }
      }
    });

    return {
      topCompanyTypes: Array.from(patterns.preferredCompanyTypes.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([type]) => type),
      topJobTypes: Array.from(patterns.preferredJobTypes.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([type]) => type),
      avgSalaryExpectation: patterns.salaryExpectations.length > 0 
        ? patterns.salaryExpectations.reduce((a, b) => a + b, 0) / patterns.salaryExpectations.length 
        : 0,
      frequentSkills: Array.from(patterns.skillFrequency.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([skill]) => skill)
    };
  }

static calculatePersonalizationScore(job, userProfile) {
     // Skills match (40% weight)
    const skillWeight = 0.4;
    if (userProfile.behaviorScore?.topSkills?.length && job.skills?.length) {
      const skillMatches = job.skills.filter(skill => 
        userProfile.behaviorScore.topSkills.includes(skill)).length;
      score += (skillMatches / userProfile.behaviorScore.topSkills.length) * skillWeight;
    }
    maxScore += skillWeight;

    // Location preference (20% weight)
    const locationWeight = 0.2;
    if (userProfile.behaviorScore?.topLocations?.includes(job.location?.city)) {
      score += locationWeight;
    }
    maxScore += locationWeight;

    // Company type preference (20% weight)  
    const companyWeight = 0.2;
    if (userProfile.applicationPattern?.topCompanyTypes?.includes(job.companySize)) {
      score += companyWeight;
    }
    maxScore += companyWeight;

    // Job type preference (20% weight)
    const jobTypeWeight = 0.2;
    if (userProfile.applicationPattern?.topJobTypes?.includes(job.jobType)) {
      score += jobTypeWeight;
    }
    maxScore += jobTypeWeight;

    return maxScore > 0 ? (score / maxScore) * 100 : 50; // Default 50% if no data
  }
}


// Essential Compound Indexes for Performance:
db.jobs.createIndex({ "status": 1, "isDeleted": 1, "dates.expires": 1 }, { name: "active_jobs_idx" })
db.jobs.createIndex({ "dates.posted": -1, "status": 1 }, { name: "recent_jobs_idx" })
db.jobs.createIndex({ "location.city": 1, "status": 1, "dates.posted": -1 }, { name: "location_jobs_idx" })
db.jobs.createIndex({ "salary.min": 1, "salary.max": 1, "status": 1 }, { name: "salary_jobs_idx" })
db.jobs.createIndex({ "jobType": 1, "status": 1, "dates.posted": -1 }, { name: "jobtype_idx" })
db.jobs.createIndex({ "experience.level": 1, "status": 1 }, { name: "experience_idx" })
db.jobs.createIndex({ "industry": 1, "status": 1 }, { name: "industry_idx" })
db.jobs.createIndex({ "skills.name": 1, "status": 1 }, { name: "skills_idx" })
db.jobs.createIndex({ "company.name": 1, "status": 1 }, { name: "company_idx" })
db.jobs.createIndex({ "location.coordinates": "2dsphere" }, { name: "geo_idx" })
// Text Search Index:
db.jobs.createIndex({
  "title": "text",
  "description.summary": "text",
  "skills.name": "text",
  "company.name": "text"
}, {
  name: "text_search_idx",
  weights: { "title": 10, "skills.name": 5, "company.name": 3, "description.summary": 1 }
})
// Partial Indexes for Active Jobs Only:
db.jobs.createIndex(
  { "dates.posted": -1 },
  {
    partialFilterExpression: { "status": "active", "isDeleted": false },
    name: "active_recent_idx"
  }
)
