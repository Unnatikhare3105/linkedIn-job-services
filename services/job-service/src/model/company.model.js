import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { sanitizeUserId } from '../utils/security.js';
import redisClient from '../config/redis.js';
import dotenv from 'dotenv';
import pkg from '@pinecone-database/pinecone';
import NodeGeocoder from 'node-geocoder';

dotenv.config();
const { Pinecone } = pkg;

// Enhanced UUID validator
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validateUUID = (v) => uuidRegex.test(v);

// Geocoder setup
const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
});

// Optimized Company Schema
const companySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 36,
      default: uuidv4,
      validate: { validator: validateUUID, message: 'Invalid UUID format' },
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
      validate: {
        validator: (v) => /^[a-zA-Z0-9\s\-'&.,]+$/.test(v),
        message: 'Company name contains invalid characters',
      },
    },
    companySlug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 100,
      validate: {
        validator: (v) => !v || /^[a-zA-Z0-9\s\-'&.,]+$/.test(v),
        message: 'Display name contains invalid characters',
      },
    },
    industry: {
      type: String,
      required: true,
      enum: [
        'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing',
        'Retail', 'Construction', 'Transportation', 'Media', 'Government',
        'Non-Profit', 'Real Estate', 'Energy', 'Agriculture', 'Hospitality',
        'Consulting', 'Legal', 'Marketing', 'Telecommunications',
        'Biotechnology', 'E-commerce', 'Gaming', 'Cybersecurity', 'Other'
      ],
      index: true,
    },
    subIndustry: {
      type: String,
      maxlength: 100,
      trim: true,
    },
    companyType: {
      type: String,
      enum: ['Startup', 'SME', 'Large Enterprise', 'MNC', 'Government', 'Non-Profit'],
      default: 'SME',
      index: true,
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'],
      index: true,
    },
    foundedYear: {
      type: Number,
      min: 1800,
      validate: {
        validator: (v) => v <= new Date().getFullYear(),
        message: 'Founded year cannot be in the future',
      },
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Invalid email format',
      },
    },
    phone: {
      country: { type: String, default: '+91', maxlength: 4 },
      number: {
        type: String,
        required: true,
        validate: {
          validator: (v) => /^\d{10,15}$/.test(v),
          message: 'Invalid phone number',
        },
      },
    },
    website: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^https?:\/\/.+\..+/.test(v),
        message: 'Invalid website URL',
      },
    },
    headquarters: {
      address: { type: String, required: true, maxlength: 200 },
      city: { type: String, required: true, maxlength: 50, index: true },
      state: { type: String, required: true, maxlength: 50 },
      country: { type: String, default: 'India', maxlength: 50 },
      pincode: { type: String, maxlength: 10 },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere' },
      },
    },
    descriptions: {
      short: {
        type: String,
        maxlength: 300,
        validate: {
          validator: (v) => !v || (v.length >= 10 && !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v)),
          message: 'Short description must be at least 10 characters and safe',
        },
      },
      detailed: {
        type: String,
        maxlength: 2000,
        validate: {
          validator: (v) => !v || !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v),
          message: 'Description contains unsafe content',
        },
      },
      tagline: {
        type: String,
        maxlength: 150,
        validate: {
          validator: (v) => !v || !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v),
          message: 'Tagline contains unsafe content',
        },
      },
    },
    media: {
      logo: { url: String, publicId: String, uploadedAt: Date },
      coverImage: { url: String, publicId: String, uploadedAt: Date },
    },
    socialMedia: {
      linkedin: String,
      twitter: String,
      facebook: String,
      instagram: String,
      youtube: String,
      github: String,
    },
    subscription: {
      plan: {
        type: String,
        enum: ['Free', 'Basic', 'Professional', 'Enterprise'],
        default: 'Free',
        index: true,
      },
      planId: {
        type: String,
        default: uuidv4,
        validate: { validator: validateUUID, message: 'Invalid plan UUID' },
      },
      isActive: { type: Boolean, default: true, index: true },
      startDate: Date,
      endDate: Date,
      limits: {
        jobPosts: { type: Number, default: 5 },
        featuredJobs: { type: Number, default: 0 },
        resumeViews: { type: Number, default: 10 },
      },
    },
    account: {
      status: {
        type: String,
        enum: ['Active', 'Suspended', 'Pending', 'Rejected'],
        default: 'Pending',
        index: true,
      },
      isVerified: { type: Boolean, default: false, index: true },
      verifiedAt: Date,
      verificationMethod: {
        type: String,
        enum: ['Email', 'Phone', 'Document', 'Manual'],
      },
    },
    stats: {
      totalJobs: { type: Number, default: 0, min: 0 },
      activeJobs: { type: Number, default: 0, min: 0 },
      totalApplications: { type: Number, default: 0, min: 0 },
      successfulHires: { type: Number, default: 0, min: 0 },
      profileViews: { type: Number, default: 0, min: 0 },
      lastJobPosted: Date,
      successRate: { type: Number, default: 0, min: 0, max: 100 },
    },
    preferences: {
      jobCategories: [{ type: String, maxlength: 50 }],
      skillsets: [{ type: String, maxlength: 50, index: 'text' }],
      experienceLevels: [{
        type: String,
        enum: ['Fresher', 'Entry Level', 'Mid Level', 'Senior Level', 'Executive'],
      }],
      workTypes: [{
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
      }],
      remoteWork: {
        type: String,
        enum: ['On-site', 'Remote', 'Hybrid'],
        default: 'On-site',
      },
    },
    seo: {
      metaTitle: { type: String, maxlength: 60 },
      metaDescription: { type: String, maxlength: 160 },
      keywords: [{ type: String, maxlength: 30 }],
      slug: { type: String, unique: true, sparse: true },
    },
    features: {
      isFeatured: { type: Boolean, default: false, index: true },
      isPremium: { type: Boolean, default: false, index: true },
      allowDirectContact: { type: Boolean, default: true },
      showSalaryRange: { type: Boolean, default: false },
      autoPostToSocial: { type: Boolean, default: false },
    },
    analytics: {
      viewCount: { type: Number, default: 0, min: 0 },
      applicationCount: { type: Number, default: 0, min: 0 },
      engagementScore: { type: Number, default: 0, min: 0, max: 100 },
      lastCalculated: { type: Date, default: Date.now },
    },
    audit: {
      createdBy: {
        type: String,
        required: true,
        validate: { validator: validateUUID, message: 'Invalid creator UUID' },
      },
      updatedBy: {
        type: String,
        validate: { validator: validateUUID, message: 'Invalid updater UUID' },
      },
      version: { type: Number, default: 1, min: 1 },
      isDeleted: { type: Boolean, default: false, index: true },
      deletedAt: Date,
      deletedBy: String,
    },
    relationships: {
      activeJobsCount: { type: Number, default: 0, min: 0 },
      totalReviewsCount: { type: Number, default: 0, min: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'companies',
    minimize: false,
    strict: true,
    trackRevisions: false,
  }
);

// Optimized Indexes
companySchema.index({ companyId: 1 });
companySchema.index({ companySlug: 1 });
companySchema.index({
  'account.status': 1,
  'account.isVerified': 1,
  industry: 1,
  'audit.isDeleted': 1
});
companySchema.index({ 'headquarters.coordinates': '2dsphere' });
companySchema.index({ 'headquarters.city': 1, industry: 1, 'audit.isDeleted': 1 });
companySchema.index({ 'stats.profileViews': -1, createdAt: -1 });
companySchema.index({ 'features.isFeatured': 1, 'account.status': 1, 'audit.isDeleted': 1 });
companySchema.index({
  companyName: 'text',
  'descriptions.short': 'text',
  'preferences.skillsets': 'text'
}, {
  name: 'company_search_index',
  weights: { companyName: 10, 'descriptions.short': 5, 'preferences.skillsets': 1 }
});
companySchema.index({ 'subscription.plan': 1, 'subscription.isActive': 1 });
companySchema.index(
  { 'audit.deletedAt': 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60,
    partialFilterExpression: { 'audit.isDeleted': true }
  }
);

// Pre-save Middleware
companySchema.pre('save', async function(next) {
  try {
    if (!this.companySlug && this.companyName) {
      this.companySlug = this.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
    if (this.isModified('headquarters') && !this.headquarters.coordinates.coordinates.length) {
      const address = `${this.headquarters.address}, ${this.headquarters.city}, ${this.headquarters.state}, ${this.headquarters.country}`;
      const result = await geocoder.geocode(address);
      if (result.length > 0) {
        this.headquarters.coordinates.coordinates = [result[0].longitude, result[0].latitude];
      } else {
        logger.warn('Geocoding failed: No results found', { companyId: this.companyId, address });
      }
    }
    if (this.audit && this.audit.updatedBy) {
      this.audit.updatedBy = sanitizeUserId(this.audit.updatedBy);
    }
    next();
  } catch (error) {
    logger.error('Pre-save middleware failed', { companyId: this.companyId, error: error.message });
    next(error);
  }
});

// Post-save Middleware
companySchema.post('save', async function(doc) {
  try {
    await redisClient.del(`company:${doc.companyId}`);
    await redisClient.del(`company:slug:${doc.companySlug}`);
    logger.info('Company document saved', {
      companyId: doc.companyId,
      operation: 'save',
      version: doc.audit.version
    });
  } catch (error) {
    logger.error('Post-save cache invalidation failed', {
      companyId: doc.companyId,
      error: error.message
    });
  }
});

// Static Methods
companySchema.statics.findForListing = function(filters = {}, options = {}) {
  const {
    page = 1,
    limit = 20,
    sort = { 'stats.profileViews': -1, createdAt: -1 }
  } = options;
  const query = {
    'account.status': 'Active',
    'audit.isDeleted': false,
    ...filters
  };
  return this.find(query, {
    companyId: 1,
    companyName: 1,
    companySlug: 1,
    industry: 1,
    companySize: 1,
    'headquarters.city': 1,
    'headquarters.state': 1,
    'media.logo': 1,
    'descriptions.tagline': 1,
    'stats.profileViews': 1,
    'features.isFeatured': 1,
    'features.isPremium': 1,
    'relationships.averageRating': 1,
    createdAt: 1
  })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

companySchema.statics.findProfile = function(identifier) {
  const query = typeof identifier === 'string' && identifier.includes('-')
    ? { companySlug: identifier }
    : { companyId: identifier };
  return this.findOne({
    ...query,
    'audit.isDeleted': false
  }).select('-audit -__v').lean();
};

companySchema.statics.searchCompanies = async function(searchQuery, filters = {}, options = {}) {
  const cacheKey = `search:${Buffer.from(JSON.stringify({ searchQuery, filters, options })).toString('base64')}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Cache retrieval failed', { error: error.message });
  }
  const query = {
    $text: { $search: searchQuery },
    'account.status': 'Active',
    'audit.isDeleted': false,
    ...filters
  };
  const results = await this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, 'stats.profileViews': -1 })
    .limit(options.limit || 50)
    .lean();
  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(results));
  } catch (error) {
    logger.warn('Cache storage failed', { error: error.message });
  }
  return results;
};

companySchema.statics.bulkUpdateStats = async function(updates) {
  const bulkOps = updates.map(({ companyId, stats }) => ({
    updateOne: {
      filter: { companyId, 'audit.isDeleted': false },
      update: {
        $set: {
          stats,
          'analytics.lastCalculated': new Date(),
          updatedAt: new Date()
        },
        $inc: { 'audit.version': 1 }
      }
    }
  }));
  return this.bulkWrite(bulkOps, { ordered: false });
};

// Connection Optimization
mongoose.set('maxTimeMS', 30000); // Set query timeout to 30 seconds
mongoose.set('bufferCommands', true); // Enable command buffering

// Create the Model
const Company = mongoose.model('Company', companySchema);

// Services
class CompanyStatsService {
  static async updateAnalytics(companyId) {
    try {
      const stats = await this.calculateStats(companyId);
      await Company.updateOne(
        { companyId },
        {
          $set: {
            analytics: stats,
            'analytics.lastCalculated': new Date()
          }
        }
      );
      await redisClient.del(`company:${companyId}`);
    } catch (error) {
      logger.error('Stats update failed', { companyId, error: error.message });
      throw error;
    }
  }
  static async calculateStats(companyId) {
    return {
      viewCount: 0,
      applicationCount: 0,
      engagementScore: 0,
      lastCalculated: new Date()
    };
  }
}

class CompanyEventService {
  static async logEvent(companyId, eventType, data = {}) {
    try {
      logger.info('Company event', {
        companyId,
        eventType,
        data,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Event logging failed', { companyId, eventType, error: error.message });
    }
  }
}

class CompanyVectorService {
  static async updateEmbedding(companyId) {
    try {
      const company = await Company.findOne({ companyId }).lean();
      if (!company) return;
      const text = [
        company.companyName,
        company.descriptions?.detailed || '',
        company.preferences?.skillsets?.join(' ') || ''
      ].join(' ');
      // Store in Pinecone (configured in .env)
    } catch (error) {
      logger.error('Vector update failed', { companyId, error: error.message });
    }
  }
}

class CompanyIndexMonitoringService {
  static async monitorIndexUsage() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.collection('companies').indexStats();
      logger.info('Index usage stats', { stats });
      stats.forEach(index => {
        if (index.accesses.ops < 100 && index.name !== 'id') {
          logger.warn('Low index usage detected', {
            index: index.name,
            usage: index.accesses.ops
          });
        }
      });
    } catch (error) {
      logger.error('Index monitoring failed', { error: error.message });
    }
  }
}

class CompanyMaintenanceService {
  static async cleanupDeletedRecords() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await Company.deleteMany({
        'audit.isDeleted': true,
        'audit.deletedAt': { $lt: thirtyDaysAgo }
      });
      logger.info('Cleanup completed', { deletedCount: result.deletedCount });
    } catch (error) {
      logger.error('Cleanup failed', { error: error.message });
    }
  }
  static async optimizeIndexes() {
    try {
      await mongoose.connection.db.collection('companies').reIndex();
      logger.info('Index optimization completed');
    } catch (error) {
      logger.error('Index optimization failed', { error: error.message });
    }
  }
}

export {
  CompanyStatsService,
  CompanyEventService,
  CompanyVectorService,
  CompanyIndexMonitoringService,
  CompanyMaintenanceService,
};
export default Company;