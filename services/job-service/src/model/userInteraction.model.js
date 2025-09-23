import mongoose from 'mongoose';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import logger from '../utils/logger.js';
import redisClient from '../config/redis.js';
import { SearchEventService } from '../services/search.services.js';
import { generateSecureId } from '../utils/security.js';
import { cacheHits } from '../utils/metrics.js';

// TTL configurations
const TTL_CONFIG = {
  USER_INTERACTION: 2 * 365 * 24 * 60 * 60, // 2 years in seconds
  ANONYMOUS_SESSION: 7 * 24 * 60 * 60, // 7 days for anonymous sessions
  SECURITY_EVENT: 90 * 24 * 60 * 60, // 90 days for security events
};

const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const userInteractionSchema = new mongoose.Schema(
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
    isAnonymous: {
      type: Boolean,
      default: false,
      index: true,
    },
    activities: [{
      action: {
        type: String,
        required: true,
        enum: [
          'search', 'view_job', 'apply_job', 'save_job', 'unsave_job', 'update_profile',
          'login', 'logout', 'register', 'share_job', 'filter_search', 'bookmark_company',
          'view_company', 'other', 'COMPANY_PAGE_VIEW', 'EMPLOYEE_REVIEW_SUBMITTED',
          'CULTURE_INFO_VIEW', 'MATCH_CALCULATION', 'INVITATION_SENT', 'IN_APP_MESSAGE_SENT',
          'INTERVIEW_SCHEDULED', 'RECRUITER_CONTACT_INITIATED', 'INTERVIEW_CONFIRMED',
          'NOTIFICATION_SENT', 'NOTIFICATION_CLICKED', 'PRIVACY_UPDATED', 'SECURITY_EVENT',
        ],
        default: 'other',
      },
      entityType: {
        type: String,
        enum: ['job', 'company', 'search', 'review', 'invitation', 'message', 'interview', 'contact', 'confirmation', 'notification', 'privacy', 'security'],
      },
      details: {
        searchQuery: { type: String, maxlength: 500, trim: true },
        searchFilters: {
          location: { type: String, maxlength: 100, trim: true },
          jobType: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'] },
          experience: { type: String, enum: ['entry', 'mid', 'senior', 'executive'] },
          salary: { min: { type: Number, min: 0 }, max: { type: Number, min: 0 } },
        },
        jobTitle: { type: String, maxlength: 200, trim: true },
        companyName: { type: String, maxlength: 100, trim: true },
        applicationStatus: { type: String, enum: ['submitted', 'in_review', 'interviewed', 'rejected', 'accepted'] },
        sessionId: { type: String, maxlength: 36, trim: true },
        ipAddress: { type: String, maxlength: 45 },
        userAgent: { type: String, maxlength: 500, trim: true },
        pageLoadTime: { type: Number, min: 0 },
        timeSpent: { type: Number, min: 0 },
        requestId: { type: String, maxlength: 36, trim: true },
        reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', index: { sparse: true } },
        rating: { type: Number, min: 0, max: 5 },
        matchScore: { type: Number, min: 0, max: 100 },
        companySimilarityScore: { type: Number, min: 0, max: 100 },
        invitationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invitation', index: { sparse: true } },
        deliveryChannels: { type: [String], default: [] },
        conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: { sparse: true } },
        recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', index: { sparse: true } },
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', index: { sparse: true } },
        scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', index: { sparse: true } },
        interviewType: { type: String, enum: ['phone', 'video', 'in-person', 'other'] },
        contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', index: { sparse: true } },
        confirmationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Confirmation', index: { sparse: true } },
        notificationId: { type: String, validate: validUUIDRegex },
        securityEventType: { type: String, enum: ['login', 'password_change', '2fa_enable', 'account_lock'] },
        type: { type: String, maxlength: 50, trim: true },
      },
      jobId: { type: String, validate: validUUIDRegex, ref: 'Job' },
      searchId: { type: String, validate: validUUIDRegex, ref: 'Search' },
      companyId: { type: String, validate: validUUIDRegex, ref: 'Company' },
      location: {
        country: { type: String, maxlength: 2, uppercase: true },
        region: { type: String, maxlength: 100, trim: true },
        city: { type: String, maxlength: 100, trim: true },
        timezone: { type: String, maxlength: 50, trim: true },
      },
      platform: {
        device: { type: String, enum: ['desktop', 'mobile', 'tablet'], default: 'desktop' },
        os: { type: String, maxlength: 50, trim: true },
        browser: { type: String, maxlength: 50, trim: true },
        version: { type: String, maxlength: 20, trim: true },
      },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, default: () => new Date(Date.now() + TTL_CONFIG.USER_INTERACTION * 1000) },
    }],
    searchBehavior: {
      preferredFilters: [{ type: String, maxlength: 50 }],
      commonKeywords: [{ type: String, maxlength: 50 }],
      searchPatterns: [{ timeOfDay: { type: Number, min: 0, max: 23 }, frequency: { type: Number, default: 0 }, _id: false }],
    },
    jobInteractions: {
      viewedJobs: [{ jobId: { type: String, validate: validUUIDRegex }, viewedAt: Date, timeSpent: { type: Number, min: 0 }, source: { type: String, enum: ['search', 'trending', 'network', 'alumni'] }, _id: false }],
      savedJobs: [{ jobId: { type: String, validate: validUUIDRegex }, savedAt: Date, tags: [{ type: String, maxlength: 50 }], _id: false }],
      appliedJobs: [{ jobId: { type: String, validate: validUUIDRegex }, appliedAt: Date, applicationMethod: { type: String, enum: ['quick', 'custom', 'external'] }, _id: false }],
    },
    connections: [{
      connectionId: { type: String, default: generateSecureId, validate: validUUIDRegex },
      connectionType: { type: String, enum: ['friend', 'colleague', 'referral'], required: true },
      name: { type: String, maxlength: 100, required: true },
      email: { type: String, maxlength: 100 },
      company: { type: String, maxlength: 100 },
      companyId: { type: String, validate: { validator: (v) => !v || validUUIDRegex.test(v), message: 'Invalid companyId UUID' } },
      position: { type: String, maxlength: 100 },
      canRefer: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
      connectedAt: { type: Date, default: Date.now },
    }],
    notificationSettings: {
      smartTiming: {
        enabled: { type: Boolean, default: true },
        timezone: { type: String, default: 'UTC' },
        preferredTimes: {
          morning: { enabled: { type: Boolean, default: true }, startTime: { type: String, default: '09:00' }, endTime: { type: String, default: '11:00' } },
          afternoon: { enabled: { type: Boolean, default: true }, startTime: { type: String, default: '13:00' }, endTime: { type: String, default: '15:00' } },
          evening: { enabled: { type: Boolean, default: false }, startTime: { type: String, default: '18:00' }, endTime: { type: String, default: '20:00' } },
        },
        weekdayPreferences: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
        smartOptimization: { type: Boolean, default: true },
        engagementPattern: {
          bestHour: Number,
          bestDay: String,
          avgResponseTime: Number,
          engagementScore: Number,
          lastAnalyzed: Date,
        },
        maxNotificationsPerHour: { type: Number, default: 3, min: 1, max: 10 },
      },
      doNotDisturb: {
        enabled: { type: Boolean, default: false },
        schedules: [{ name: String, days: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }], startTime: String, endTime: String, enabled: { type: Boolean, default: true } }],
        allowEmergencyNotifications: { type: Boolean, default: false },
        emergencyKeywords: [String],
        vipBypass: { type: Boolean, default: false },
        currentStatus: { isActive: Boolean, activeUntil: Date, reason: String },
      },
      vipCompanies: [{
        companyId: { type: String, validate: validUUIDRegex },
        companyName: String,
        alertTypes: [{ type: String, enum: ['new_jobs', 'company_news', 'hiring_events', 'salary_updates', 'culture_updates'] }],
        priority: { type: String, enum: ['high', 'medium', 'low'], default: 'high' },
        instantNotifications: { type: Boolean, default: true },
        jobRoleFilters: [String],
        locationFilters: [String],
        addedAt: { type: Date, default: Date.now },
        lastAlertSent: Date,
        alertCount: { type: Number, default: 0 },
      }],
      alertFrequency: {
        globalFrequency: { type: String, enum: ['instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled'], default: 'daily' },
        categoryFrequencies: {
          newJobs: { type: String, enum: ['instant', 'hourly', 'daily', 'weekly', 'disabled'], default: 'daily' },
          jobRecommendations: { type: String, enum: ['daily', 'weekly', 'monthly', 'disabled'], default: 'weekly' },
          applicationUpdates: { type: String, enum: ['instant', 'daily', 'weekly', 'disabled'], default: 'instant' },
          companyUpdates: { type: String, enum: ['daily', 'weekly', 'monthly', 'disabled'], default: 'weekly' },
          networkActivity: { type: String, enum: ['daily', 'weekly', 'disabled'], default: 'weekly' },
          marketInsights: { type: String, enum: ['weekly', 'monthly', 'disabled'], default: 'monthly' },
          learningOpportunities: { type: String, enum: ['weekly', 'monthly', 'disabled'], default: 'monthly' },
        },
        quietHours: {
          enabled: { type: Boolean, default: true },
          startTime: { type: String, default: '22:00' },
          endTime: { type: String, default: '08:00' },
        },
        weekendDelivery: { type: Boolean, default: false },
        maxAlertsPerDay: { type: Number, default: 10, min: 1, max: 50 },
      },
      deadlineReminders: [{
        reminderId: { type: String, default: uuidv4, validate: validUUIDRegex },
        jobId: { type: String, validate: validUUIDRegex },
        jobTitle: String,
        companyName: String,
        applicationDeadline: Date,
        reminderSettings: {
          firstReminder: { type: Number, enum: [1, 2, 3, 7, 14], default: 7 },
          secondReminder: { type: Number, enum: [1, 2, 3], default: 2 },
          finalReminder: { type: Number, enum: [1, 6, 12, 24], default: 24 },
          customMessage: String,
        },
        priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        notificationChannels: [{ type: String, enum: ['push', 'email', 'sms'] }],
        status: { type: String, enum: ['active', 'completed', 'expired', 'cancelled'], default: 'active' },
        remindersSent: [{ sentAt: Date, type: String, channel: String, success: Boolean }],
        createdAt: { type: Date, default: Date.now },
      }],
    },
    privacySecurity: {
      profileVisibility: {
        profileVisibility: { type: String, enum: ['public', 'private', 'network_only', 'recruiters_only'], default: 'public' },
        searchableByRecruiters: { type: Boolean, default: true },
        showInCompanySearch: { type: Boolean, default: true },
        allowDirectMessages: { type: Boolean, default: true },
        showActivityStatus: { type: Boolean, default: false },
        hideFromCurrentEmployer: { type: Boolean, default: false },
        currentEmployerDomains: [String],
        blockedCompanies: [String],
        visibleFields: {
          email: { type: Boolean, default: false },
          phone: { type: Boolean, default: false },
          currentSalary: { type: Boolean, default: false },
          workHistory: { type: Boolean, default: true },
          education: { type: Boolean, default: true },
          skills: { type: Boolean, default: true },
          certifications: { type: Boolean, default: true },
          portfolio: { type: Boolean, default: true },
        },
        lastUpdated: Date,
      },
      anonymousBrowsing: {
        enabled: { type: Boolean, default: false },
        currentSession: {
          sessionId: { type: String, validate: validUUIDRegex },
          startTime: Date,
          expiresAt: { type: Date, default: () => new Date(Date.now() + TTL_CONFIG.ANONYMOUS_SESSION * 1000) },
          isActive: Boolean,
        },
        sessionDuration: { type: Number, default: 60, min: 15, max: 480 },
        trackingPreferences: {
          saveSearchHistory: { type: Boolean, default: false },
          saveViewHistory: { type: Boolean, default: false },
          allowAnalytics: { type: Boolean, default: false },
        },
        autoExpire: { type: Boolean, default: true },
        sessionsHistory: [{
          sessionId: { type: String, validate: validUUIDRegex },
          startTime: Date,
          endTime: Date,
          duration: Number,
          activitiesCount: Number,
        }],
      },
      emailPreferences: {
        emailAddress: String,
        globalEmailEnabled: { type: Boolean, default: true },
        subscriptions: {
          jobAlerts: { type: Boolean, default: true },
          applicationUpdates: { type: Boolean, default: true },
          companyNews: { type: Boolean, default: true },
          weeklyDigest: { type: Boolean, default: true },
          monthlyReport: { type: Boolean, default: true },
          marketingEmails: { type: Boolean, default: false },
          partnerOffers: { type: Boolean, default: false },
          surveyInvitations: { type: Boolean, default: false },
          productUpdates: { type: Boolean, default: true },
          securityAlerts: { type: Boolean, default: true },
        },
        emailFormat: { type: String, enum: ['html', 'text', 'both'], default: 'html' },
        frequency: {
          immediate: [String],
          daily: [String],
          weekly: [String],
          monthly: [String],
        },
        unsubscribeTokens: [{ token: String, category: String, createdAt: Date, expiresAt: Date }],
        bounceHistory: [{ timestamp: Date, reason: String, type: String }],
        lastEmailSent: Date,
        emailVerified: { type: Boolean, default: false },
      },
      accountSecurity: {
        passwordLastChanged: Date,
        passwordHistory: [{ hash: String, changedAt: Date }],
        twoFactorAuth: {
          enabled: { type: Boolean, default: false },
          method: { type: String, enum: ['sms', 'email', 'authenticator'] },
          phoneNumber: String,
          secret: String,
          backupCodes: [{ code: String, used: Boolean, usedAt: Date }],
          enabledAt: Date,
          lastUsed: Date,
        },
        loginNotifications: { type: Boolean, default: true },
        sessionTimeout: { type: Number, default: 480, min: 15, max: 1440 },
        allowMultipleSessions: { type: Boolean, default: true },
        ipWhitelist: [String],
        deviceTrust: { type: Boolean, default: true },
        trustedDevices: [{
          deviceId: { type: String, validate: validUUIDRegex },
          deviceName: String,
          platform: String,
          browser: String,
          ipAddress: String,
          location: String,
          trustGrantedAt: Date,
          lastUsed: Date,
          isActive: Boolean,
        }],
        securityEvents: [{
          eventType: { type: String, enum: ['login', 'password_change', '2fa_enable', 'account_lock'] },
          timestamp: Date,
          ipAddress: String,
          userAgent: String,
          location: String,
          success: Boolean,
          details: mongoose.Mixed,
          expiresAt: { type: Date, default: () => new Date(Date.now() + TTL_CONFIG.SECURITY_EVENT * 1000) },
        }],
        accountLocks: [{
          reason: String,
          lockedAt: Date,
          lockDuration: Number,
          unlockAt: Date,
          isActive: Boolean,
        }],
      },
    },
    engagementScore: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    createdAtMonth: {
      type: String,
      default: () => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      },
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    collection: 'user_interactions',
    timestamps: { updatedAt: 'updatedAt' },
    versionKey: false,
    minimize: false,
    strict: true,
    collation: { locale: 'en', strength: 1 },
    shardKey: { userId: 1 },
  }
);

// Optimized Indexes for 10M+ Users
userInteractionSchema.index({ userId: 1, 'activities.createdAt': -1 });
userInteractionSchema.index({ 'activities.jobId': 1, 'activities.action': 1 });
userInteractionSchema.index({ 'activities.companyId': 1, 'activities.action': 1 });
userInteractionSchema.index({ createdAtMonth: 1, 'activities.action': 1 });
userInteractionSchema.index({ 'activities.location.country': 1, 'activities.action': 1 });
userInteractionSchema.index({ 'activities.platform.device': 1, 'activities.action': 1 });
userInteractionSchema.index({ 'connections.companyId': 1 });
userInteractionSchema.index({ 'notificationSettings.vipCompanies.companyId': 1 });
userInteractionSchema.index({ 'notificationSettings.deadlineReminders.applicationDeadline': 1 });
userInteractionSchema.index({ 'notificationSettings.deadlineReminders.status': 1 });
userInteractionSchema.index({ 'privacySecurity.anonymousBrowsing.currentSession.sessionId': 1 });
userInteractionSchema.index({ 'privacySecurity.accountSecurity.securityEvents.timestamp': -1 });
userInteractionSchema.index({ 'privacySecurity.accountSecurity.trustedDevices.deviceId': 1 });
userInteractionSchema.index({ 'activities.details.searchQuery': 'text', 'activities.details.jobTitle': 'text', 'activities.details.companyName': 'text' }, { name: 'interaction_text_index' });
userInteractionSchema.index({ userId: 1, isActive: 1 }, { partialFilterExpression: { isActive: true } });
userInteractionSchema.index({ 'activities.entityType': 1, 'activities.action': 1 });
userInteractionSchema.index({ 'activities.details.reviewId': 1, 'activities.action': 1 }, { sparse: true });
userInteractionSchema.index({ 'activities.details.invitationId': 1, 'activities.action': 1 }, { sparse: true });
userInteractionSchema.index({ 'activities.details.scheduleId': 1, 'activities.action': 1 }, { sparse: true });
userInteractionSchema.index({ 'activities.expiresAt': 1 }, { expireAfterSeconds: 0 });
userInteractionSchema.index({ 'privacySecurity.anonymousBrowsing.currentSession.expiresAt': 1 }, { expireAfterSeconds: 0 });
userInteractionSchema.index({ 'privacySecurity.accountSecurity.securityEvents.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Pre-save Middleware
userInteractionSchema.pre('save', async function (next) {
  try {
    this.updatedAt = new Date();
    if (!this.createdAtMonth) {
      const date = new Date();
      this.createdAtMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!this.userId) {
      this.isAnonymous = true;
    }
    for (const activity of this.activities) {
      if (activity.action === 'search' && !activity.details?.searchQuery) {
        return next(new Error('Search action requires searchQuery in details'));
      }
      if (!activity.createdAt) activity.createdAt = new Date();
    }
    if (this.isNew || this.isModified()) {
      await SearchEventService.emit('analytics:interaction_updated', {
        userId: this.userId,
        actions: this.activities.map(a => a.action),
        connectionIds: this.connections.map(c => c.connectionId),
        notificationSettings: {
          vipCompanyIds: this.notificationSettings.vipCompanies.map(v => v.companyId),
          deadlineReminderIds: this.notificationSettings.deadlineReminders.map(r => r.reminderId),
        },
        privacySecurity: {
          profileVisibility: this.privacySecurity.profileVisibility.profileVisibility,
          anonymousBrowsingEnabled: this.privacySecurity.anonymousBrowsing.enabled,
          securityEventTypes: this.privacySecurity.accountSecurity.securityEvents.map(e => e.eventType),
        },
      });
    }
    next();
  } catch (error) {
    logger.error('UserInteraction pre-save error:', error);
    next(error);
  }
});

// Static Methods
userInteractionSchema.statics.findUserRecentActivities = async function (userId, limit = 50) {
  return this.findOne({ userId, isActive: true })
    .select('activities searchBehavior jobInteractions connections notificationSettings privacySecurity engagementScore lastActiveAt')
    .slice('activities', limit)
    .lean();
};

userInteractionSchema.statics.getUserActionCount = async function (userId, action, days = 30) {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { userId, isActive: true } },
    { $unwind: '$activities' },
    { $match: { 'activities.action': action, 'activities.createdAt': { $gte: fromDate } } },
    { $count: 'count' },
  ]).then(result => result[0]?.count || 0);
};

userInteractionSchema.statics.getPopularJobs = async function (days = 7, limit = 20) {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$activities' },
    { $match: {
      'activities.action': { $in: ['view_job', 'apply_job', 'save_job'] },
      'activities.jobId': { $exists: true, $ne: null },
      'activities.createdAt': { $gte: fromDate },
    } },
    {
      $group: {
        _id: '$activities.jobId',
        viewCount: { $sum: { $cond: [{ $eq: ['$activities.action', 'view_job'] }, 1, 0] } },
        applyCount: { $sum: { $cond: [{ $eq: ['$activities.action', 'apply_job'] }, 1, 0] } },
        saveCount: { $sum: { $cond: [{ $eq: ['$activities.action', 'save_job'] }, 1, 0] } },
        totalInteractions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        lastActivity: { $max: '$activities.createdAt' },
      },
    },
    { $sort: { totalInteractions: -1 } },
    { $limit: limit },
  ]);
};

userInteractionSchema.statics.checkActivityExists = async function (userId, action, entityType) {
  return this.exists({ userId, 'activities.action': action, 'activities.entityType': entityType, isActive: true });
};

userInteractionSchema.statics.getNetworkCompanies = async function (userId) {
  const doc = await this.findOne({ userId, isActive: true }).select('connections').lean();
  return doc ? doc.connections.filter(c => c.isActive && c.companyId).map(c => c.companyId) : [];
};

userInteractionSchema.statics.getNotificationSettings = async function (userId) {
  return this.findOne({ userId, isActive: true }).select('notificationSettings').lean();
};

userInteractionSchema.statics.getActiveDeadlineReminders = async function (userId, limit = 20) {
  return this.findOne({ userId, isActive: true })
    .select('notificationSettings.deadlineReminders')
    .slice('notificationSettings.deadlineReminders', limit)
    .where('notificationSettings.deadlineReminders.status').equals('active')
    .lean();
};

userInteractionSchema.statics.getPrivacySecuritySettings = async function (userId) {
  return this.findOne({ userId, isActive: true }).select('privacySecurity').lean();
};

userInteractionSchema.statics.getSecurityEvents = async function (userId, limit = 20) {
  return this.findOne({ userId, isActive: true })
    .select('privacySecurity.accountSecurity.securityEvents')
    .slice('privacySecurity.accountSecurity.securityEvents', limit)
    .sort({ 'privacySecurity.accountSecurity.securityEvents.timestamp': -1 })
    .lean();
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

const UserInteractionModel = mongoose.model('UserInteraction', userInteractionSchema);

export { CacheManager };
export default UserInteractionModel;