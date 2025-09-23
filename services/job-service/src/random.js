okay abm new features or unke saath tumhe uska cide dungi tumhe to pta h mujh kesa chahiye h or hnn  mujhe saari files alag chahiye h controllers in fatty function, services in class, routers with ratelimit , middlewares, constants, etc and also  mujhe ab model nii chahiye h to jo bi model dungi use mere existing model m add on krwa doo or agr possible nii h tb hi dena bss and also code dekhna koi kami to nii saath m use optimize , enhance, scaalable for 10+m usrs ke liye banana h 
features
Essential Notifications & Settings (101-110)
Smart Notification Timing - Best time delivery
Do Not Disturb Mode - Pause notifications
VIP Company Alerts - Priority companies
Application Deadline Reminders - Don't miss out
Profile Visibility Controls - Privacy settings
Anonymous Browsing - Private job search
Job Alert Frequency - Daily/Weekly/Instant
Email Preferences - Communication settings
Data Export - GDPR compliance
Account Security - 2FA, password management
code ====
// =============================================================================
// ESSENTIAL NOTIFICATIONS & SETTINGS SYSTEM (101-110)
// Scalable for 10M+ users with Docker, Kafka, Redis
// =============================================================================

// =============================================================================
// 1. HTTP CONSTANTS
// =============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// =============================================================================
// 2. SUCCESS MESSAGES
// =============================================================================

export const SUCCESS_MESSAGES = {
  // Smart Notification Timing
  TIMING_PREFERENCES_UPDATED: 'Smart notification timing preferences updated successfully',
  OPTIMAL_TIME_CALCULATED: 'Optimal notification time calculated successfully',
  TIMING_ANALYSIS_RETRIEVED: 'Notification timing analysis retrieved successfully',
  
  // Do Not Disturb Mode
  DND_MODE_ENABLED: 'Do Not Disturb mode enabled successfully',
  DND_MODE_DISABLED: 'Do Not Disturb mode disabled successfully',
  DND_SCHEDULE_UPDATED: 'Do Not Disturb schedule updated successfully',
  DND_STATUS_RETRIEVED: 'Do Not Disturb status retrieved successfully',
  
  // VIP Company Alerts
  VIP_COMPANY_ADDED: 'VIP company added successfully',
  VIP_COMPANY_REMOVED: 'VIP company removed successfully',
  VIP_COMPANIES_RETRIEVED: 'VIP companies retrieved successfully',
  VIP_ALERT_SENT: 'VIP company alert sent successfully',
  
  // Application Deadline Reminders
  DEADLINE_REMINDER_CREATED: 'Application deadline reminder created successfully',
  DEADLINE_REMINDER_UPDATED: 'Deadline reminder updated successfully',
  DEADLINE_REMINDERS_RETRIEVED: 'Deadline reminders retrieved successfully',
  REMINDER_SENT: 'Deadline reminder sent successfully',
  
  // Profile Visibility Controls
  VISIBILITY_SETTINGS_UPDATED: 'Profile visibility settings updated successfully',
  PRIVACY_SETTINGS_RETRIEVED: 'Privacy settings retrieved successfully',
  RECRUITER_VISIBILITY_UPDATED: 'Recruiter visibility updated successfully',
  
  // Anonymous Browsing
  ANONYMOUS_MODE_ENABLED: 'Anonymous browsing enabled successfully',
  ANONYMOUS_MODE_DISABLED: 'Anonymous browsing disabled successfully',
  ANONYMOUS_SESSION_CREATED: 'Anonymous browsing session created successfully',
  
  // Job Alert Frequency
  ALERT_FREQUENCY_UPDATED: 'Job alert frequency updated successfully',
  ALERT_SCHEDULE_RETRIEVED: 'Alert schedule retrieved successfully',
  FREQUENCY_PREFERENCES_SAVED: 'Frequency preferences saved successfully',
  
  // Email Preferences
  EMAIL_PREFERENCES_UPDATED: 'Email preferences updated successfully',
  EMAIL_SETTINGS_RETRIEVED: 'Email settings retrieved successfully',
  UNSUBSCRIBE_SUCCESSFUL: 'Unsubscribed successfully',
  SUBSCRIPTION_UPDATED: 'Email subscription updated successfully',
  
  // Data Export
  EXPORT_REQUEST_SUBMITTED: 'Data export request submitted successfully',
  EXPORT_COMPLETED: 'Data export completed successfully',
  EXPORT_DOWNLOADED: 'Export file downloaded successfully',
  EXPORT_STATUS_RETRIEVED: 'Export status retrieved successfully',
  
  // Account Security
  TWO_FA_ENABLED: 'Two-factor authentication enabled successfully',
  TWO_FA_DISABLED: 'Two-factor authentication disabled successfully',
  PASSWORD_UPDATED: 'Password updated successfully',
  SECURITY_SETTINGS_UPDATED: 'Security settings updated successfully',
  LOGIN_ACTIVITY_RETRIEVED: 'Login activity retrieved successfully',
  SECURITY_AUDIT_COMPLETED: 'Security audit completed successfully'
};

// =============================================================================
// 3. ERROR MESSAGES
// =============================================================================

export const ERROR_MESSAGES = {
  // General
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHORIZED_ACCESS: 'Unauthorized access',
  RESOURCE_NOT_FOUND: 'Resource not found',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  
  // Smart Notification Timing
  INVALID_TIMEZONE: 'Invalid timezone provided',
  INVALID_TIME_RANGE: 'Invalid time range specified',
  TIMING_ANALYSIS_FAILED: 'Notification timing analysis failed',
  INSUFFICIENT_DATA: 'Insufficient data for timing optimization',
  
  // Do Not Disturb Mode
  INVALID_DND_SCHEDULE: 'Invalid Do Not Disturb schedule',
  DND_CONFLICT: 'Do Not Disturb schedule conflict detected',
  INVALID_TIME_FORMAT: 'Invalid time format provided',
  
  // VIP Company Alerts
  COMPANY_NOT_FOUND: 'Company not found',
  VIP_COMPANY_EXISTS: 'Company already in VIP list',
  VIP_LIST_LIMIT_EXCEEDED: 'VIP company list limit exceeded (max 50)',
  INVALID_COMPANY_ID: 'Invalid company ID provided',
  
  // Application Deadline Reminders
  INVALID_DEADLINE_DATE: 'Invalid deadline date provided',
  DEADLINE_IN_PAST: 'Cannot set reminder for past deadline',
  REMINDER_LIMIT_EXCEEDED: 'Maximum reminder limit exceeded',
  DEADLINE_NOT_FOUND: 'Deadline reminder not found',
  
  // Profile Visibility Controls
  INVALID_VISIBILITY_SETTING: 'Invalid visibility setting',
  PROFILE_ACCESS_DENIED: 'Profile access denied',
  VISIBILITY_CONFLICT: 'Visibility setting conflict',
  
  // Anonymous Browsing
  ANONYMOUS_SESSION_EXPIRED: 'Anonymous session expired',
  ANONYMOUS_MODE_UNAVAILABLE: 'Anonymous browsing unavailable',
  SESSION_CONFLICT: 'Cannot enable anonymous mode during active session',
  
  // Job Alert Frequency
  INVALID_FREQUENCY_SETTING: 'Invalid frequency setting',
  ALERT_SCHEDULE_CONFLICT: 'Alert schedule conflict detected',
  FREQUENCY_LIMIT_EXCEEDED: 'Too many frequency changes in short period',
  
  // Email Preferences
  INVALID_EMAIL_PREFERENCE: 'Invalid email preference setting',
  EMAIL_REQUIRED: 'Email address is required',
  UNSUBSCRIBE_FAILED: 'Unsubscribe operation failed',
  EMAIL_VERIFICATION_REQUIRED: 'Email verification required',
  
  // Data Export
  EXPORT_REQUEST_EXISTS: 'Export request already in progress',
  EXPORT_FAILED: 'Data export failed',
  EXPORT_FILE_NOT_FOUND: 'Export file not found or expired',
  EXPORT_SIZE_LIMIT_EXCEEDED: 'Export data size limit exceeded',
  INVALID_EXPORT_FORMAT: 'Invalid export format specified',
  
  // Account Security
  INVALID_CURRENT_PASSWORD: 'Invalid current password',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  TWO_FA_ALREADY_ENABLED: 'Two-factor authentication already enabled',
  TWO_FA_NOT_ENABLED: 'Two-factor authentication not enabled',
  INVALID_2FA_TOKEN: 'Invalid two-factor authentication token',
  SECURITY_VERIFICATION_FAILED: 'Security verification failed',
  ACCOUNT_LOCKED: 'Account temporarily locked due to security reasons'
};

// =============================================================================
// 4. CACHE KEYS
// =============================================================================

export const CACHE_KEYS = {
  // Smart Notification Timing
  NOTIFICATION_TIMING: (userId) => `notification_timing:${userId}`,
  OPTIMAL_TIME: (userId) => `optimal_time:${userId}`,
  TIMING_ANALYSIS: (userId) => `timing_analysis:${userId}`,
  USER_ENGAGEMENT_PATTERN: (userId) => `engagement_pattern:${userId}`,
  
  // Do Not Disturb Mode
  DND_STATUS: (userId) => `dnd_status:${userId}`,
  DND_SCHEDULE: (userId) => `dnd_schedule:${userId}`,
  ACTIVE_DND_USERS: 'active_dnd_users',
  
  // VIP Company Alerts
  VIP_COMPANIES: (userId) => `vip_companies:${userId}`,
  VIP_ALERTS: (userId) => `vip_alerts:${userId}`,
  COMPANY_INFO: (companyId) => `company_info:${companyId}`,
  
  // Application Deadline Reminders
  DEADLINE_REMINDERS: (userId) => `deadline_reminders:${userId}`,
  UPCOMING_DEADLINES: (userId) => `upcoming_deadlines:${userId}`,
  REMINDER_SCHEDULE: (userId) => `reminder_schedule:${userId}`,
  
  // Profile Visibility Controls
  VISIBILITY_SETTINGS: (userId) => `visibility_settings:${userId}`,
  PROFILE_PRIVACY: (userId) => `profile_privacy:${userId}`,
  RECRUITER_VISIBILITY: (userId) => `recruiter_visibility:${userId}`,
  
  // Anonymous Browsing
  ANONYMOUS_SESSION: (sessionId) => `anonymous_session:${sessionId}`,
  ANONYMOUS_USER_MAP: (userId) => `anonymous_map:${userId}`,
  ANONYMOUS_ACTIVITY: (sessionId) => `anonymous_activity:${sessionId}`,
  
  // Job Alert Frequency
  ALERT_FREQUENCY: (userId) => `alert_frequency:${userId}`,
  ALERT_SCHEDULE: (userId) => `alert_schedule:${userId}`,
  FREQUENCY_HISTORY: (userId) => `frequency_history:${userId}`,
  
  // Email Preferences
  EMAIL_PREFERENCES: (userId) => `email_preferences:${userId}`,
  EMAIL_SUBSCRIPTIONS: (userId) => `email_subscriptions:${userId}`,
  UNSUBSCRIBE_TOKENS: (token) => `unsubscribe_token:${token}`,
  
  // Data Export
  EXPORT_REQUEST: (userId) => `export_request:${userId}`,
  EXPORT_STATUS: (exportId) => `export_status:${exportId}`,
  EXPORT_QUEUE: 'export_queue',
  
  // Account Security
  SECURITY_SETTINGS: (userId) => `security_settings:${userId}`,
  TWO_FA_SETTINGS: (userId) => `two_fa_settings:${userId}`,
  LOGIN_ATTEMPTS: (userId) => `login_attempts:${userId}`,
  SECURITY_TOKENS: (token) => `security_token:${token}`,
  ACCOUNT_LOCKS: (userId) => `account_lock:${userId}`
};

// =============================================================================
// 5. CACHE TTL (Time To Live in seconds)
// =============================================================================

export const CACHE_TTL = {
  // Smart Notification Timing
  NOTIFICATION_TIMING: 7200, // 2 hours
  OPTIMAL_TIME: 86400, // 24 hours
  TIMING_ANALYSIS: 21600, // 6 hours
  USER_ENGAGEMENT_PATTERN: 43200, // 12 hours
  
  // Do Not Disturb Mode
  DND_STATUS: 3600, // 1 hour
  DND_SCHEDULE: 86400, // 24 hours
  ACTIVE_DND_USERS: 300, // 5 minutes
  
  // VIP Company Alerts
  VIP_COMPANIES: 3600, // 1 hour
  VIP_ALERTS: 1800, // 30 minutes
  COMPANY_INFO: 21600, // 6 hours
  
  // Application Deadline Reminders
  DEADLINE_REMINDERS: 3600, // 1 hour
  UPCOMING_DEADLINES: 1800, // 30 minutes
  REMINDER_SCHEDULE: 7200, // 2 hours
  
  // Profile Visibility Controls
  VISIBILITY_SETTINGS: 7200, // 2 hours
  PROFILE_PRIVACY: 10800, // 3 hours
  RECRUITER_VISIBILITY: 3600, // 1 hour
  
  // Anonymous Browsing
  ANONYMOUS_SESSION: 1800, // 30 minutes
  ANONYMOUS_USER_MAP: 3600, // 1 hour
  ANONYMOUS_ACTIVITY: 1800, // 30 minutes
  
  // Job Alert Frequency
  ALERT_FREQUENCY: 7200, // 2 hours
  ALERT_SCHEDULE: 86400, // 24 hours
  FREQUENCY_HISTORY: 604800, // 1 week
  
  // Email Preferences
  EMAIL_PREFERENCES: 7200, // 2 hours
  EMAIL_SUBSCRIPTIONS: 14400, // 4 hours
  UNSUBSCRIBE_TOKENS: 86400, // 24 hours
  
  // Data Export
  EXPORT_REQUEST: 3600, // 1 hour
  EXPORT_STATUS: 1800, // 30 minutes
  EXPORT_QUEUE: 300, // 5 minutes
  
  // Account Security
  SECURITY_SETTINGS: 7200, // 2 hours
  TWO_FA_SETTINGS: 14400, // 4 hours
  LOGIN_ATTEMPTS: 900, // 15 minutes
  SECURITY_TOKENS: 600, // 10 minutes
  ACCOUNT_LOCKS: 1800 // 30 minutes
};

// =============================================================================
// 6. VALIDATION SCHEMAS
// =============================================================================

import Joi from 'joi';

export const VALIDATION_SCHEMAS = {
  // Smart Notification Timing
  notificationTiming: Joi.object({
    userId: Joi.string().uuid().required(),
    timezone: Joi.string().required(),
    preferredTimes: Joi.object({
      morning: Joi.object({
        enabled: Joi.boolean().default(true),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      }),
      afternoon: Joi.object({
        enabled: Joi.boolean().default(true),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      }),
      evening: Joi.object({
        enabled: Joi.boolean().default(true),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      })
    }).required(),
    weekdayPreferences: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).required(),
    smartOptimization: Joi.boolean().default(true),
    maxNotificationsPerHour: Joi.number().min(1).max(10).default(3),
    respectLocalHolidays: Joi.boolean().default(true)
  }),

  // Do Not Disturb Mode
  dndSettings: Joi.object({
    userId: Joi.string().uuid().required(),
    enabled: Joi.boolean().required(),
    schedules: Joi.array().items(
      Joi.object({
        name: Joi.string().max(50),
        days: Joi.array().items(
          Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        ).min(1).required(),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        enabled: Joi.boolean().default(true)
      })
    ).max(5),
    allowEmergencyNotifications: Joi.boolean().default(false),
    emergencyKeywords: Joi.array().items(Joi.string().max(50)).max(10),
    vipBypass: Joi.boolean().default(false)
  }),

  // VIP Company Alerts
  vipCompany: Joi.object({
    userId: Joi.string().uuid().required(),
    companyId: Joi.string().required(),
    companyName: Joi.string().max(200).required(),
    alertTypes: Joi.array().items(
      Joi.string().valid('new_jobs', 'company_news', 'hiring_events', 'salary_updates', 'culture_updates')
    ).min(1).required(),
    priority: Joi.string().valid('high', 'medium', 'low').default('high'),
    instantNotifications: Joi.boolean().default(true),
    jobRoleFilters: Joi.array().items(Joi.string().max(100)).max(20),
    locationFilters: Joi.array().items(Joi.string().max(100)).max(10)
  }),

  // Application Deadline Reminders
  deadlineReminder: Joi.object({
    userId: Joi.string().uuid().required(),
    jobId: Joi.string().required(),
    jobTitle: Joi.string().max(200).required(),
    companyName: Joi.string().max(200).required(),
    applicationDeadline: Joi.date().greater('now').required(),
    reminderSettings: Joi.object({
      firstReminder: Joi.number().valid(1, 2, 3, 7, 14).default(7), // days before deadline
      secondReminder: Joi.number().valid(1, 2, 3).default(2), // days before deadline
      finalReminder: Joi.number().valid(1, 6, 12, 24).default(24), // hours before deadline
      customMessage: Joi.string().max(500)
    }),
    priority: Joi.string().valid('high', 'medium', 'low').default('medium'),
    notificationChannels: Joi.array().items(
      Joi.string().valid('push', 'email', 'sms')
    ).min(1).required()
  }),

  // Profile Visibility Controls
  visibilitySettings: Joi.object({
    userId: Joi.string().uuid().required(),
    profileVisibility: Joi.string().valid('public', 'private', 'network_only', 'recruiters_only').default('public'),
    searchableByRecruiters: Joi.boolean().default(true),
    showInCompanySearch: Joi.boolean().default(true),
    allowDirectMessages: Joi.boolean().default(true),
    showActivityStatus: Joi.boolean().default(false),
    hideFromCurrentEmployer: Joi.boolean().default(false),
    currentEmployerDomains: Joi.array().items(Joi.string().domain()).max(10),
    blockedCompanies: Joi.array().items(Joi.string()).max(50),
    visibleFields: Joi.object({
      email: Joi.boolean().default(false),
      phone: Joi.boolean().default(false),
      currentSalary: Joi.boolean().default(false),
      workHistory: Joi.boolean().default(true),
      education: Joi.boolean().default(true),
      skills: Joi.boolean().default(true),
      certifications: Joi.boolean().default(true),
      portfolio: Joi.boolean().default(true)
    })
  }),

  // Anonymous Browsing
  anonymousSession: Joi.object({
    userId: Joi.string().uuid().required(),
    enabled: Joi.boolean().required(),
    sessionDuration: Joi.number().min(15).max(480).default(60), // minutes
    trackingPreferences: Joi.object({
      saveSearchHistory: Joi.boolean().default(false),
      saveViewHistory: Joi.boolean().default(false),
      allowAnalytics: Joi.boolean().default(false)
    }),
    autoExpire: Joi.boolean().default(true)
  }),

  // Job Alert Frequency
  alertFrequency: Joi.object({
    userId: Joi.string().uuid().required(),
    globalFrequency: Joi.string().valid('instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled').default('daily'),
    categoryFrequencies: Joi.object({
      newJobs: Joi.string().valid('instant', 'hourly', 'daily', 'weekly', 'disabled').default('daily'),
      jobRecommendations: Joi.string().valid('daily', 'weekly', 'monthly', 'disabled').default('weekly'),
      applicationUpdates: Joi.string().valid('instant', 'daily', 'weekly', 'disabled').default('instant'),
      companyUpdates: Joi.string().valid('daily', 'weekly', 'monthly', 'disabled').default('weekly'),
      networkActivity: Joi.string().valid('daily', 'weekly', 'disabled').default('weekly'),
      marketInsights: Joi.string().valid('weekly', 'monthly', 'disabled').default('monthly'),
      learningOpportunities: Joi.string().valid('weekly', 'monthly', 'disabled').default('monthly')
    }),
    quietHours: Joi.object({
      enabled: Joi.boolean().default(true),
      startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('22:00'),
      endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('08:00')
    }),
    weekendDelivery: Joi.boolean().default(false),
    maxAlertsPerDay: Joi.number().min(1).max(50).default(10)
  }),

  // Email Preferences
  emailPreferences: Joi.object({
    userId: Joi.string().uuid().required(),
    emailAddress: Joi.string().email().required(),
    globalEmailEnabled: Joi.boolean().default(true),
    subscriptions: Joi.object({
      jobAlerts: Joi.boolean().default(true),
      applicationUpdates: Joi.boolean().default(true),
      companyNews: Joi.boolean().default(true),
      weeklyDigest: Joi.boolean().default(true),
      monthlyReport: Joi.boolean().default(true),
      marketingEmails: Joi.boolean().default(false),
      partnerOffers: Joi.boolean().default(false),
      surveyInvitations: Joi.boolean().default(false),
      productUpdates: Joi.boolean().default(true),
      securityAlerts: Joi.boolean().default(true)
    }),
    emailFormat: Joi.string().valid('html', 'text', 'both').default('html'),
    frequency: Joi.object({
      immediate: Joi.array().items(Joi.string()),
      daily: Joi.array().items(Joi.string()),
      weekly: Joi.array().items(Joi.string()),
      monthly: Joi.array().items(Joi.string())
    }),
    unsubscribeAll: Joi.boolean().default(false)
  }),

  // Data Export
  dataExport: Joi.object({
    userId: Joi.string().uuid().required(),
    exportType: Joi.string().valid('full', 'profile', 'applications', 'search_history', 'preferences', 'analytics').default('full'),
    format: Joi.string().valid('json', 'csv', 'xml', 'pdf').default('json'),
    dateRange: Joi.object({
      startDate: Joi.date(),
      endDate: Joi.date().greater(Joi.ref('startDate'))
    }),
    includeDeleted: Joi.boolean().default(false),
    anonymize: Joi.boolean().default(false),
    compressionEnabled: Joi.boolean().default(true),
    deliveryMethod: Joi.string().valid('download', 'email', 'secure_link').default('download')
  }),

  // Account Security
  securitySettings: Joi.object({
    userId: Joi.string().uuid().required(),
    currentPassword: Joi.string().when('newPassword', {
      is: Joi.exist(),
      then: Joi.required()
    }),
    newPassword: Joi.string().min(8).max(128).pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    ),
    twoFactorAuth: Joi.object({
      enabled: Joi.boolean().required(),
      method: Joi.string().valid('sms', 'email', 'authenticator').when('enabled', {
        is: true,
        then: Joi.required()
      }),
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).when('method', {
        is: 'sms',
        then: Joi.required()
      }),
      backupCodes: Joi.array().items(Joi.string()).length(10)
    }),
    loginNotifications: Joi.boolean().default(true),
    sessionTimeout: Joi.number().min(15).max(1440).default(480), // minutes
    allowMultipleSessions: Joi.boolean().default(true),
    ipWhitelist: Joi.array().items(Joi.string().ip()).max(10),
    deviceTrust: Joi.boolean().default(true)
  }),

  // Security Token Verification
  tokenVerification: Joi.object({
    token: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    userId: Joi.string().uuid().required(),
    action: Joi.string().valid('enable_2fa', 'disable_2fa', 'password_reset', 'email_change').required()
  })
};

// =============================================================================
// 7. OPTIMIZED MODELS (Minimized to 3 core models)
// =============================================================================
// notificationSettings.js userInteraction, privacySecurity.js in userInteraction, dataManagement.js in professionaldevmodel
// =============================================================================
// 8. NOTIFICATIONS & SETTINGS SERVICE
// =============================================================================

import { redisClient } from '../config/redis.js';
import { publishJobEvent, consumer } from '../config/kafka.js';
import logger from '../utils/logger.js';
import { sanitizeInput } from '../utils/security.js';
import retry from 'async-retry';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

class NotificationsSettingsService {
  constructor() {
    this.NotificationSettings = NotificationSettings;
    this.PrivacySecurity = PrivacySecurity;
    this.DataManagement = DataManagement;
  }

  async initialize() {
    await this.setupKafkaConsumer();
    await this.setupNotificationScheduler();
    logger.info('Notifications & Settings Service initialized');
  }

  async setupKafkaConsumer() {
    try {
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const event = JSON.parse(message.value.toString());
            await this.processEvent(event);
          } catch (error) {
            logger.error(`Kafka consumer error: ${error.message}`, { topic, partition });
          }
        }
      });
    } catch (error) {
      logger.error(`Kafka setup failed: ${error.message}`);
      throw error;
    }
  }

  async setupNotificationScheduler() {
    // Setup background job to process notification scheduling
    setInterval(async () => {
      await this.processScheduledNotifications();
    }, 60000); // Check every minute
  }

  async processEvent(event) {
    const { type, payload } = event;
    
    switch (type) {
      case 'deadline_reminder':
        await this.processDeadlineReminder(payload);
        break;
      case 'vip_company_alert':
        await this.processVIPCompanyAlert(payload);
        break;
      case 'notification_optimization':
        await this.processNotificationOptimization(payload);
        break;
      case 'data_export_request':
        await this.processDataExport(payload);
        break;
      case 'security_event':
        await this.processSecurityEvent(payload);
        break;
      default:
        logger.warn(`Unknown event type: ${type}`);
    }
  }

  // =============================================================================
  // SMART NOTIFICATION TIMING (101)
  // =============================================================================

  async updateNotificationTiming(data) {
    const { error, value } = VALIDATION_SCHEMAS.notificationTiming.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);
    
    return await retry(async () => {
      const timingSettings = {
        enabled: true,
        timezone: sanitizedData.timezone,
        preferredTimes: sanitizedData.preferredTimes,
        weekdayPreferences: sanitizedData.weekdayPreferences,
        smartOptimization: sanitizedData.smartOptimization,
        maxNotificationsPerHour: sanitizedData.maxNotificationsPerHour
      };

      await this.NotificationSettings.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'smartTiming': timingSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Clear cache to force refresh
      await redisClient.del(CACHE_KEYS.NOTIFICATION_TIMING(sanitizedData.userId));

      // Queue optimization analysis if enabled
      if (sanitizedData.smartOptimization) {
        await publishJobEvent('notification_optimization', {
          userId: sanitizedData.userId,
          action: 'analyze_engagement_patterns'
        });
      }

      return {
        success: true,
        message: SUCCESS_MESSAGES.TIMING_PREFERENCES_UPDATED,
        data: timingSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getOptimalNotificationTime(userId) {
    const cacheKey = CACHE_KEYS.OPTIMAL_TIME(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.OPTIMAL_TIME_CALCULATED,
        data: JSON.parse(cached)
      };
    }

    // Calculate optimal time based on engagement patterns
    const engagementData = await this.analyzeEngagementPatterns(userId);
    const optimalTime = await this.calculateOptimalTime(userId, engagementData);

    await redisClient.setex(cacheKey, CACHE_TTL.OPTIMAL_TIME, JSON.stringify(optimalTime));

    return {
      success: true,
      message: SUCCESS_MESSAGES.OPTIMAL_TIME_CALCULATED,
      data: optimalTime
    };
  }

  async analyzeEngagementPatterns(userId) {
    const cacheKey = CACHE_KEYS.USER_ENGAGEMENT_PATTERN(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) return JSON.parse(cached);

    // This would analyze user's historical engagement data
    const engagementPattern = {
      bestHour: 14, // 2 PM
      bestDay: 'tuesday',
      avgResponseTime: 45, // minutes
      engagementScore: 75,
      hourlyEngagement: {
        '09': 0.6, '10': 0.8, '11': 0.7, '12': 0.4, '13': 0.5,
        '14': 0.9, '15': 0.8, '16': 0.6, '17': 0.3, '18': 0.2
      },
      weeklyEngagement: {
        'monday': 0.7, 'tuesday': 0.9, 'wednesday': 0.8, 'thursday': 0.8,
        'friday': 0.6, 'saturday': 0.3, 'sunday': 0.2
      }
    };

    await redisClient.setex(cacheKey, CACHE_TTL.USER_ENGAGEMENT_PATTERN, JSON.stringify(engagementPattern));
    return engagementPattern;
  }

  async calculateOptimalTime(userId, engagementData) {
    const settings = await this.getNotificationSettings(userId);
    const userTimezone = settings?.smartTiming?.timezone || 'UTC';
    
    // Find the best time slot based on engagement and preferences
    const optimalHour = engagementData.bestHour;
    const optimalDay = engagementData.bestDay;
    
    return {
      recommendedTime: `${optimalHour.toString().padStart(2, '0')}:00`,
      recommendedDay: optimalDay,
      confidence: engagementData.engagementScore,
      timezone: userTimezone,
      nextOptimalSlots: [
        { time: '14:00', day: 'tuesday', score: 0.9 },
        { time: '10:00', day: 'wednesday', score: 0.8 },
        { time: '15:00', day: 'thursday', score: 0.8 }
      ],
      reasoning: 'Based on your engagement patterns, you\'re most responsive to notifications on Tuesday afternoons'
    };
  }

  // =============================================================================
  // DO NOT DISTURB MODE (102)
  // =============================================================================

  async updateDoNotDisturbSettings(data) {
    const { error, value } = VALIDATION_SCHEMAS.dndSettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const dndSettings = {
        enabled: sanitizedData.enabled,
        schedules: sanitizedData.schedules || [],
        allowEmergencyNotifications: sanitizedData.allowEmergencyNotifications,
        emergencyKeywords: sanitizedData.emergencyKeywords || [],
        vipBypass: sanitizedData.vipBypass,
        currentStatus: {
          isActive: await this.isDNDActive(sanitizedData.userId, sanitizedData.schedules),
          activeUntil: null,
          reason: 'scheduled'
        }
      };

      await this.NotificationSettings.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'doNotDisturb': dndSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Update active DND users cache
      await this.updateActiveDNDUsers();

      // Clear user's DND cache
      await redisClient.del(CACHE_KEYS.DND_STATUS(sanitizedData.userId));

      return {
        success: true,
        message: sanitizedData.enabled ? SUCCESS_MESSAGES.DND_MODE_ENABLED : SUCCESS_MESSAGES.DND_MODE_DISABLED,
        data: dndSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async isDNDActive(userId, schedules = null) {
    if (!schedules) {
      const settings = await this.getNotificationSettings(userId);
      schedules = settings?.doNotDisturb?.schedules || [];
    }

    const now = new Date();
    const currentDay = now.toLocaleLowerCase().slice(0, 3) + 'day'; // e.g., 'monday'
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return schedules.some(schedule => {
      if (!schedule.enabled || !schedule.days.includes(currentDay)) {
        return false;
      }

      const startTime = schedule.startTime;
      const endTime = schedule.endTime;
      
      // Handle overnight schedules (e.g., 22:00 to 08:00)
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      } else {
        return currentTime >= startTime && currentTime <= endTime;
      }
    });
  }

  async updateActiveDNDUsers() {
    // This would be optimized to batch update active DND users
    // For demonstration, simplified implementation
    await redisClient.setex(CACHE_KEYS.ACTIVE_DND_USERS, CACHE_TTL.ACTIVE_DND_USERS, 
      JSON.stringify({ lastUpdated: new Date() }));
  }

  // =============================================================================
  // VIP COMPANY ALERTS (103)
  // =============================================================================

  async addVIPCompany(data) {
    const { error, value } = VALIDATION_SCHEMAS.vipCompany.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      // Check current VIP company count
      const settings = await this.getNotificationSettings(sanitizedData.userId);
      const currentVIPCount = settings?.vipCompanies?.length || 0;
      
      if (currentVIPCount >= 50) {
        throw new Error(ERROR_MESSAGES.VIP_LIST_LIMIT_EXCEEDED);
      }

      // Check if company already exists
      const existingCompany = settings?.vipCompanies?.find(
        company => company.companyId === sanitizedData.companyId
      );
      
      if (existingCompany) {
        throw new Error(ERROR_MESSAGES.VIP_COMPANY_EXISTS);
      }

      const vipCompany = {
        ...sanitizedData,
        addedAt: new Date(),
        lastAlertSent: null,
        alertCount: 0
      };

      await this.NotificationSettings.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { vipCompanies: vipCompany },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      // Clear cache
      await redisClient.del(CACHE_KEYS.VIP_COMPANIES(sanitizedData.userId));

      // Set up alerts for this company
      await publishJobEvent('vip_company_monitoring', {
        userId: sanitizedData.userId,
        companyId: sanitizedData.companyId,
        alertTypes: sanitizedData.alertTypes
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_ADDED,
        data: vipCompany
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async removeVIPCompany(userId, companyId) {
    return await retry(async () => {
      await this.NotificationSettings.findOneAndUpdate(
        { userId },
        {
          $pull: { vipCompanies: { companyId } },
          $set: { updatedAt: new Date() }
        }
      );

      // Clear cache
      await redisClient.del(CACHE_KEYS.VIP_COMPANIES(userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_REMOVED,
        data: { companyId }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getVIPCompanies(userId) {
    const cacheKey = CACHE_KEYS.VIP_COMPANIES(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANIES_RETRIEVED,
        data: JSON.parse(cached)
      };
    }

    const settings = await this.getNotificationSettings(userId);
    const vipCompanies = settings?.vipCompanies || [];

    await redisClient.setex(cacheKey, CACHE_TTL.VIP_COMPANIES, JSON.stringify(vipCompanies));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.VIP_COMPANIES_RETRIEVED,
      data: vipCompanies
    };
  }

  // =============================================================================
  // APPLICATION DEADLINE REMINDERS (104)
  // =============================================================================

  async createDeadlineReminder(data) {
    const { error, value } = VALIDATION_SCHEMAS.deadlineReminder.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    // Validate deadline is in the future
    if (new Date(sanitizedData.applicationDeadline) <= new Date()) {
      throw new Error(ERROR_MESSAGES.DEADLINE_IN_PAST);
    }

    return await retry(async () => {
      const reminder = {
        reminderId: require('uuid').v4(),
        ...sanitizedData,
        status: 'active',
        remindersSent: [],
        createdAt: new Date()
      };

      await this.NotificationSettings.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { 'deadlineReminders': reminder },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      // Schedule reminder notifications
      await this.scheduleDeadlineNotifications(reminder);

      // Clear cache
      await redisClient.del(CACHE_KEYS.DEADLINE_REMINDERS(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_CREATED,
        data: reminder
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async scheduleDeadlineNotifications(reminder) {
    const { reminderId, applicationDeadline, reminderSettings, userId, notificationChannels } = reminder;
    
    // Calculate reminder times
    const deadlineDate = new Date(applicationDeadline);
    const reminders = [
      {
        type: 'first',
        scheduledFor: new Date(deadlineDate.getTime() - reminderSettings.firstReminder * 24 * 60 * 60 * 1000)
      },
      {
        type: 'second', 
        scheduledFor: new Date(deadlineDate.getTime() - reminderSettings.secondReminder * 24 * 60 * 60 * 1000)
      },
      {
        type: 'final',
        scheduledFor: new Date(deadlineDate.getTime() - reminderSettings.finalReminder * 60 * 60 * 1000)
      }
    ];

    // Queue each reminder
    for (const reminder of reminders) {
      if (reminder.scheduledFor > new Date()) {
        await publishJobEvent('deadline_reminder', {
          reminderId,
          userId,
          type: reminder.type,
          scheduledFor: reminder.scheduledFor,
          channels: notificationChannels
        }, { delay: reminder.scheduledFor.getTime() - Date.now() });
      }
    }
  }
async getDeadlineReminders(userId) {
    const cacheKey = CACHE_KEYS.DEADLINE_REMINDERS(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDERS_RETRIEVED,
        data: JSON.parse(cached)
      };
    }

    const settings = await this.getNotificationSettings(userId);
    const reminders = settings?.deadlineReminders || [];
    
    // Filter active reminders and sort by deadline
    const activeReminders = reminders
      .filter(r => r.status === 'active' && new Date(r.applicationDeadline) > new Date())
      .sort((a, b) => new Date(a.applicationDeadline) - new Date(b.applicationDeadline));

    await redisClient.setex(cacheKey, CACHE_TTL.DEADLINE_REMINDERS, JSON.stringify(activeReminders));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.DEADLINE_REMINDERS_RETRIEVED,
      data: activeReminders
    };
  }

  // =============================================================================
  // PROFILE VISIBILITY CONTROLS (105)
  // =============================================================================

  async updateProfileVisibility(data) {
    const { error, value } = VALIDATION_SCHEMAS.visibilitySettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const visibilitySettings = {
        ...sanitizedData,
        lastUpdated: new Date()
      };

      // Remove userId from the settings object
      delete visibilitySettings.userId;

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'profileVisibility': visibilitySettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Clear visibility caches
      await redisClient.del(CACHE_KEYS.VISIBILITY_SETTINGS(sanitizedData.userId));
      await redisClient.del(CACHE_KEYS.RECRUITER_VISIBILITY(sanitizedData.userId));

      // Update search indexes if needed
      await publishJobEvent('profile_visibility_update', {
        userId: sanitizedData.userId,
        visibility: sanitizedData.profileVisibility,
        searchableByRecruiters: sanitizedData.searchableByRecruiters
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.VISIBILITY_SETTINGS_UPDATED,
        data: visibilitySettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getProfileVisibility(userId) {
    const cacheKey = CACHE_KEYS.VISIBILITY_SETTINGS(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.PRIVACY_SETTINGS_RETRIEVED,
        data: JSON.parse(cached)
      };
    }

    const settings = await this.getPrivacySecuritySettings(userId);
    const visibility = settings?.profileVisibility || this.getDefaultVisibilitySettings();

    await redisClient.setex(cacheKey, CACHE_TTL.VISIBILITY_SETTINGS, JSON.stringify(visibility));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.PRIVACY_SETTINGS_RETRIEVED,
      data: visibility
    };
  }

  getDefaultVisibilitySettings() {
    return {
      profileVisibility: 'public',
      searchableByRecruiters: true,
      showInCompanySearch: true,
      allowDirectMessages: true,
      showActivityStatus: false,
      hideFromCurrentEmployer: false,
      currentEmployerDomains: [],
      blockedCompanies: [],
      visibleFields: {
        email: false,
        phone: false,
        currentSalary: false,
        workHistory: true,
        education: true,
        skills: true,
        certifications: true,
        portfolio: true
      }
    };
  }

  // =============================================================================
  // ANONYMOUS BROWSING (106)
  // =============================================================================

  async enableAnonymousBrowsing(data) {
    const { error, value } = VALIDATION_SCHEMAS.anonymousSession.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const sessionId = require('uuid').v4();
      const expiresAt = new Date(Date.now() + sanitizedData.sessionDuration * 60 * 1000);
      
      const anonymousSession = {
        sessionId,
        startTime: new Date(),
        expiresAt,
        isActive: true
      };

      const anonymousSettings = {
        enabled: true,
        currentSession: anonymousSession,
        sessionDuration: sanitizedData.sessionDuration,
        trackingPreferences: sanitizedData.trackingPreferences,
        autoExpire: sanitizedData.autoExpire
      };

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'anonymousBrowsing': anonymousSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Cache session data
      const sessionCacheKey = CACHE_KEYS.ANONYMOUS_SESSION(sessionId);
      await redisClient.setex(sessionCacheKey, sanitizedData.sessionDuration * 60, JSON.stringify({
        userId: sanitizedData.userId,
        sessionId,
        expiresAt,
        trackingPreferences: sanitizedData.trackingPreferences
      }));

      // Map user to session
      const userMapKey = CACHE_KEYS.ANONYMOUS_USER_MAP(sanitizedData.userId);
      await redisClient.setex(userMapKey, sanitizedData.sessionDuration * 60, sessionId);

      // Schedule session expiration if auto-expire is enabled
      if (sanitizedData.autoExpire) {
        await publishJobEvent('anonymous_session_expire', {
          userId: sanitizedData.userId,
          sessionId
        }, { delay: sanitizedData.sessionDuration * 60 * 1000 });
      }

      return {
        success: true,
        message: SUCCESS_MESSAGES.ANONYMOUS_MODE_ENABLED,
        data: {
          sessionId,
          expiresAt,
          duration: sanitizedData.sessionDuration,
          trackingPreferences: sanitizedData.trackingPreferences
        }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async disableAnonymousBrowsing(userId) {
    return await retry(async () => {
      const settings = await this.getPrivacySecuritySettings(userId);
      const currentSession = settings?.anonymousBrowsing?.currentSession;

      // End current session
      if (currentSession?.isActive) {
        await this.endAnonymousSession(userId, currentSession.sessionId);
      }

      await this.PrivacySecurity.findOneAndUpdate(
        { userId },
        {
          $set: {
            'anonymousBrowsing.enabled': false,
            'anonymousBrowsing.currentSession.isActive': false,
            updatedAt: new Date()
          }
        }
      );

      // Clear caches
      await redisClient.del(CACHE_KEYS.ANONYMOUS_USER_MAP(userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.ANONYMOUS_MODE_DISABLED,
        data: { sessionEnded: !!currentSession?.isActive }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async endAnonymousSession(userId, sessionId) {
    const settings = await this.getPrivacySecuritySettings(userId);
    const currentSession = settings?.anonymousBrowsing?.currentSession;

    if (currentSession?.sessionId === sessionId) {
      const sessionDuration = Math.floor((Date.now() - new Date(currentSession.startTime).getTime()) / 60000);
      
      // Update session history
      await this.PrivacySecurity.findOneAndUpdate(
        { userId },
        {
          $push: {
            'anonymousBrowsing.sessionsHistory': {
              sessionId,
              startTime: currentSession.startTime,
              endTime: new Date(),
              duration: sessionDuration,
              activitiesCount: await this.getSessionActivityCount(sessionId)
            }
          },
          $set: {
            'anonymousBrowsing.currentSession.isActive': false,
            updatedAt: new Date()
          }
        }
      );
    }

    // Clear session cache
    await redisClient.del(CACHE_KEYS.ANONYMOUS_SESSION(sessionId));
    await redisClient.del(CACHE_KEYS.ANONYMOUS_ACTIVITY(sessionId));
  }

  async getSessionActivityCount(sessionId) {
    const activityKey = CACHE_KEYS.ANONYMOUS_ACTIVITY(sessionId);
    const activity = await redisClient.get(activityKey);
    return activity ? JSON.parse(activity).count || 0 : 0;
  }

  // =============================================================================
  // JOB ALERT FREQUENCY (107)
  // =============================================================================

  async updateAlertFrequency(data) {
    const { error, value } = VALIDATION_SCHEMAS.alertFrequency.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const alertSettings = {
        globalFrequency: sanitizedData.globalFrequency,
        categoryFrequencies: sanitizedData.categoryFrequencies,
        quietHours: sanitizedData.quietHours,
        weekendDelivery: sanitizedData.weekendDelivery,
        maxAlertsPerDay: sanitizedData.maxAlertsPerDay
      };

      await this.NotificationSettings.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'alertFrequency': alertSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Clear frequency cache
      await redisClient.del(CACHE_KEYS.ALERT_FREQUENCY(sanitizedData.userId));

      // Update alert scheduler
      await publishJobEvent('alert_frequency_update', {
        userId: sanitizedData.userId,
        settings: alertSettings
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.ALERT_FREQUENCY_UPDATED,
        data: alertSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  // =============================================================================
  // EMAIL PREFERENCES (108)
  // =============================================================================

  async updateEmailPreferences(data) {
    const { error, value } = VALIDATION_SCHEMAS.emailPreferences.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const emailSettings = {
        emailAddress: sanitizedData.emailAddress,
        globalEmailEnabled: sanitizedData.globalEmailEnabled,
        subscriptions: sanitizedData.subscriptions,
        emailFormat: sanitizedData.emailFormat,
        frequency: sanitizedData.frequency,
        emailVerified: false // Will be verified separately
      };

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'emailPreferences': emailSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Generate unsubscribe tokens for each subscription
      await this.generateUnsubscribeTokens(sanitizedData.userId, sanitizedData.subscriptions);

      // Clear email cache
      await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.EMAIL_PREFERENCES_UPDATED,
        data: emailSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async generateUnsubscribeTokens(userId, subscriptions) {
    const tokens = [];
    
    for (const [category, enabled] of Object.entries(subscriptions)) {
      if (enabled) {
        const token = crypto.randomBytes(32).toString('hex');
        tokens.push({
          token,
          category,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });
        
        // Cache token
        await redisClient.setex(
          CACHE_KEYS.UNSUBSCRIBE_TOKENS(token),
          CACHE_TTL.UNSUBSCRIBE_TOKENS,
          JSON.stringify({ userId, category })
        );
      }
    }

    // Store tokens in database
    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      { $set: { 'emailPreferences.unsubscribeTokens': tokens } }
    );
  }

  async unsubscribeEmail(token) {
    const cacheKey = CACHE_KEYS.UNSUBSCRIBE_TOKENS(token);
    const tokenData = await redisClient.get(cacheKey);
    
    if (!tokenData) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const { userId, category } = JSON.parse(tokenData);

    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $set: {
          [`emailPreferences.subscriptions.${category}`]: false,
          updatedAt: new Date()
        }
      }
    );

    // Clear caches
    await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(userId));
    await redisClient.del(cacheKey);

    return {
      success: true,
      message: SUCCESS_MESSAGES.UNSUBSCRIBE_SUCCESSFUL,
      data: { category, userId }
    };
  }

  // =============================================================================
  // DATA EXPORT (109)
  // =============================================================================

  async requestDataExport(data) {
    const { error, value } = VALIDATION_SCHEMAS.dataExport.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    // Check for existing export request
    const existingExport = await this.getActiveExportRequest(sanitizedData.userId);
    if (existingExport) {
      throw new Error(ERROR_MESSAGES.EXPORT_REQUEST_EXISTS);
    }

    return await retry(async () => {
      const exportId = require('uuid').v4();
      
      const exportRequest = {
        exportId,
        exportType: sanitizedData.exportType,
        format: sanitizedData.format,
        status: 'requested',
        dateRange: sanitizedData.dateRange,
        includeDeleted: sanitizedData.includeDeleted,
        anonymize: sanitizedData.anonymize,
        compressionEnabled: sanitizedData.compressionEnabled,
        deliveryMethod: sanitizedData.deliveryMethod,
        requestedAt: new Date(),
        gdprCompliant: true,
        fileDetails: {
          maxDownloads: 5,
          downloadCount: 0
        }
      };

      await this.DataManagement.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { dataExports: exportRequest },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      // Queue export processing
      await publishJobEvent('data_export_request', {
        exportId,
        userId: sanitizedData.userId,
        ...sanitizedData
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.EXPORT_REQUEST_SUBMITTED,
        data: {
          exportId,
          status: 'requested',
          estimatedCompletion: this.calculateExportTime(sanitizedData.exportType),
          deliveryMethod: sanitizedData.deliveryMethod
        }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getActiveExportRequest(userId) {
    const management = await this.DataManagement.findOne({ userId });
    return management?.dataExports?.find(exp => 
      ['requested', 'processing'].includes(exp.status)
    );
  }

  async getExportStatus(exportId, userId) {
    const management = await this.DataManagement.findOne({ userId });
    const exportRequest = management?.dataExports?.find(exp => exp.exportId === exportId);
    
    if (!exportRequest) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.EXPORT_STATUS_RETRIEVED,
      data: exportRequest
    };
  }

  calculateExportTime(exportType) {
    const times = {
      'profile': '2-5 minutes',
      'applications': '5-10 minutes',
      'search_history': '3-7 minutes',
      'preferences': '1-2 minutes',
      'analytics': '10-15 minutes',
      'full': '15-30 minutes'
    };
    return times[exportType] || times['full'];
  }

  // =============================================================================
  // ACCOUNT SECURITY (110)
  // =============================================================================

  async updateSecuritySettings(data) {
    const { error, value } = VALIDATION_SCHEMAS.securitySettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const updates = {};

      // Handle password change
      if (sanitizedData.newPassword) {
        await this.validateCurrentPassword(sanitizedData.userId, sanitizedData.currentPassword);
        const hashedPassword = await bcrypt.hash(sanitizedData.newPassword, 12);
        
        updates['accountSecurity.passwordLastChanged'] = new Date();
        updates.$push = {
          'accountSecurity.passwordHistory': {
            hash: hashedPassword,
            changedAt: new Date()
          }
        };
      }

      // Handle 2FA settings
      if (sanitizedData.twoFactorAuth) {
        const twoFASettings = await this.handle2FAUpdate(sanitizedData.userId, sanitizedData.twoFactorAuth);
        updates['accountSecurity.twoFactorAuth'] = twoFASettings;
      }

      // Update other security settings
      if (sanitizedData.loginNotifications !== undefined) {
        updates['accountSecurity.loginNotifications'] = sanitizedData.loginNotifications;
      }
      if (sanitizedData.sessionTimeout !== undefined) {
        updates['accountSecurity.sessionTimeout'] = sanitizedData.sessionTimeout;
      }
      if (sanitizedData.allowMultipleSessions !== undefined) {
        updates['accountSecurity.allowMultipleSessions'] = sanitizedData.allowMultipleSessions;
      }
      if (sanitizedData.ipWhitelist !== undefined) {
        updates['accountSecurity.ipWhitelist'] = sanitizedData.ipWhitelist;
      }
      if (sanitizedData.deviceTrust !== undefined) {
        updates['accountSecurity.deviceTrust'] = sanitizedData.deviceTrust;
      }

      updates.updatedAt = new Date();

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        updates,
        { upsert: true, new: true }
      );

      // Log security event
      await this.logSecurityEvent(sanitizedData.userId, 'security_settings_updated', {
        changes: Object.keys(updates).filter(key => key !== 'updatedAt'),
        timestamp: new Date()
      });

      // Clear security cache
      await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.SECURITY_SETTINGS_UPDATED,
        data: { updated: Object.keys(updates) }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async enable2FA(userId, method, phoneNumber = null) {
    if (method === 'authenticator') {
      const secret = speakeasy.generateSecret({
        name: 'Job Platform',
        account: userId,
        length: 32
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      return {
        success: true,
        message: 'Two-factor authentication setup initiated',
        data: {
          secret: secret.base32,
          qrCode: qrCodeUrl,
          manualEntryKey: secret.base32
        }
      };
    }

    // For SMS/Email method
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code temporarily
    const tokenKey = CACHE_KEYS.SECURITY_TOKENS(verificationCode);
    await redisClient.setex(tokenKey, CACHE_TTL.SECURITY_TOKENS, JSON.stringify({
      userId,
      action: 'enable_2fa',
      method,
      phoneNumber
    }));

    // Send verification code (implementation depends on SMS/Email service)
    await this.sendVerificationCode(userId, method, verificationCode, phoneNumber);

    return {
      success: true,
      message: `Verification code sent via ${method}`,
      data: { method, masked: method === 'sms' ? this.maskPhoneNumber(phoneNumber) : null }
    };
  }

  async verify2FASetup(userId, token, secret = null) {
    const { error, value } = VALIDATION_SCHEMAS.tokenVerification.validate({ userId, token, action: 'enable_2fa' });
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    let verified = false;

    if (secret) {
      // Verify TOTP token for authenticator
      verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });
    } else {
      // Verify SMS/Email token
      const tokenKey = CACHE_KEYS.SECURITY_TOKENS(token);
      const tokenData = await redisClient.get(tokenKey);
      verified = !!tokenData;
      
      if (verified) {
        await redisClient.del(tokenKey);
      }
    }

    if (!verified) {
      throw new Error(ERROR_MESSAGES.INVALID_2FA_TOKEN);
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Enable 2FA
    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $set: {
          'accountSecurity.twoFactorAuth': {
            enabled: true,
            method: secret ? 'authenticator' : 'sms',
            secret: secret ? await this.encryptSecret(secret) : null,
            backupCodes: backupCodes.map(code => ({
              code: await this.encryptSecret(code),
              used: false,
              usedAt: null
            })),
            enabledAt: new Date(),
            lastUsed: null
          },
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    await this.logSecurityEvent(userId, '2fa_enabled', {
      method: secret ? 'authenticator' : 'sms',
      timestamp: new Date()
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA_ENABLED,
      data: {
        backupCodes: backupCodes,
        method: secret ? 'authenticator' : 'sms'
      }
    };
  }

  async disable2FA(userId, currentPassword) {
    await this.validateCurrentPassword(userId, currentPassword);

    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $set: {
          'accountSecurity.twoFactorAuth.enabled': false,
          updatedAt: new Date()
        }
      }
    );

    await this.logSecurityEvent(userId, '2fa_disabled', {
      timestamp: new Date()
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA_DISABLED
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  async getNotificationSettings(userId) {
    const cacheKey = CACHE_KEYS.NOTIFICATION_TIMING(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) return JSON.parse(cached);

    const settings = await this.NotificationSettings.findOne({ userId });
    if (settings) {
      await redisClient.setex(cacheKey, CACHE_TTL.NOTIFICATION_TIMING, JSON.stringify(settings));
    }
    
    return settings;
  }

  async getPrivacySecuritySettings(userId) {
    const cacheKey = CACHE_KEYS.SECURITY_SETTINGS(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) return JSON.parse(cached);

    const settings = await this.PrivacySecurity.findOne({ userId });
    if (settings) {
      await redisClient.setex(cacheKey, CACHE_TTL.SECURITY_SETTINGS, JSON.stringify(settings));
    }
    
    return settings;
  }

  async validateCurrentPassword(userId, currentPassword) {
    // This would validate against your user authentication system
    // Simplified implementation
    const isValid = true; // Replace with actual password validation
    
    if (!isValid) {
      throw new Error(ERROR_MESSAGES.INVALID_CURRENT_PASSWORD);
    }
    
    return true;
  }

  async handle2FAUpdate(userId, twoFAData) {
    if (twoFAData.enabled) {
      return await this.enable2FA(userId, twoFAData.method, twoFAData.phoneNumber);
    } else {
      // Disable 2FA logic would go here
      return { enabled: false };
    }
  }

  async logSecurityEvent(userId, eventType, details) {
    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $push: {
          'accountSecurity.securityEvents': {
            eventType,
            timestamp: new Date(),
            ipAddress: details.ipAddress || 'unknown',
            userAgent: details.userAgent || 'unknown',
            location: details.location || 'unknown',
            success: true,
            details
          }
        }
      },
      { upsert: true }
    );

    // Publish security event for monitoring
    await publishJobEvent('security_event', {
      userId,
      eventType,
      timestamp: new Date(),
      details
    });
  }

  async encryptSecret(plaintext) {
    // Implement proper encryption
    return Buffer.from(plaintext).toString('base64');
  }

  async sendVerificationCode(userId, method, code, phoneNumber = null) {
    // Integration with SMS/Email services would go here
    logger.info(`Verification code ${code} sent to user ${userId} via ${method}`);
  }

  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    return phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  async processScheduledNotifications() {
    // Process scheduled notifications based on user preferences
    logger.info('Processing scheduled notifications...');
  }

  async processDeadlineReminder(payload) {
    logger.info('Processing deadline reminder', payload);
  }

  async processVIPCompanyAlert(payload) {
    logger.info('Processing VIP company alert', payload);
  }

  async processNotificationOptimization(payload) {
    logger.info('Processing notification optimization', payload);
  }

  async processDataExport(payload) {
    logger.info('Processing data export', payload);
  }

  async processSecurityEvent(payload) {
    logger.info('Processing security event', payload);
  }

  // Rate limiting helper
  async checkRateLimit(userId, feature, limit, windowSeconds) {
    const key = `ratelimit:${userId}:${feature}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, windowSeconds);
    if (count > limit) throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    return true;
  }
}

// =============================================================================
// 9. CONTROLLERS
// =============================================================================

class NotificationsSettingsController {
  constructor() {
    this.service = new NotificationsSettingsService();
  }

  async initialize() {
    await this.service.initialize();
  }

  // Smart Notification Timing Controllers (101)
  updateNotificationTiming = async (req, res) => {
    try {
      const result = await this.service.updateNotificationTiming({
        ...req.body,
        userId: req.user.id
      });

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Update notification timing error:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      });
    }
  };

  getOptimalNotificationTime = async (req, res) => {
    try {
      const result = await this.service.getOptimalNotificationTime(req.user.id);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Get optimal time error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      });
    }
  };

  // Do Not Disturb Controllers (102)
  updateDNDSettings = async (req, res) => {
    try {
      const result = await this.service.updateDoNotDisturbSettings({
        ...req.body,
        userId: req.user.id
      });

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Update DND settings error:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      });
    }
  };

  // =============================================================================
// 10. COMPLETE ROUTES CONFIGURATION
// =============================================================================

import express from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Authentication middleware
const authenticate = (req, res, next) => {
  req.user = {
    id: "44e32d64-5c51-4887-ba8c-b7f60c2a25ac",
    canCreateJobs: true,
    canUpdateJobs: true,
    canDeleteJobs: true,
    canManageJobs: true,
    isPremium: true,
  };
  next();
};

// Rate limiting middleware
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message },
  standardHeaders: true,
  legacyHeaders: false
});

// Different rate limits for different features
const generalLimit = createRateLimit(15 * 60 * 1000, 100, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED); // 100/15min
const securityLimit = createRateLimit(60 * 60 * 1000, 10, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED); // 10/hour
const exportLimit = createRateLimit(60 * 60 * 1000, 3, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED); // 3/hour
const vipLimit = createRateLimit(60 * 60 * 1000, 20, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED); // 20/hour
const notificationLimit = createRateLimit(60 * 60 * 1000, 50, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED); // 50/hour

// Initialize controller
const controller = new NotificationsSettingsController();
controller.initialize().catch(console.error);

// Validation middleware
const validateUUID = param('id').isUUID().withMessage('Invalid ID format');
const validateTimezone = body('timezone').isString().isLength({ min: 3, max: 50 });
const validateEmail = body('emailAddress').isEmail().withMessage('Invalid email address');
const validatePassword = body('newPassword').isStrongPassword({
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1
}).withMessage('Password must be at least 8 characters with uppercase, lowercase, number and symbol');

// Validation helpers
const validateTimeFormat = body('*.startTime').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid time format (HH:MM)');
const validate2FAToken = body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Invalid 2FA token');
const validateCompanyId = body('companyId').isString().isLength({ min: 1, max: 100 }).withMessage('Invalid company ID');

// Apply authentication to all routes
router.use(authenticate);

// =============================================================================
// SMART NOTIFICATION TIMING ROUTES (101)
// =============================================================================

router.put('/notifications/timing', 
  notificationLimit, 
  [
    validateTimezone,
    body('preferredTimes').isObject().withMessage('Preferred times must be an object'),
    body('weekdayPreferences').isArray({ min: 1, max: 7 }).withMessage('Must specify at least one weekday'),
    body('maxNotificationsPerHour').isInt({ min: 1, max: 10 }).withMessage('Must be between 1-10 notifications per hour')
  ], 
  controller.updateNotificationTiming
);

router.get('/notifications/timing', generalLimit, controller.getNotificationTimingSettings);
router.get('/notifications/optimal-time', generalLimit, controller.getOptimalNotificationTime);
router.get('/notifications/engagement-analysis', generalLimit, controller.getEngagementAnalysis);

// =============================================================================
// DO NOT DISTURB MODE ROUTES (102)
// =============================================================================

router.put('/notifications/dnd', 
  generalLimit, 
  [
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
    body('schedules').optional().isArray({ max: 5 }).withMessage('Maximum 5 DND schedules allowed'),
    body('schedules.*.days').isArray({ min: 1, max: 7 }).withMessage('Must specify at least one day'),
    validateTimeFormat,
    body('allowEmergencyNotifications').optional().isBoolean(),
    body('emergencyKeywords').optional().isArray({ max: 10 })
  ], 
  controller.updateDNDSettings
);

router.get('/notifications/dnd', generalLimit, controller.getDNDSettings);
router.get('/notifications/dnd/status', generalLimit, controller.getDNDStatus);

// =============================================================================
// VIP COMPANY ALERTS ROUTES (103)
// =============================================================================

router.post('/notifications/vip-companies', 
  vipLimit, 
  [
    validateCompanyId,
    body('companyName').isString().isLength({ min: 1, max: 200 }).withMessage('Company name required'),
    body('alertTypes').isArray({ min: 1 }).withMessage('At least one alert type required'),
    body('priority').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid priority level'),
    body('jobRoleFilters').optional().isArray({ max: 20 }),
    body('locationFilters').optional().isArray({ max: 10 })
  ], 
  controller.addVIPCompany
);

router.get('/notifications/vip-companies', generalLimit, controller.getVIPCompanies);

router.put('/notifications/vip-companies/:companyId', 
  generalLimit, 
  [
    param('companyId').isString().isLength({ min: 1, max: 100 }),
    body('alertTypes').optional().isArray({ min: 1 }),
    body('priority').optional().isIn(['high', 'medium', 'low'])
  ], 
  controller.updateVIPCompany
);

router.delete('/notifications/vip-companies/:companyId', 
  generalLimit, 
  [param('companyId').isString().isLength({ min: 1, max: 100 })], 
  controller.removeVIPCompany
);

router.get('/notifications/vip-companies/:companyId/alerts', 
  generalLimit, 
  [param('companyId').isString()], 
  controller.getVIPCompanyAlerts
);

// =============================================================================
// APPLICATION DEADLINE REMINDERS ROUTES (104)
// =============================================================================

router.post('/notifications/deadline-reminders', 
  generalLimit, 
  [
    body('jobId').isString().notEmpty().withMessage('Job ID required'),
    body('jobTitle').isString().isLength({ min: 1, max: 200 }).withMessage('Job title required'),
    body('companyName').isString().isLength({ min: 1, max: 200 }).withMessage('Company name required'),
    body('applicationDeadline').isISO8601().toDate().withMessage('Valid deadline date required'),
    body('reminderSettings.firstReminder').isIn([1, 2, 3, 7, 14]).withMessage('Invalid first reminder days'),
    body('reminderSettings.secondReminder').isIn([1, 2, 3]).withMessage('Invalid second reminder days'),
    body('reminderSettings.finalReminder').isIn([1, 6, 12, 24]).withMessage('Invalid final reminder hours'),
    body('notificationChannels').isArray({ min: 1 }).withMessage('At least one notification channel required'),
    body('priority').optional().isIn(['high', 'medium', 'low'])
  ], 
  controller.createDeadlineReminder
);

router.get('/notifications/deadline-reminders', generalLimit, controller.getDeadlineReminders);

router.get('/notifications/deadline-reminders/upcoming', 
  generalLimit, 
  [query('days').optional().isInt({ min: 1, max: 30 }).withMessage('Days must be between 1-30')], 
  controller.getUpcomingDeadlines
);

router.put('/notifications/deadline-reminders/:reminderId', 
  generalLimit, 
  [
    param('reminderId').isUUID().withMessage('Invalid reminder ID'),
    body('reminderSettings').optional().isObject(),
    body('priority').optional().isIn(['high', 'medium', 'low']),
    body('notificationChannels').optional().isArray({ min: 1 })
  ], 
  controller.updateDeadlineReminder
);

router.delete('/notifications/deadline-reminders/:reminderId', 
  generalLimit, 
  [param('reminderId').isUUID()], 
  controller.deleteDeadlineReminder
);

// =============================================================================
// PROFILE VISIBILITY CONTROLS ROUTES (105)
// =============================================================================

router.put('/profile/visibility', 
  generalLimit, 
  [
    body('profileVisibility').isIn(['public', 'private', 'network_only', 'recruiters_only']).withMessage('Invalid profile visibility setting'),
    body('searchableByRecruiters').optional().isBoolean(),
    body('showInCompanySearch').optional().isBoolean(),
    body('allowDirectMessages').optional().isBoolean(),
    body('hideFromCurrentEmployer').optional().isBoolean(),
    body('currentEmployerDomains').optional().isArray({ max: 10 }),
    body('blockedCompanies').optional().isArray({ max: 50 }),
    body('visibleFields').optional().isObject()
  ], 
  controller.updateProfileVisibility
);

router.get('/profile/visibility', generalLimit, controller.getProfileVisibility);

// =============================================================================
// ANONYMOUS BROWSING ROUTES (106)
// =============================================================================

router.post('/profile/anonymous/enable', 
  generalLimit, 
  [
    body('enabled').isBoolean().withMessage('Enabled status required'),
    body('sessionDuration').isInt({ min: 15, max: 480 }).withMessage('Session duration must be 15-480 minutes'),
    body('trackingPreferences').optional().isObject(),
    body('autoExpire').optional().isBoolean()
  ], 
  controller.enableAnonymousBrowsing
);

router.post('/profile/anonymous/disable', generalLimit, controller.disableAnonymousBrowsing);
router.get('/profile/anonymous/status', generalLimit, controller.getAnonymousBrowsingStatus);

router.put('/profile/anonymous/session/:sessionId/extend', 
  generalLimit, 
  [
    param('sessionId').isUUID().withMessage('Invalid session ID'),
    body('duration').isInt({ min: 15, max: 480 }).withMessage('Duration must be 15-480 minutes')
  ], 
  controller.extendAnonymousSession
);

router.get('/profile/anonymous/history', 
  generalLimit, 
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ], 
  controller.getAnonymousSessionHistory
);

// =============================================================================
// JOB ALERT FREQUENCY ROUTES (107)
// =============================================================================

router.put('/notifications/alert-frequency', 
  generalLimit, 
  [
    body('globalFrequency').isIn(['instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled']).withMessage('Invalid global frequency'),
    body('categoryFrequencies').optional().isObject(),
    body('quietHours').optional().isObject(),
    body('weekendDelivery').optional().isBoolean(),
    body('maxAlertsPerDay').optional().isInt({ min: 1, max: 50 })
  ], 
  controller.updateAlertFrequency
);

router.get('/notifications/alert-frequency', generalLimit, controller.getAlertFrequencySettings);

router.put('/notifications/alert-frequency/category/:category', 
  generalLimit, 
  [
    param('category').isIn(['newJobs', 'jobRecommendations', 'applicationUpdates', 'companyUpdates', 'networkActivity', 'marketInsights', 'learningOpportunities']).withMessage('Invalid category'),
    body('frequency').isIn(['instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled']).withMessage('Invalid frequency')
  ], 
  controller.updateCategoryFrequency
);

router.post('/notifications/alert-frequency/reset', generalLimit, controller.resetAlertFrequency);

// =============================================================================
// EMAIL PREFERENCES ROUTES (108)
// =============================================================================

router.put('/notifications/email-preferences', 
  generalLimit, 
  [
    validateEmail,
    body('globalEmailEnabled').optional().isBoolean(),
    body('subscriptions').optional().isObject(),
    body('emailFormat').optional().isIn(['html', 'text', 'both']),
    body('frequency').optional().isObject()
  ], 
  controller.updateEmailPreferences
);

router.get('/notifications/email-preferences', generalLimit, controller.getEmailPreferences);

router.put('/notifications/email-preferences/subscription/:category', 
  generalLimit, 
  [
    param('category').isIn(['jobAlerts', 'applicationUpdates', 'companyNews', 'weeklyDigest', 'monthlyReport', 'marketingEmails', 'partnerOffers', 'surveyInvitations', 'productUpdates', 'securityAlerts']).withMessage('Invalid subscription category'),
    body('enabled').isBoolean().withMessage('Enabled status required')
  ], 
  controller.updateEmailSubscription
);

router.get('/notifications/email-preferences/status', generalLimit, controller.getEmailSubscriptionStatus);
router.get('/unsubscribe/:token', controller.unsubscribeEmail);
router.get('/verify-email/:token', controller.verifyEmail);

// =============================================================================
// DATA EXPORT ROUTES (109)
// =============================================================================

router.post('/data/export', 
  exportLimit, 
  [
    body('exportType').isIn(['full', 'profile', 'applications', 'search_history', 'preferences', 'analytics']).withMessage('Invalid export type'),
    body('format').isIn(['json', 'csv', 'xml', 'pdf']).withMessage('Invalid export format'),
    body('dateRange').optional().isObject(),
    body('dateRange.startDate').optional().isISO8601().toDate(),
    body('dateRange.endDate').optional().isISO8601().toDate(),
    body('includeDeleted').optional().isBoolean(),
    body('anonymize').optional().isBoolean(),
    body('deliveryMethod').optional().isIn(['download', 'email', 'secure_link'])
  ], 
  controller.requestDataExport
);

router.get('/data/export', 
  generalLimit, 
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('offset').optional().isInt({ min: 0 })
  ], 
  controller.getExportHistory
);

router.get('/data/export/:exportId/status', 
  generalLimit, 
  [param('exportId').isUUID().withMessage('Invalid export ID')], 
  controller.getExportStatus
);

router.get('/data/export/:exportId/download', 
  generalLimit, 
  [param('exportId').isUUID()], 
  controller.downloadExport
);

router.delete('/data/export/:exportId', 
  generalLimit, 
  [param('exportId').isUUID()], 
  controller.cancelExport
);

// =============================================================================
// ACCOUNT SECURITY ROUTES (110)
// =============================================================================

router.get('/account/security', generalLimit, controller.getSecuritySettings);

router.put('/account/security', 
  securityLimit, 
  [
    body('currentPassword').optional().isString().notEmpty(),
    validatePassword.optional(),
    body('twoFactorAuth').optional().isObject(),
    body('loginNotifications').optional().isBoolean(),
    body('sessionTimeout').optional().isInt({ min: 15, max: 1440 }),
    body('allowMultipleSessions').optional().isBoolean(),
    body('deviceTrust').optional().isBoolean()
  ], 
  controller.updateSecuritySettings
);

router.post('/account/password/change', 
  securityLimit, 
  [
    body('currentPassword').isString().notEmpty().withMessage('Current password required'),
    validatePassword
  ], 
  controller.changePassword
);

// Two-Factor Authentication Routes
router.post('/account/2fa/enable', 
  securityLimit, 
  [
    body('method').isIn(['sms', 'email', 'authenticator']).withMessage('Invalid 2FA method'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number required for SMS')
  ], 
  controller.enable2FA
);

router.post('/account/2fa/verify', 
  securityLimit, 
  [
    validate2FAToken,
    body('secret').optional().isString().isLength({ min: 16, max: 32 })
  ], 
  controller.verify2FASetup
);

router.post('/account/2fa/disable', 
  securityLimit, 
  [body('currentPassword').isString().notEmpty()], 
  controller.disable2FA
);

router.post('/account/2fa/backup-codes/generate', 
  securityLimit, 
  [body('currentPassword').isString().notEmpty()], 
  controller.generateBackupCodes
);

// Security Monitoring Routes
router.get('/account/security/activity', 
  generalLimit, 
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ], 
  controller.getLoginActivity
);

router.get('/account/security/devices', generalLimit, controller.getTrustedDevices);

router.delete('/account/security/devices/:deviceId', 
  securityLimit, 
  [param('deviceId').isString().notEmpty()], 
  controller.revokeTrustedDevice
);

router.put('/account/security/notifications', 
  generalLimit, 
  [body('enabled').isBoolean()], 
  controller.enableSessionNotifications
);

router.post('/account/security/lock', 
  securityLimit, 
  [
    body('reason').isString().isLength({ min: 1, max: 200 }),
    body('duration').optional().isInt({ min: 300, max: 86400 }) // 5 minutes to 24 hours
  ], 
  controller.lockAccount
);

router.post('/account/security/unlock', 
  securityLimit, 
  [body('currentPassword').isString().notEmpty()], 
  controller.unlockAccount
);

router.get('/account/security/audit', generalLimit, controller.getSecurityAudit);

// =============================================================================
// HEALTH CHECK AND MONITORING ROUTES
// =============================================================================

router.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Notifications & Settings service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

router.get('/ready', async (req, res) => {
  try {
    // Check service dependencies
    const redisStatus = await redisClient.ping() === 'PONG';
    const mongoStatus = true; // Would check MongoDB connection
    
    if (redisStatus && mongoStatus) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Service is ready',
        dependencies: {
          redis: redisStatus,
          mongodb: mongoStatus
        }
      });
    } else {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Service dependencies not ready',
        dependencies: {
          redis: redisStatus,
          mongodb: mongoStatus
        }
      });
    }
  } catch (error) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      success: false,
      message: 'Service not ready',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Unhandled route error:', error);
  
  if (error.type === 'validation') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: ERROR_MESSAGES.VALIDATION_FAILED,
      errors: error.details
    });
  }
  
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: ERROR_MESSAGES.RESOURCE_NOT_FOUND
  });
});

// =============================================================================
// ENHANCED SERVICE METHODS (Additional methods referenced in controllers)
// =============================================================================

// Add these methods to NotificationsSettingsService class:

NotificationsSettingsService.prototype.getDefaultDNDSettings = function() {
  return {
    enabled: false,
    schedules: [],
    allowEmergencyNotifications: false,
    emergencyKeywords: [],
    vipBypass: false,
    currentStatus: {
      isActive: false,
      activeUntil: null,
      reason: null
    }
  };
};

NotificationsSettingsService.prototype.getDefaultTimingSettings = function() {
  return {
    enabled: true,
    timezone: 'UTC',
    preferredTimes: {
      morning: { enabled: true, startTime: '09:00', endTime: '11:00' },
      afternoon: { enabled: true, startTime: '13:00', endTime: '15:00' },
      evening: { enabled: false, startTime: '18:00', endTime: '20:00' }
    },
    weekdayPreferences: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    smartOptimization: true,
    maxNotificationsPerHour: 3
  };
};

NotificationsSettingsService.prototype.getDefaultAlertFrequencySettings = function() {
  return {
    globalFrequency: 'daily',
    categoryFrequencies: {
      newJobs: 'daily',
      jobRecommendations: 'weekly',
      applicationUpdates: 'instant',
      companyUpdates: 'weekly',
      networkActivity: 'weekly',
      marketInsights: 'monthly',
      learningOpportunities: 'monthly'
    },
    quietHours: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00'
    },
    weekendDelivery: false,
    maxAlertsPerDay: 10
  };
};

NotificationsSettingsService.prototype.getDefaultEmailSettings = function() {
  return {
    globalEmailEnabled: true,
    subscriptions: {
      jobAlerts: true,
      applicationUpdates: true,
      companyNews: true,
      weeklyDigest: true,
      monthlyReport: true,
      marketingEmails: false,
      partnerOffers: false,
      surveyInvitations: false,
      productUpdates: true,
      securityAlerts: true
    },
    emailFormat: 'html',
    emailVerified: false
  };
};

// Additional service methods would be implemented here...
// (updateVIPCompany, updateCategoryFrequency, getExportHistory, etc.)

export { router };
  async getDeadlineReminders(userId) {
    const cacheKey = CACHE_KEYS.DEADLINE_REMINDERS(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDERS_RETRIEVED,
        data: JSON.parse(cached)
      };
    }

    const settings = await this.getNotificationSettings(userId);
    const reminders = settings?.deadlineReminders || [];
    
    // Filter active reminders and sort by deadline
    const activeReminders = reminders
      .filter(r => r.status === 'active' && new Date(r.applicationDeadline) > new Date())
      .sort((a, b) => new Date(a.applicationDeadline) - new Date(b.applicationDeadline));

    await redisClient.setex(cacheKey, CACHE_TTL.DEADLINE_REMINDERS, JSON.stringify(activeReminders));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.DEADLINE_REMINDERS_RETRIEVED,
      data: activeReminders
    };
  }

  // =============================================================================
  // PROFILE VISIBILITY CONTROLS (105)
  // =============================================================================

  async updateProfileVisibility(data) {
    const { error, value } = VALIDATION_SCHEMAS.visibilitySettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const visibilitySettings = {
        ...sanitizedData,
        lastUpdated: new Date()
      };

      // Remove userId from the settings object
      delete visibilitySettings.userId;

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'profileVisibility': visibilitySettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Clear visibility caches
      await redisClient.del(CACHE_KEYS.VISIBILITY_SETTINGS(sanitizedData.userId));
      await redisClient.del(CACHE_KEYS.RECRUITER_VISIBILITY(sanitizedData.userId));

      // Update search indexes if needed
      await publishJobEvent('profile_visibility_update', {
        userId: sanitizedData.userId,
        visibility: sanitizedData.profileVisibility,
        searchableByRecruiters: sanitizedData.searchableByRecruiters
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.VISIBILITY_SETTINGS_UPDATED,
        data: visibilitySettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getProfileVisibility(userId) {
    const cacheKey = CACHE_KEYS.VISIBILITY_SETTINGS(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.PRIVACY_SETTINGS_RETRIEVED,
        data: JSON.parse(cached)
      };
    }

    const settings = await this.getPrivacySecuritySettings(userId);
    const visibility = settings?.profileVisibility || this.getDefaultVisibilitySettings();

    await redisClient.setex(cacheKey, CACHE_TTL.VISIBILITY_SETTINGS, JSON.stringify(visibility));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.PRIVACY_SETTINGS_RETRIEVED,
      data: visibility
    };
  }

  getDefaultVisibilitySettings() {
    return {
      profileVisibility: 'public',
      searchableByRecruiters: true,
      showInCompanySearch: true,
      allowDirectMessages: true,
      showActivityStatus: false,
      hideFromCurrentEmployer: false,
      currentEmployerDomains: [],
      blockedCompanies: [],
      visibleFields: {
        email: false,
        phone: false,
        currentSalary: false,
        workHistory: true,
        education: true,
        skills: true,
        certifications: true,
        portfolio: true
      }
    };
  }

  // =============================================================================
  // ANONYMOUS BROWSING (106)
  // =============================================================================

  async enableAnonymousBrowsing(data) {
    const { error, value } = VALIDATION_SCHEMAS.anonymousSession.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const sessionId = require('uuid').v4();
      const expiresAt = new Date(Date.now() + sanitizedData.sessionDuration * 60 * 1000);
      
      const anonymousSession = {
        sessionId,
        startTime: new Date(),
        expiresAt,
        isActive: true
      };

      const anonymousSettings = {
        enabled: true,
        currentSession: anonymousSession,
        sessionDuration: sanitizedData.sessionDuration,
        trackingPreferences: sanitizedData.trackingPreferences,
        autoExpire: sanitizedData.autoExpire
      };

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'anonymousBrowsing': anonymousSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Cache session data
      const sessionCacheKey = CACHE_KEYS.ANONYMOUS_SESSION(sessionId);
      await redisClient.setex(sessionCacheKey, sanitizedData.sessionDuration * 60, JSON.stringify({
        userId: sanitizedData.userId,
        sessionId,
        expiresAt,
        trackingPreferences: sanitizedData.trackingPreferences
      }));

      // Map user to session
      const userMapKey = CACHE_KEYS.ANONYMOUS_USER_MAP(sanitizedData.userId);
      await redisClient.setex(userMapKey, sanitizedData.sessionDuration * 60, sessionId);

      // Schedule session expiration if auto-expire is enabled
      if (sanitizedData.autoExpire) {
        await publishJobEvent('anonymous_session_expire', {
          userId: sanitizedData.userId,
          sessionId
        }, { delay: sanitizedData.sessionDuration * 60 * 1000 });
      }

      return {
        success: true,
        message: SUCCESS_MESSAGES.ANONYMOUS_MODE_ENABLED,
        data: {
          sessionId,
          expiresAt,
          duration: sanitizedData.sessionDuration,
          trackingPreferences: sanitizedData.trackingPreferences
        }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async disableAnonymousBrowsing(userId) {
    return await retry(async () => {
      const settings = await this.getPrivacySecuritySettings(userId);
      const currentSession = settings?.anonymousBrowsing?.currentSession;

      // End current session
      if (currentSession?.isActive) {
        await this.endAnonymousSession(userId, currentSession.sessionId);
      }

      await this.PrivacySecurity.findOneAndUpdate(
        { userId },
        {
          $set: {
            'anonymousBrowsing.enabled': false,
            'anonymousBrowsing.currentSession.isActive': false,
            updatedAt: new Date()
          }
        }
      );

      // Clear caches
      await redisClient.del(CACHE_KEYS.ANONYMOUS_USER_MAP(userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.ANONYMOUS_MODE_DISABLED,
        data: { sessionEnded: !!currentSession?.isActive }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async endAnonymousSession(userId, sessionId) {
    const settings = await this.getPrivacySecuritySettings(userId);
    const currentSession = settings?.anonymousBrowsing?.currentSession;

    if (currentSession?.sessionId === sessionId) {
      const sessionDuration = Math.floor((Date.now() - new Date(currentSession.startTime).getTime()) / 60000);
      
      // Update session history
      await this.PrivacySecurity.findOneAndUpdate(
        { userId },
        {
          $push: {
            'anonymousBrowsing.sessionsHistory': {
              sessionId,
              startTime: currentSession.startTime,
              endTime: new Date(),
              duration: sessionDuration,
              activitiesCount: await this.getSessionActivityCount(sessionId)
            }
          },
          $set: {
            'anonymousBrowsing.currentSession.isActive': false,
            updatedAt: new Date()
          }
        }
      );
    }

    // Clear session cache
    await redisClient.del(CACHE_KEYS.ANONYMOUS_SESSION(sessionId));
    await redisClient.del(CACHE_KEYS.ANONYMOUS_ACTIVITY(sessionId));
  }

  async getSessionActivityCount(sessionId) {
    const activityKey = CACHE_KEYS.ANONYMOUS_ACTIVITY(sessionId);
    const activity = await redisClient.get(activityKey);
    return activity ? JSON.parse(activity).count || 0 : 0;
  }

  // =============================================================================
  // JOB ALERT FREQUENCY (107)
  // =============================================================================

  async updateAlertFrequency(data) {
    const { error, value } = VALIDATION_SCHEMAS.alertFrequency.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const alertSettings = {
        globalFrequency: sanitizedData.globalFrequency,
        categoryFrequencies: sanitizedData.categoryFrequencies,
        quietHours: sanitizedData.quietHours,
        weekendDelivery: sanitizedData.weekendDelivery,
        maxAlertsPerDay: sanitizedData.maxAlertsPerDay
      };

      await this.NotificationSettings.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'alertFrequency': alertSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Clear frequency cache
      await redisClient.del(CACHE_KEYS.ALERT_FREQUENCY(sanitizedData.userId));

      // Update alert scheduler
      await publishJobEvent('alert_frequency_update', {
        userId: sanitizedData.userId,
        settings: alertSettings
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.ALERT_FREQUENCY_UPDATED,
        data: alertSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  // =============================================================================
  // EMAIL PREFERENCES (108)
  // =============================================================================

  async updateEmailPreferences(data) {
    const { error, value } = VALIDATION_SCHEMAS.emailPreferences.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const emailSettings = {
        emailAddress: sanitizedData.emailAddress,
        globalEmailEnabled: sanitizedData.globalEmailEnabled,
        subscriptions: sanitizedData.subscriptions,
        emailFormat: sanitizedData.emailFormat,
        frequency: sanitizedData.frequency,
        emailVerified: false // Will be verified separately
      };

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'emailPreferences': emailSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Generate unsubscribe tokens for each subscription
      await this.generateUnsubscribeTokens(sanitizedData.userId, sanitizedData.subscriptions);

      // Clear email cache
      await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.EMAIL_PREFERENCES_UPDATED,
        data: emailSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async generateUnsubscribeTokens(userId, subscriptions) {
    const tokens = [];
    
    for (const [category, enabled] of Object.entries(subscriptions)) {
      if (enabled) {
        const token = crypto.randomBytes(32).toString('hex');
        tokens.push({
          token,
          category,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });
        
        // Cache token
        await redisClient.setex(
          CACHE_KEYS.UNSUBSCRIBE_TOKENS(token),
          CACHE_TTL.UNSUBSCRIBE_TOKENS,
          JSON.stringify({ userId, category })
        );
      }
    }

    // Store tokens in database
    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      { $set: { 'emailPreferences.unsubscribeTokens': tokens } }
    );
  }

  async unsubscribeEmail(token) {
    const cacheKey = CACHE_KEYS.UNSUBSCRIBE_TOKENS(token);
    const tokenData = await redisClient.get(cacheKey);
    
    if (!tokenData) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const { userId, category } = JSON.parse(tokenData);

    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $set: {
          [`emailPreferences.subscriptions.${category}`]: false,
          updatedAt: new Date()
        }
      }
    );

    // Clear caches
    await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(userId));
    await redisClient.del(cacheKey);

    return {
      success: true,
      message: SUCCESS_MESSAGES.UNSUBSCRIBE_SUCCESSFUL,
      data: { category, userId }
    };
  }

  // =============================================================================
  // DATA EXPORT (109)
  // =============================================================================

  async requestDataExport(data) {
    const { error, value } = VALIDATION_SCHEMAS.dataExport.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    // Check for existing export request
    const existingExport = await this.getActiveExportRequest(sanitizedData.userId);
    if (existingExport) {
      throw new Error(ERROR_MESSAGES.EXPORT_REQUEST_EXISTS);
    }

    return await retry(async () => {
      const exportId = require('uuid').v4();
      
      const exportRequest = {
        exportId,
        exportType: sanitizedData.exportType,
        format: sanitizedData.format,
        status: 'requested',
        dateRange: sanitizedData.dateRange,
        includeDeleted: sanitizedData.includeDeleted,
        anonymize: sanitizedData.anonymize,
        compressionEnabled: sanitizedData.compressionEnabled,
        deliveryMethod: sanitizedData.deliveryMethod,
        requestedAt: new Date(),
        gdprCompliant: true,
        fileDetails: {
          maxDownloads: 5,
          downloadCount: 0
        }
      };

      await this.DataManagement.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { dataExports: exportRequest },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      // Queue export processing
      await publishJobEvent('data_export_request', {
        exportId,
        userId: sanitizedData.userId,
        ...sanitizedData
      });

      return {
        success: true,
        message: SUCCESS_MESSAGES.EXPORT_REQUEST_SUBMITTED,
        data: {
          exportId,
          status: 'requested',
          estimatedCompletion: this.calculateExportTime(sanitizedData.exportType),
          deliveryMethod: sanitizedData.deliveryMethod
        }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getActiveExportRequest(userId) {
    const management = await this.DataManagement.findOne({ userId });
    return management?.dataExports?.find(exp => 
      ['requested', 'processing'].includes(exp.status)
    );
  }

  async getExportStatus(exportId, userId) {
    const management = await this.DataManagement.findOne({ userId });
    const exportRequest = management?.dataExports?.find(exp => exp.exportId === exportId);
    
    if (!exportRequest) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.EXPORT_STATUS_RETRIEVED,
      data: exportRequest
    };
  }

  calculateExportTime(exportType) {
    const times = {
      'profile': '2-5 minutes',
      'applications': '5-10 minutes',
      'search_history': '3-7 minutes',
      'preferences': '1-2 minutes',
      'analytics': '10-15 minutes',
      'full': '15-30 minutes'
    };
    return times[exportType] || times['full'];
  }

  // =============================================================================
  // ACCOUNT SECURITY (110)
  // =============================================================================

  async updateSecuritySettings(data) {
    const { error, value } = VALIDATION_SCHEMAS.securitySettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const updates = {};

      // Handle password change
      if (sanitizedData.newPassword) {
        await this.validateCurrentPassword(sanitizedData.userId, sanitizedData.currentPassword);
        const hashedPassword = await bcrypt.hash(sanitizedData.newPassword, 12);
        
        updates['accountSecurity.passwordLastChanged'] = new Date();
        updates.$push = {
          'accountSecurity.passwordHistory': {
            hash: hashedPassword,
            changedAt: new Date()
          }
        };
      }

      // Handle 2FA settings
      if (sanitizedData.twoFactorAuth) {
        const twoFASettings = await this.handle2FAUpdate(sanitizedData.userId, sanitizedData.twoFactorAuth);
        updates['accountSecurity.twoFactorAuth'] = twoFASettings;
      }

      // Update other security settings
      if (sanitizedData.loginNotifications !== undefined) {
        updates['accountSecurity.loginNotifications'] = sanitizedData.loginNotifications;
      }
      if (sanitizedData.sessionTimeout !== undefined) {
        updates['accountSecurity.sessionTimeout'] = sanitizedData.sessionTimeout;
      }
      if (sanitizedData.allowMultipleSessions !== undefined) {
        updates['accountSecurity.allowMultipleSessions'] = sanitizedData.allowMultipleSessions;
      }
      if (sanitizedData.ipWhitelist !== undefined) {
        updates['accountSecurity.ipWhitelist'] = sanitizedData.ipWhitelist;
      }
      if (sanitizedData.deviceTrust !== undefined) {
        updates['accountSecurity.deviceTrust'] = sanitizedData.deviceTrust;
      }

      updates.updatedAt = new Date();

      await this.PrivacySecurity.findOneAndUpdate(
        { userId: sanitizedData.userId },
        updates,
        { upsert: true, new: true }
      );

      // Log security event
      await this.logSecurityEvent(sanitizedData.userId, 'security_settings_updated', {
        changes: Object.keys(updates).filter(key => key !== 'updatedAt'),
        timestamp: new Date()
      });

      // Clear security cache
      await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.SECURITY_SETTINGS_UPDATED,
        data: { updated: Object.keys(updates) }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async enable2FA(userId, method, phoneNumber = null) {
    if (method === 'authenticator') {
      const secret = speakeasy.generateSecret({
        name: 'Job Platform',
        account: userId,
        length: 32
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      return {
        success: true,
        message: 'Two-factor authentication setup initiated',
        data: {
          secret: secret.base32,
          qrCode: qrCodeUrl,
          manualEntryKey: secret.base32
        }
      };
    }

    // For SMS/Email method
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code temporarily
    const tokenKey = CACHE_KEYS.SECURITY_TOKENS(verificationCode);
    await redisClient.setex(tokenKey, CACHE_TTL.SECURITY_TOKENS, JSON.stringify({
      userId,
      action: 'enable_2fa',
      method,
      phoneNumber
    }));

    // Send verification code (implementation depends on SMS/Email service)
    await this.sendVerificationCode(userId, method, verificationCode, phoneNumber);

    return {
      success: true,
      message: `Verification code sent via ${method}`,
      data: { method, masked: method === 'sms' ? this.maskPhoneNumber(phoneNumber) : null }
    };
  }

  async verify2FASetup(userId, token, secret = null) {
    const { error, value } = VALIDATION_SCHEMAS.tokenVerification.validate({ userId, token, action: 'enable_2fa' });
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    let verified = false;

    if (secret) {
      // Verify TOTP token for authenticator
      verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });
    } else {
      // Verify SMS/Email token
      const tokenKey = CACHE_KEYS.SECURITY_TOKENS(token);
      const tokenData = await redisClient.get(tokenKey);
      verified = !!tokenData;
      
      if (verified) {
        await redisClient.del(tokenKey);
      }
    }

    if (!verified) {
      throw new Error(ERROR_MESSAGES.INVALID_2FA_TOKEN);
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Enable 2FA
    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $set: {
          'accountSecurity.twoFactorAuth': {
            enabled: true,
            method: secret ? 'authenticator' : 'sms',
            secret: secret ? await this.encryptSecret(secret) : null,
            backupCodes: backupCodes.map(code => ({
              code: await this.encryptSecret(code),
              used: false,
              usedAt: null
            })),
            enabledAt: new Date(),
            lastUsed: null
          },
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    await this.logSecurityEvent(userId, '2fa_enabled', {
      method: secret ? 'authenticator' : 'sms',
      timestamp: new Date()
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA_ENABLED,
      data: {
        backupCodes: backupCodes,
        method: secret ? 'authenticator' : 'sms'
      }
    };
  }

  async disable2FA(userId, currentPassword) {
    await this.validateCurrentPassword(userId, currentPassword);

    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $set: {
          'accountSecurity.twoFactorAuth.enabled': false,
          updatedAt: new Date()
        }
      }
    );

    await this.logSecurityEvent(userId, '2fa_disabled', {
      timestamp: new Date()
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA_DISABLED
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  async getNotificationSettings(userId) {
    const cacheKey = CACHE_KEYS.NOTIFICATION_TIMING(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) return JSON.parse(cached);

    const settings = await this.NotificationSettings.findOne({ userId });
    if (settings) {
      await redisClient.setex(cacheKey, CACHE_TTL.NOTIFICATION_TIMING, JSON.stringify(settings));
    }
    
    return settings;
  }

  async getPrivacySecuritySettings(userId) {
    const cacheKey = CACHE_KEYS.SECURITY_SETTINGS(userId);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) return JSON.parse(cached);

    const settings = await this.PrivacySecurity.findOne({ userId });
    if (settings) {
      await redisClient.setex(cacheKey, CACHE_TTL.SECURITY_SETTINGS, JSON.stringify(settings));
    }
    
    return settings;
  }

  async validateCurrentPassword(userId, currentPassword) {
    // This would validate against your user authentication system
    // Simplified implementation
    const isValid = true; // Replace with actual password validation
    
    if (!isValid) {
      throw new Error(ERROR_MESSAGES.INVALID_CURRENT_PASSWORD);
    }
    
    return true;
  }

  async handle2FAUpdate(userId, twoFAData) {
    if (twoFAData.enabled) {
      return await this.enable2FA(userId, twoFAData.method, twoFAData.phoneNumber);
    } else {
      // Disable 2FA logic would go here
      return { enabled: false };
    }
  }

  async logSecurityEvent(userId, eventType, details) {
    await this.PrivacySecurity.findOneAndUpdate(
      { userId },
      {
        $push: {
          'accountSecurity.securityEvents': {
            eventType,
            timestamp: new Date(),
            ipAddress: details.ipAddress || 'unknown',
            userAgent: details.userAgent || 'unknown',
            location: details.location || 'unknown',
            success: true,
            details
          }
        }
      },
      { upsert: true }
    );

    // Publish security event for monitoring
    await publishJobEvent('security_event', {
      userId,
      eventType,
      timestamp: new Date(),
      details
    });
  }

  async encryptSecret(plaintext) {
    // Implement proper encryption
    return Buffer.from(plaintext).toString('base64');
  }

  async sendVerificationCode(userId, method, code, phoneNumber = null) {
    // Integration with SMS/Email services would go here
    logger.info(`Verification code ${code} sent to user ${userId} via ${method}`);
  }

  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    return phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  async processScheduledNotifications() {
    // Process scheduled notifications based on user preferences
    logger.info('Processing scheduled notifications...');
  }

  async processDeadlineReminder(payload) {
    logger.info('Processing deadline reminder', payload);
  }

  async processVIPCompanyAlert(payload) {
    logger.info('Processing VIP company alert', payload);
  }

  async processNotificationOptimization(payload) {
    logger.info('Processing notification optimization', payload);
  }

  async processDataExport(payload) {
    logger.info('Processing data export', payload);
  }

  async processSecurityEvent(payload) {
    logger.info('Processing security event', payload);
  }

  // Rate limiting helper
  async checkRateLimit(userId, feature, limit, windowSeconds) {
    const key = `ratelimit:${userId}:${feature}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, windowSeconds);
    if (count > limit) throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    return true;
  }
}

