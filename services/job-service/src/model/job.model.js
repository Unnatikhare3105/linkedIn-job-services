// ===== CORE JOB SCHEMA (jobs collection) =====
import mongoose from 'mongoose';
import {kafkaProducer} from '../kafka/producer.js';
import redisClient from '../config/redis.js';
// ===== VECTOR DATABASE INTEGRATION (Production-ready with actual DB clients) =====
import pkg from '@pinecone-database/pinecone';
import JobAnalytics from './Insights.model.js';
import weaviate from 'weaviate-ts-client';
import { sanitizeUserId} from '../utils/security.js';
import logger  from '../utils/logger.js';
import dotenv from "dotenv";
dotenv.config();

const { Pinecone } = pkg;

const jobSchema = new mongoose.Schema({
  // Primary identifier - UUID v4 format
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 36,
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  },
  
  // Core job information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s\-\.,&()]+$/.test(v);
      },
      message: 'Title contains invalid characters'
    }
  },
  
  companyId: {
    type: String,
    required: true,
    index: true,
    maxlength: 36,
    validate: {
      validator: function(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'Invalid company ID format'
    }
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 5000,
    validate: {
      validator: function(v) {
        // Prevent script injection
        return !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v);
      },
      message: 'Description contains unsafe content'
    }
  },
  
  // Skills with weights for AI matching
  skills: [{
    name: {
      type: String,
      maxlength: 50,
      lowercase: true,
      trim: true,
      required: true,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9\s\-\.+#]+$/.test(v);
        },
        message: 'Skill name contains invalid characters'
      }
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    category: {
      type: String,
      enum: ['technical', 'soft', 'domain', 'tool', 'framework'],
      default: 'technical'
    }
  }],
  
  // Optimized location structure
  location: {
    city: { 
      type: String, 
      maxlength: 100, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^[a-zA-Z\s\-'\.]+$/.test(v);
        },
        message: 'City name contains invalid characters'
      }
    },
    state: { 
      type: String, 
      maxlength: 50, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^[a-zA-Z\s\-'\.]+$/.test(v);
        },
        message: 'State name contains invalid characters'
      }
    },
    country: { 
      type: String, 
      maxlength: 50, 
      trim: true, 
      default: 'India',
      validate: {
        validator: function(v) {
          return /^[a-zA-Z\s\-'\.]+$/.test(v);
        },
        message: 'Country name contains invalid characters'
      }
    },
    isRemote: { type: Boolean, default: false },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        validate: {
          validator: function(v) {
            return v.length === 2 && 
                   v[0] >= -180 && v[0] <= 180 && // longitude
                   v[1] >= -90 && v[1] <= 90;     // latitude
          },
          message: 'Invalid coordinates format'
        }
      }
    }
  },
  
  jobType: {
    type: String,
    required: true,
    enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'],
    index: true
  },
  
  salary: {
    min: { 
      type: Number, 
      min: 0, 
      max: 100000000,
      validate: {
        validator: function(v) {
          return !v || (Number.isInteger(v) && v >= 0);
        },
        message: 'Salary must be a valid positive integer'
      }
    },
    max: { 
      type: Number, 
      min: 0, 
      max: 100000000,
      validate: {
        validator: function(v) {
          return !v || (Number.isInteger(v) && v >= 0);
        },
        message: 'Salary must be a valid positive integer'
      }
    },
    currency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP'], default: 'INR' },
    isNegotiable: { type: Boolean, default: true },
    frequency: { type: String, enum: ['hourly', 'monthly', 'yearly'], default: 'yearly' }
  },
  
  experience: {
    level: {
      type: String,
      enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive'],
      required: true,
      index: true
    },
    minYears: { type: Number, min: 0, max: 50, default: 0 },
    maxYears: { type: Number, min: 0, max: 50 }
  },
  
  // Critical dates
  dates: {
    posted: { type: Date, default: Date.now, index: true },
    expires: { type: Date, index: true },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'expired', 'filled', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // Denormalized stats for quick access (updated via events)
  stats: {
    views: { type: Number, default: 0, min: 0 },
    applications: { type: Number, default: 0, min: 0 },
    saves: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    clickThroughRate: { type: Number, default: 0, min: 0, max: 1 },
    conversionRate: { type: Number, default: 0, min: 0, max: 1 }
  },
  
  requirements: {
    education: { 
      type: String, 
      maxlength: 200,
      validate: {
        validator: function(v) {
          return !v || !/[<>]/.test(v);
        },
        message: 'Education field contains unsafe characters'
      }
    },
    certifications: [{
      type: String,
      maxlength: 100,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9\s\-\.,()]+$/.test(v);
        },
        message: 'Certification name contains invalid characters'
      }
    }],
    mandatorySkills: [{
      type: String,
      maxlength: 50,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9\s\-\.+#]+$/.test(v);
        },
        message: 'Skill name contains invalid characters'
      }
    }],
    preferredSkills: [{
      type: String,
      maxlength: 50,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9\s\-\.+#]+$/.test(v);
        },
        message: 'Skill name contains invalid characters'
      }
    }]
  },
  
  benefits: {
    healthInsurance: { type: Boolean, default: false },
    paidLeave: { type: Number, min: 0, max: 365 },
    stockOptions: { type: Boolean, default: false },
    remoteWork: { type: Boolean, default: false },
    flexibleHours: { type: Boolean, default: false },
    others: [{
      type: String,
      maxlength: 100,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9\s\-\.,()]+$/.test(v);
        },
        message: 'Benefit description contains invalid characters'
      }
    }]
  },
  
  department: { 
    type: String, 
    maxlength: 100, 
    index: true,
    validate: {
      validator: function(v) {
        return !v || /^[a-zA-Z0-9\s\-&]+$/.test(v);
      },
      message: 'Department name contains invalid characters'
    }
  },
  industry: {
    type: String,
    enum: ['technology', 'healthcare', 'finance', 'education', 'manufacturing', 'retail', 'consulting', 'other'],
    index: true
  },
  
  // AI/ML optimization fields
  searchKeywords: [{
    type: String,
    maxlength: 50,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s\-\.]+$/.test(v);
      },
      message: 'Search keyword contains invalid characters'
    }
  }],
  tags: [{
    type: String,
    maxlength: 30,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\-]+$/.test(v);
      },
      message: 'Tag contains invalid characters'
    }
  }],
  
  // Feature flags
  isFeatured: { type: Boolean, default: false, index: true },
  isUrgent: { type: Boolean, default: false, index: true },
  
  // Diversity & inclusion
  diversityTags: [{
    type: String,
    enum: ['women-friendly', 'lgbtq-friendly', 'disability-friendly', 'minority-friendly']
  }],
  
  // Application flow with security validation
  applicationMethod: {
    type: String,
    enum: ['internal', 'external', 'email', 'linkedin'],
    default: 'internal'
  },
  applicationUrl: { 
    type: String, 
    maxlength: 500,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Must be HTTPS for security
        return /^https:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/.test(v);
      },
      message: 'Application URL must be a valid HTTPS URL'
    }
  },
  
  // Secure audit fields
  createdBy: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'createdBy must be a valid user ID'
    }
  },
  updatedBy: { 
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'updatedBy must be a valid user ID'
    }
  },
  version: { type: Number, default: 1, min: 1 },
  isDeleted: { type: Boolean, default: false, index: true }
  
}, {
  timestamps: true,
  versionKey: false,
  collection: 'jobs'
});

// ===== OPTIMIZED INDEXES (Reduced for better write performance) =====
// Core indexes only - monitor usage and add more if needed
jobSchema.index({ status: 1, 'dates.posted': -1 });
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ 'location.coordinates': '2dsphere' });
jobSchema.index({ 'skills.name': 1, status: 1 });
jobSchema.index({ jobType: 1, 'experience.level': 1, status: 1 });
jobSchema.index({ isFeatured: 1, status: 1, 'dates.posted': -1 });

// Text search index
jobSchema.index({
  title: 'text',
  description: 'text',
  searchKeywords: 'text'
}, {
  weights: { title: 10, searchKeywords: 5, description: 1 },
  name: 'job_search_index'
});

// TTL for expired jobs
jobSchema.index({ 'dates.expires': 1 }, { expireAfterSeconds: 86400 });

// ===== REDIS STATS SERVICE (Atomic operations for race condition prevention) =====
class StatsService {
  static async incrementJobStats(jobId, statType, count = 1) {
    try {
      // Atomic increment in Redis
      const redisKey = `job:stats:${jobId}:${statType}`;
      await redisClient.incrBy(redisKey, count); // Removed statType argument
      logger.info(`Incremented ${statType} for job ${jobId} by ${count}`); // Use logger

      // Set expiry for cleanup (7 days)
      await redisClient.expire(redisKey, 7 * 24 * 60 * 60);
      
      // Schedule batch flush to MongoDB
      await this.scheduleBatchFlush(jobId);
      
    } catch (error) {
      console.error('Failed to increment stats in Redis:', error);
      // Fallback to direct MongoDB update
      await Job.updateOne({ jobId }, { $inc: { [`stats.${statType}`]: count } });
    }
  }
  
  static async scheduleBatchFlush(jobId) {
    // Add to batch queue (Redis Set)
    await redisClient.sAdd('stats:flush:queue', jobId); // Changed to sAdd
    
    // Schedule flush job (every 5 minutes)
    await redisClient.setEx(`stats:flush:scheduled:${jobId}`, 300, '1'); // Changed to setEx
  }
  
  static async batchFlushStats() {
    try {
      // Get all jobs pending stats flush
      const jobIds = await redisClient.sMembers('stats:flush:queue'); // Changed to sMembers
      
      for (const jobId of jobIds) {
        const stats = {};
        
        // Get all stats for this job
        const keys = await redisClient.keys(`job:stats:${jobId}:*`);
        for (const key of keys) {
          const statType = key.split(':').pop();
          const count = await redisClient.get(key);
          if (count && count > 0) {
            stats[`stats.${statType}`] = parseInt(count);
          }
        }
        
        if (Object.keys(stats).length > 0) {
          // Batch update MongoDB
          await Job.updateOne({ jobId }, { $inc: stats });
          
          // Clear Redis keys after successful flush
          await redisClient.del(keys);
        }
        
        // Remove from queue
        await redisClient.sRem('stats:flush:queue', jobId); // Changed to sRem
      }
      
    } catch (error) {
      console.error('Failed to batch flush stats:', error);
    }
  }
}

// ===== KAFKA INTEGRATION WITH DEAD LETTER QUEUE =====
class JobEventService {
  static async emit(eventType, data) {
    let kafkaSuccess = false;
    let redisSuccess = false;
    
    try {
      // Primary: Send to Kafka
      await kafkaProducer.send({
        topic: 'job-events',
        messages: [{
          key: data.jobId,
          value: JSON.stringify({
            eventType,
            data,
            timestamp: new Date().toISOString(),
            retryCount: 0
          })
        }]
      });
      kafkaSuccess = true;
      
    } catch (kafkaError) {
      console.error('Kafka publish failed:', kafkaError);
    }
    
    try {
      // Secondary: Store in Redis for real-time features
      await redisClient.lPush(`events:${data.jobId}`, JSON.stringify({  // Changed to lPush
        eventType,
        data,
        timestamp: new Date().toISOString()
      }));
      
      // Keep only last 100 events per job
      await redisClient.lTrim(`events:${data.jobId}`, 0, 99);  // Changed to lTrim
      redisSuccess = true;
      
    } catch (redisError) {
      console.error('Redis publish failed:', redisError);
    }
    
    // If both fail, store in dead letter queue (MongoDB)
    if (!kafkaSuccess && !redisSuccess) {
      await this.storeInDeadLetterQueue(eventType, data);
    }
  }
  
  static async storeInDeadLetterQueue(eventType, data) {
    try {
      await mongoose.connection.db.collection('event_dead_letters').insertOne({
        eventType,
        data,
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending'
      });
    } catch (error) {
      console.error('CRITICAL: All event systems failed:', { eventType, data, error });
    }
  }
}

// ===== MIDDLEWARE =====
jobSchema.pre('save', async function(next) {
  try {
    this.dates.lastUpdated = new Date();
    
    // Only increment version on updates, not on new documents
    if (!this.isNew) {
      this.version += 1;
    }
    
    // Security: Sanitize audit fields
    if (this.createdBy) {
      this.createdBy = sanitizeUserId(this.createdBy);
    }
    if (this.updatedBy) {
      this.updatedBy = sanitizeUserId(this.updatedBy);
    }
    
    // Validation
    if (this.salary.min && this.salary.max && this.salary.min > this.salary.max) {
      throw new Error('Invalid salary range');
    }
    
    if (this.experience.minYears && this.experience.maxYears && 
        this.experience.minYears > this.experience.maxYears) {
      throw new Error('Invalid experience range');
    }
    
    // Auto-expire logic
    if (!this.dates.expires) {
      this.dates.expires = new Date(Date.now() + (90 * 24 * 60 * 60 * 1000));
    }
    
    // Generate search keywords
    const skillNames = this.skills.map(s => s.name);
    this.searchKeywords = [
      ...this.title.toLowerCase().split(/\s+/),
      ...skillNames,
      this.jobType,
      this.experience.level,
      this.industry,
      this.department
    ].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index);
    
    // Emit events via Kafka
    if (this.isNew) {
      await JobEventService.emit('job:created', {
        jobId: this.jobId,
        companyId: this.companyId,
        title: this.title,
        skills: this.skills.map(s => s.name),
        location: this.location
      });
    } else if (this.isModified()) {
      await JobEventService.emit('job:updated', {
        jobId: this.jobId,
        changes: this.modifiedPaths()
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// ===== STATIC METHODS =====
jobSchema.statics.findActiveJobs = function(filters = {}, pagination = {}) {
  const { page = 1, limit = 20 } = pagination;
  return this.find({
    status: 'active',
    isDeleted: false,
    'dates.expires': { $gt: new Date() },
    ...filters
  })
  .sort({ isFeatured: -1, 'dates.posted': -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .lean();
};

// ===== EVENT HANDLERS FOR KAFKA CONSUMERS (Updated with Redis stats) =====
class JobEventHandler {
  static async handleJobView(data) {
    try {
      // Emit to Kafka
      await JobEventService.emit('analytics:job_viewed', {
        jobId: data.jobId,
        userId: data.userId,
        timestamp: new Date().toISOString(),
        metadata: data.metadata
      });
      
      // Use Redis atomic increment instead of direct MongoDB update
      await StatsService.incrementJobStats(data.jobId, 'views');
      
      // Update daily analytics
      const today = new Date().toISOString().split('T')[0];
      await JobAnalytics.incrementMetric(data.jobId, today, 'metrics.views');
      
    } catch (error) {
      console.error('Failed to handle job view:', error);
    }
  }
  
  static async handleJobApplication(data) {
    try {
      await JobEventService.emit('analytics:job_applied', data);
      
      // Use Redis atomic increment
      await StatsService.incrementJobStats(data.jobId, 'applications');
      
      // Update daily analytics
      const today = new Date().toISOString().split('T')[0];
      await JobAnalytics.incrementMetric(data.jobId, today, 'metrics.applications');
      
      // Trigger ML pipeline
      await JobEventService.emit('ml:update_user_profile', {
        userId: data.userId,
        jobId: data.jobId,
        action: 'applied'
      });
      
    } catch (error) {
      console.error('Failed to handle job application:', error);
    }
  }
  
  static async handleJobSave(data) {
    try {
      await JobEventService.emit('analytics:job_saved', data);
      await StatsService.incrementJobStats(data.jobId, 'saves');
      
      const today = new Date().toISOString().split('T')[0];
      await JobAnalytics.incrementMetric(data.jobId, today, 'metrics.saves');
      
    } catch (error) {
      console.error('Failed to handle job save:', error);
    }
  }
}

class JobVectorService {
  static pinecone = new Pinecone({
    apiKey: "pcsk_5coq2J_S9dyVQu9WSSWo8kwhmvMjr4wHJXpxFUSow92SwEJPnRyfPbWF8onQAWFqJabjF6"
  });
  static weaviateClient = weaviate.client({
    scheme: 'https',
    host: process.env.WEAVIATE_HOST,
    apiKey:new weaviate.ApiKey(process.env.WEAVIATE_API_KEY)
  });
  
  static async generateJobEmbedding(job) {
    try {
      const jobText = [
        job.title,
        job.description,
        job.skills.map(s => s.name).join(' '),
        job.requirements.mandatorySkills?.join(' ') || ''
      ].join(' ');
      logger.info(`Generated Pinecone embedding for job: ${job.jobId}`);
      
      // Send to ML service for embedding generation
      await JobEventService.emit('ml:generate_job_vector', {
        jobId: job.jobId,
        text: jobText,
        metadata: {
          skills: job.skills,
          experience: job.experience,
          location: job.location,
          salary: job.salary,
          jobType: job.jobType
        }
      });
      
      // Alternative: Direct vector generation (if ML service handles it immediately)
      await this.storeInVectorDB(job.jobId, jobText, {
        skills: job.skills.map(s => s.name),
        experienceLevel: job.experience.level,
        location: `${job.location.city},
         ${job.location.state}`,
        jobType: job.jobType
      });
      
    } catch (error) {
      console.error('Failed to generate job embedding:', error);
    }
  }
  
  static async storeInVectorDB(jobId, text, metadata) {
    try {
      // Store in Pinecone
      const index = this.pinecone.Index('job-embeddings');
      
      // Generate embedding (assuming you have an embedding service)
      const embedding = await this.generateTextEmbedding(text);
      
      await index.upsert([{
        id: jobId,
        values: embedding,
        metadata: {
          ...metadata,
          text: text.substring(0, 1000), // Store truncated text for debugging
          timestamp: new Date().toISOString()
        }
      }]);
      
      // Also store in Weaviate for hybrid search
      await this.weaviateClient
        .data
        .creator()
        .withClassName('Job')
        .withId(jobId)
        .withProperties({
          text,
          ...metadata
        })
        .do();
        
    } catch (error) {
      console.error('Failed to store in vector database:', error);
    }
  }
  
  static async generateTextEmbedding(text) {
    // Placeholder for actual embedding generation
    // In production, use OpenAI, Cohere, or your own model
    return new Array(1536).fill(0).map(() => Math.random());
  }
  
  static async searchSimilarJobs(queryEmbedding, filters = {}) {
    try {
      const index = this.pinecone.Index('job-embeddings');
      
      const searchResults = await index.query({
        vector: queryEmbedding,
        topK: 20,
        includeMetadata: true,
        filter: filters
      });
      
      return searchResults.matches;
      
    } catch (error) {
      console.error('Failed to search similar jobs:', error);
      return [];
    }
  }
}

// ===== INDEX MONITORING SERVICE =====
class IndexMonitoringService {
  static async analyzeIndexUsage() {
    try {
      const db = mongoose.connection.db;
      
      // Get index statistics
      const indexStats = await db.collection('jobs').aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      console.log('Job Collection Index Usage Stats:');
      indexStats.forEach(stat => {
        const usageCount = stat.accesses.ops;
        const indexName = stat.name;
        
        console.log(`Index: ${indexName}, Usage: ${usageCount}`);
        
        // Flag unused indexes (less than 100 uses in monitoring period)
        if (usageCount < 100 && indexName !== 'id') {
          console.warn(`🚨 Low usage index detected: ${indexName} (${usageCount} uses)`);
        }
      });
      
      return indexStats;
      
    } catch (error) {
      console.error('Failed to analyze index usage:', error);
    }
  }
  
  static async dropUnusedIndexes(dryRun = true) {
    try {
      const stats = await this.analyzeIndexUsage();
      const unusedIndexes = stats.filter(stat => 
        stat.accesses.ops < 100 && 
        stat.name !== 'id' &&
        !stat.name.includes('text') // Keep text search indexes
      );
      
      if (dryRun) {
        console.log('Indexes that would be dropped:', unusedIndexes.map(i => i.name));
        return unusedIndexes;
      }
      
      // Actually drop unused indexes
      for (const indexStat of unusedIndexes) {
        await mongoose.connection.db.collection('jobs').dropIndex(indexStat.name);
        console.log(`Dropped unused index: ${indexStat.name}`);
      }
      
    } catch (error) {
      console.error('Failed to drop unused indexes:', error);
    }
  }
}

// ===== BATCH JOBS FOR MAINTENANCE =====
class JobMaintenanceService {
  // Run every 5 minutes
  static async flushStatsToMongo() {
    await StatsService.batchFlushStats();
  }
  
  // Run weekly
  static async analyzeIndexes() {
    await IndexMonitoringService.analyzeIndexUsage();
  }
  
  // Run daily
  static async cleanupExpiredJobs() {
    try {
      await Job.updateMany(
        { 
          'dates.expires': { $lt: new Date() },
          status: 'active'
        },
        { 
          status: 'expired',
          'dates.lastUpdated': new Date()
        }
      );
    } catch (error) {
      console.error('Failed to cleanup expired jobs:', error);
    }
  }
  
  // Run monthly  
  static async archiveOldAnalytics() {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const cutoffDate = threeMonthsAgo.toISOString().split('T')[0];
      
      // Archive to cold storage collection
      const oldAnalytics = await JobAnalytics.find({
        date: { $lt: cutoffDate }
      });
      
      if (oldAnalytics.length > 0) {
        await mongoose.connection.db.collection('job_analytics_archive')
          .insertMany(oldAnalytics);
          
        await JobAnalytics.deleteMany({
          date: { $lt: cutoffDate }
        });
        
        console.log(`Archived ${oldAnalytics.length} old analytics records`);
      }
      
    } catch (error) {
      console.error('Failed to archive old analytics:', error);
    }
  }
}

const Job = mongoose.model('Job', jobSchema);

export {
  JobEventHandler,
  JobEventService,
  JobVectorService,
  StatsService,
  IndexMonitoringService,
  JobMaintenanceService
};

export default Job;