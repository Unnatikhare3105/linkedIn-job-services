// services/notificationsSettings.service.js
import { redisClient } from '../config/redis.js';
import { publishJobEvent, consumer } from '../../config/kafka.js';
import logger from '../utils/logger.js';
import { sanitizeInput } from '../../utils/security.js';
import retry from 'async-retry';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import UserInteractionModel from '../../model/userInteraction.model.js'; // Merged model for notifications and privacy
import ProfessionalDevModel from '../../model/professionalDev.model.js'; // Merged model
import { NOTIFICATION_VALIDATION_SCHEMAS } from '../../validations/premium.validations.js'; // Adjusted path
import { CACHE_KEYS, CACHE_TTL } from '../../constants/cache.js'; // Adjusted path
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../../constants/messages.js'; // Adjusted path

export class NotificationsSettingsService {

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
      case 'anonymous_session_expire':
        await this.endAnonymousSession(payload.userId, payload.sessionId);
        break;
      case 'alert_frequency_update':
        await this.updateAlertScheduler(payload.userId, payload.settings);
        break;
      case 'profile_visibility_update':
        await this.updateProfileSearchIndex(payload);
        break;
      default:
        logger.warn(`Unknown event type: ${type}`);
    }
  }

  // =============================================================================
  // SMART NOTIFICATION TIMING (101)
  // =============================================================================

  async updateNotificationTiming(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.notificationTiming.validate(data);
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

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'notificationSettings.smartTiming': timingSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      await redisClient.del(CACHE_KEYS.NOTIFICATION_TIMING(sanitizedData.userId));

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

  async getNotificationTimingSettings(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.smartTiming').lean();
    return {
      success: true,
      message: SUCCESS_MESSAGES.TIMING_SETTINGS_RETRIEVED,
      data: settings?.notificationSettings?.smartTiming || this.getDefaultTimingSettings()
    };
  }

  async getOptimalNotificationTime(userId) {
    const cacheKey = CACHE_KEYS.OPTIMAL_TIME(userId);
    let cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.OPTIMAL_TIME_CALCULATED,
        data: JSON.parse(cached)
      };
    }

    const engagementData = await this.analyzeEngagementPatterns(userId);
    const optimalTime = await this.calculateOptimalTime(userId, engagementData);

    await redisClient.setex(cacheKey, CACHE_TTL.OPTIMAL_TIME, JSON.stringify(optimalTime));

    return {
      success: true,
      message: SUCCESS_MESSAGES.OPTIMAL_TIME_CALCULATED,
      data: optimalTime
    };
  }

  async getEngagementAnalysis(userId) {
    const engagementData = await this.analyzeEngagementPatterns(userId);
    return {
      success: true,
      message: SUCCESS_MESSAGES.ENGAGEMENT_ANALYSIS_RETRIEVED,
      data: engagementData
    };
  }

  async analyzeEngagementPatterns(userId) {
    const cacheKey = CACHE_KEYS.USER_ENGAGEMENT_PATTERN(userId);
    let cached = await redisClient.get(cacheKey);
    
    if (cached) return JSON.parse(cached);

    // Placeholder for actual analysis - in production, aggregate from activities
    const engagementPattern = {
      bestHour: 14,
      bestDay: 'tuesday',
      avgResponseTime: 45,
      engagementScore: 75,
      hourlyEngagement: { /* data */ },
      weeklyEngagement: { /* data */ }
    };

    await redisClient.setex(cacheKey, CACHE_TTL.USER_ENGAGEMENT_PATTERN, JSON.stringify(engagementPattern));
    return engagementPattern;
  }

  async calculateOptimalTime(userId, engagementData) {
    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.smartTiming.timezone').lean();
    const userTimezone = settings?.notificationSettings?.smartTiming?.timezone || 'UTC';
    
    // Calculation logic
    const optimalHour = engagementData.bestHour;
    const optimalDay = engagementData.bestDay;
    
    return {
      recommendedTime: `${optimalHour.toString().padStart(2, '0')}:00`,
      recommendedDay: optimalDay,
      confidence: engagementData.engagementScore,
      timezone: userTimezone,
      nextOptimalSlots: [ /* slots */ ],
      reasoning: 'Based on your engagement patterns...'
    };
  }
//=========================================================================================
  // Do Not Disturb Mode (102)
  //=========================================================================================
  async updateDoNotDisturbSettings(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.dndSettings.validate(data);
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

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'notificationSettings.doNotDisturb': dndSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      await this.updateActiveDNDUsers();

      await redisClient.del(CACHE_KEYS.DND_STATUS(sanitizedData.userId));

      return {
        success: true,
        message: sanitizedData.enabled ? SUCCESS_MESSAGES.DND_MODE_ENABLED : SUCCESS_MESSAGES.DND_MODE_DISABLED,
        data: dndSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getDNDSettings(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.doNotDisturb').lean();
    return {
      success: true,
      message: SUCCESS_MESSAGES.DND_SETTINGS_RETRIEVED,
      data: settings?.notificationSettings?.doNotDisturb || this.getDefaultDNDSettings()
    };
  }

  async getDNDStatus(userId) {
    const cacheKey = CACHE_KEYS.DND_STATUS(userId);
    let status = await redisClient.get(cacheKey);
    
    if (status) {
      status = JSON.parse(status);
    } else {
      const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.doNotDisturb').lean();
      status = settings?.notificationSettings?.doNotDisturb?.currentStatus || { isActive: false };
      await redisClient.setex(cacheKey, CACHE_TTL.DND_STATUS, JSON.stringify(status));
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.DND_STATUS_RETRIEVED,
      data: status
    };
  }

//=========================================================================================
  // VIP Company Alerts (103)
  //=========================================================================================

  async addVIPCompany(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.vipCompany.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const settings = await UserInteractionModel.findOne({ userId: sanitizedData.userId }).select('notificationSettings.vipCompanies').lean();
      const currentVIPCount = settings?.notificationSettings?.vipCompanies?.length || 0;
      
      if (currentVIPCount >= 50) {
        throw new Error(ERROR_MESSAGES.VIP_LIST_LIMIT_EXCEEDED);
      }

      const existingCompany = settings?.notificationSettings?.vipCompanies?.find(c => c.companyId === sanitizedData.companyId);
      
      if (existingCompany) {
        throw new Error(ERROR_MESSAGES.VIP_COMPANY_EXISTS);
      }

      const vipCompany = {
        ...sanitizedData,
        addedAt: new Date(),
        lastAlertSent: null,
        alertCount: 0
      };

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { 'notificationSettings.vipCompanies': vipCompany },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      await redisClient.del(CACHE_KEYS.VIP_COMPANIES(sanitizedData.userId));

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
      await UserInteractionModel.findOneAndUpdate(
        { userId },
        {
          $pull: { 'notificationSettings.vipCompanies': { companyId } },
          $set: { updatedAt: new Date() }
        }
      );

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

    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.vipCompanies').lean();
    const vipCompanies = settings?.notificationSettings?.vipCompanies || [];

    await redisClient.setex(cacheKey, CACHE_TTL.VIP_COMPANIES, JSON.stringify(vipCompanies));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.VIP_COMPANIES_RETRIEVED,
      data: vipCompanies
    };
  }

  async updateVIPCompany(userId, companyId, data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.vipCompany.validate({ ...data, userId, companyId });
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const update = {};
      if (sanitizedData.alertTypes) update['notificationSettings.vipCompanies.$.alertTypes'] = sanitizedData.alertTypes;
      if (sanitizedData.priority) update['notificationSettings.vipCompanies.$.priority'] = sanitizedData.priority;
      if (sanitizedData.instantNotifications !== undefined) update['notificationSettings.vipCompanies.$.instantNotifications'] = sanitizedData.instantNotifications;
      if (sanitizedData.jobRoleFilters) update['notificationSettings.vipCompanies.$.jobRoleFilters'] = sanitizedData.jobRoleFilters;
      if (sanitizedData.locationFilters) update['notificationSettings.vipCompanies.$.locationFilters'] = sanitizedData.locationFilters;

      const result = await UserInteractionModel.findOneAndUpdate(
        { userId, 'notificationSettings.vipCompanies.companyId': companyId },
        { $set: update },
        { new: true }
      );

      if (!result) {
        throw new Error(ERROR_MESSAGES.COMPANY_NOT_FOUND);
      }

      await redisClient.del(CACHE_KEYS.VIP_COMPANIES(userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_UPDATED,
        data: result.notificationSettings.vipCompanies.find(c => c.companyId === companyId)
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getVIPCompanyAlerts(userId, companyId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.vipCompanies').lean();
    const vipCompany = settings?.notificationSettings?.vipCompanies?.find(c => c.companyId === companyId);

    if (!vipCompany) {
      throw new Error(ERROR_MESSAGES.COMPANY_NOT_FOUND);
    }

    // Placeholder for actual alerts
    const alerts = {
      lastAlertSent: vipCompany.lastAlertSent,
      alertCount: vipCompany.alertCount,
      recentAlerts: []
    };

    return {
      success: true,
      message: SUCCESS_MESSAGES.VIP_COMPANY_ALERTS_RETRIEVED,
      data: alerts
    };
  }

  //=========================================================================================
  // Application Deadline Reminders (104)
  //=========================================================================================

  async createDeadlineReminder(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.deadlineReminder.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    if (new Date(sanitizedData.applicationDeadline) <= new Date()) {
      throw new Error(ERROR_MESSAGES.DEADLINE_IN_PAST);
    }

    return await retry(async () => {
      const settings = await UserInteractionModel.findOne({ userId: sanitizedData.userId }).select('notificationSettings.deadlineReminders').lean();
      if (settings.notificationSettings.deadlineReminders.length >= 100) {
        throw new Error(ERROR_MESSAGES.REMINDER_LIMIT_EXCEEDED);
      }

      const reminder = {
        reminderId: uuidv4(),
        ...sanitizedData,
        status: 'active',
        remindersSent: [],
        createdAt: new Date()
      };

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { 'notificationSettings.deadlineReminders': reminder },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

      await this.scheduleDeadlineNotifications(reminder);

      await redisClient.del(CACHE_KEYS.DEADLINE_REMINDERS(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_CREATED,
        data: reminder
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async updateDeadlineReminder(userId, reminderId, data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.deadlineReminder.validate({ ...data, userId });
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const update = {};
      if (sanitizedData.jobTitle) update['notificationSettings.deadlineReminders.$.jobTitle'] = sanitizedData.jobTitle;
      if (sanitizedData.companyName) update['notificationSettings.deadlineReminders.$.companyName'] = sanitizedData.companyName;
      if (sanitizedData.applicationDeadline) update['notificationSettings.deadlineReminders.$.applicationDeadline'] = sanitizedData.applicationDeadline;
      if (sanitizedData.reminderSettings) update['notificationSettings.deadlineReminders.$.reminderSettings'] = sanitizedData.reminderSettings;
      if (sanitizedData.priority) update['notificationSettings.deadlineReminders.$.priority'] = sanitizedData.priority;
      if (sanitizedData.notificationChannels) update['notificationSettings.deadlineReminders.$.notificationChannels'] = sanitizedData.notificationChannels;

      const result = await UserInteractionModel.findOneAndUpdate(
        { userId, 'notificationSettings.deadlineReminders.reminderId': reminderId },
        { $set: update },
        { new: true }
      );

      if (!result) {
        throw new Error(ERROR_MESSAGES.DEADLINE_NOT_FOUND);
      }

      await redisClient.del(CACHE_KEYS.DEADLINE_REMINDERS(userId));

      if (sanitizedData.applicationDeadline || sanitizedData.reminderSettings) {
        const reminder = result.notificationSettings.deadlineReminders.find(r => r.reminderId === reminderId);
        await this.scheduleDeadlineNotifications(reminder);
      }

      return {
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_UPDATED,
        data: result.notificationSettings.deadlineReminders.find(r => r.reminderId === reminderId)
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async deleteDeadlineReminder(userId, reminderId) {
    return await retry(async () => {
      const result = await UserInteractionModel.findOneAndUpdate(
        { userId },
        {
          $pull: { 'notificationSettings.deadlineReminders': { reminderId } },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      if (!result) {
        throw new Error(ERROR_MESSAGES.DEADLINE_NOT_FOUND);
      }

      await redisClient.del(CACHE_KEYS.DEADLINE_REMINDERS(userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_DELETED,
        data: { reminderId }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getUpcomingDeadlines(userId, days = 7) {
    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.deadlineReminders').lean();
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    const upcoming = settings?.notificationSettings?.deadlineReminders?.filter(r => 
      r.status === 'active' &&
      new Date(r.applicationDeadline) > now &&
      new Date(r.applicationDeadline) <= future
    ) || [];

    return {
      success: true,
      message: SUCCESS_MESSAGES.UPCOMING_DEADLINES_RETRIEVED,
      data: upcoming.sort((a, b) => new Date(a.applicationDeadline) - new Date(b.applicationDeadline))
    };
  }

  // Profile Visibility Controls (105)
  async updateProfileVisibility(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.visibilitySettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const visibilitySettings = {
        ...sanitizedData,
        lastUpdated: new Date()
      };

      delete visibilitySettings.userId;

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'privacySecurity.profileVisibility': visibilitySettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      await redisClient.del(CACHE_KEYS.VISIBILITY_SETTINGS(sanitizedData.userId));
      await redisClient.del(CACHE_KEYS.RECRUITER_VISIBILITY(sanitizedData.userId));

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

    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.profileVisibility').lean();
    const visibility = settings?.privacySecurity?.profileVisibility || this.getDefaultVisibilitySettings();

    await redisClient.setex(cacheKey, CACHE_TTL.VISIBILITY_SETTINGS, JSON.stringify(visibility));
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.PRIVACY_SETTINGS_RETRIEVED,
      data: visibility
    };
  }

  //=========================================================================================
  // Anonymous Browsing (106)
  //=========================================================================================

  async enableAnonymousBrowsing(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.anonymousSession.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const sessionId = uuidv4();
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

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'privacySecurity.anonymousBrowsing': anonymousSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      const sessionCacheKey = CACHE_KEYS.ANONYMOUS_SESSION(sessionId);
      await redisClient.setex(sessionCacheKey, sanitizedData.sessionDuration * 60, JSON.stringify({
        userId: sanitizedData.userId,
        sessionId,
        expiresAt,
        trackingPreferences: sanitizedData.trackingPreferences
      }));

      const userMapKey = CACHE_KEYS.ANONYMOUS_USER_MAP(sanitizedData.userId);
      await redisClient.setex(userMapKey, sanitizedData.sessionDuration * 60, sessionId);

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
      const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.anonymousBrowsing').lean();
      const currentSession = settings?.privacySecurity?.anonymousBrowsing?.currentSession;

      if (currentSession?.isActive) {
        await this.endAnonymousSession(userId, currentSession.sessionId);
      }

      await UserInteractionModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            'privacySecurity.anonymousBrowsing.enabled': false,
            'privacySecurity.anonymousBrowsing.currentSession.isActive': false,
            updatedAt: new Date()
          }
        }
      );

      await redisClient.del(CACHE_KEYS.ANONYMOUS_USER_MAP(userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.ANONYMOUS_MODE_DISABLED,
        data: { sessionEnded: !!currentSession?.isActive }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async endAnonymousSession(userId, sessionId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.anonymousBrowsing').lean();
    const currentSession = settings?.privacySecurity?.anonymousBrowsing?.currentSession;

    if (currentSession?.sessionId === sessionId) {
      const sessionDuration = Math.floor((Date.now() - new Date(currentSession.startTime).getTime()) / 60000);
      
      await UserInteractionModel.findOneAndUpdate(
        { userId },
        {
          $push: {
            'privacySecurity.anonymousBrowsing.sessionsHistory': {
              sessionId,
              startTime: currentSession.startTime,
              endTime: new Date(),
              duration: sessionDuration,
              activitiesCount: await this.getSessionActivityCount(sessionId)
            }
          },
          $set: {
            'privacySecurity.anonymousBrowsing.currentSession.isActive': false,
            updatedAt: new Date()
          }
        }
      );
    }

    await redisClient.del(CACHE_KEYS.ANONYMOUS_SESSION(sessionId));
    await redisClient.del(CACHE_KEYS.ANONYMOUS_ACTIVITY(sessionId));
  }

  async getSessionActivityCount(sessionId) {
    const activityKey = CACHE_KEYS.ANONYMOUS_ACTIVITY(sessionId);
    const activity = await redisClient.get(activityKey);
    return activity ? JSON.parse(activity).count || 0 : 0;
  }

  async getAnonymousBrowsingStatus(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.anonymousBrowsing').lean();
    const anonymousBrowsing = settings?.privacySecurity?.anonymousBrowsing || { enabled: false };
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.ANONYMOUS_STATUS_RETRIEVED,
      data: anonymousBrowsing
    };
  }

  async extendAnonymousSession(userId, sessionId, duration) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.anonymousBrowsing').lean();
    const currentSession = settings?.privacySecurity?.anonymousBrowsing?.currentSession;

    if (!currentSession || currentSession.sessionId !== sessionId || !currentSession.isActive) {
      throw new Error(ERROR_MESSAGES.ANONYMOUS_SESSION_EXPIRED);
    }

    const newExpiresAt = new Date(Date.now() + duration * 60 * 1000);

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.anonymousBrowsing.currentSession.expiresAt': newExpiresAt,
          updatedAt: new Date()
        }
      }
    );

    const sessionCacheKey = CACHE_KEYS.ANONYMOUS_SESSION(sessionId);
    await redisClient.expire(sessionCacheKey, duration * 60);

    const userMapKey = CACHE_KEYS.ANONYMOUS_USER_MAP(userId);
    await redisClient.expire(userMapKey, duration * 60);

    await publishJobEvent('anonymous_session_expire', {
      userId,
      sessionId
    }, { delay: duration * 60 * 1000 });

    return {
      success: true,
      message: SUCCESS_MESSAGES.ANONYMOUS_SESSION_EXTENDED,
      data: { newExpiresAt }
    };
  }

  async getAnonymousSessionHistory(userId, limit = 10, offset = 0) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.anonymousBrowsing.sessionsHistory').lean();
    const history = settings?.privacySecurity?.anonymousBrowsing?.sessionsHistory || [];

    const paginatedHistory = history
      .sort((a, b) => b.startTime - a.startTime)
      .slice(offset, offset + limit);

    return {
      success: true,
      message: SUCCESS_MESSAGES.ANONYMOUS_HISTORY_RETRIEVED,
      data: {
        history: paginatedHistory,
        total: history.length
      }
    };
  }

  //=========================================================================================
  // Job Alert Frequency (107)
  //=========================================================================================

  async updateAlertFrequency(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.alertFrequency.validate(data);
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

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'notificationSettings.alertFrequency': alertSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      await redisClient.del(CACHE_KEYS.ALERT_FREQUENCY(sanitizedData.userId));

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

  async getAlertFrequencySettings(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('notificationSettings.alertFrequency').lean();
    return {
      success: true,
      message: SUCCESS_MESSAGES.ALERT_FREQUENCY_SETTINGS_RETRIEVED,
      data: settings?.notificationSettings?.alertFrequency || this.getDefaultAlertFrequencySettings()
    };
  }

  async updateCategoryFrequency(userId, category, frequency) {
    const validCategories = Object.keys(NOTIFICATION_VALIDATION_SCHEMAS.alertFrequency.keys.categoryFrequencies.keys);
    if (!validCategories.includes(category)) {
      throw new Error(ERROR_MESSAGES.INVALID_FREQUENCY_SETTING);
    }

    const update = {};
    update[`notificationSettings.alertFrequency.categoryFrequencies.${category}`] = frequency;

    const result = await UserInteractionModel.findOneAndUpdate(
      { userId },
      { $set: update, updatedAt: new Date() },
      { new: true }
    );

    if (!result) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    await redisClient.del(CACHE_KEYS.ALERT_FREQUENCY(userId));

    await publishJobEvent('alert_frequency_update', {
      userId,
      settings: result.notificationSettings.alertFrequency
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.CATEGORY_FREQUENCY_UPDATED,
      data: { category, frequency }
    };
  }

  async resetAlertFrequency(userId) {
    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'notificationSettings.alertFrequency': this.getDefaultAlertFrequencySettings(),
          updatedAt: new Date()
        }
      }
    );

    await redisClient.del(CACHE_KEYS.ALERT_FREQUENCY(userId));

    await publishJobEvent('alert_frequency_update', {
      userId,
      settings: this.getDefaultAlertFrequencySettings()
    });

    return {
      success: true,
      message: SUCCESS_MESSAGES.ALERT_FREQUENCY_RESET
    };
  }

  //=========================================================================================
  // Email Preferences (108)
  //=========================================================================================

  async updateEmailPreferences(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.emailPreferences.validate(data);
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
        emailVerified: false
      };

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $set: {
            'privacySecurity.emailPreferences': emailSettings,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      await this.generateUnsubscribeTokens(sanitizedData.userId, sanitizedData.subscriptions);

      await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.EMAIL_PREFERENCES_UPDATED,
        data: emailSettings
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async getEmailPreferences(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.emailPreferences').lean();
    return {
      success: true,
      message: SUCCESS_MESSAGES.EMAIL_SETTINGS_RETRIEVED,
      data: settings?.privacySecurity?.emailPreferences || this.getDefaultEmailSettings()
    };
  }

  async updateEmailSubscription(userId, category, enabled) {
    const validCategories = Object.keys(NOTIFICATION_VALIDATION_SCHEMAS.emailPreferences.keys.subscriptions.keys);
    if (!validCategories.includes(category)) {
      throw new Error(ERROR_MESSAGES.INVALID_EMAIL_PREFERENCE);
    }

    const update = {};
    update[`privacySecurity.emailPreferences.subscriptions.${category}`] = enabled;

    const result = await UserInteractionModel.findOneAndUpdate(
      { userId },
      { $set: update, updatedAt: new Date() },
      { new: true }
    );

    if (!result) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(userId));

    await this.generateUnsubscribeTokens(userId, result.privacySecurity.emailPreferences.subscriptions);

    return {
      success: true,
      message: SUCCESS_MESSAGES.SUBSCRIPTION_UPDATED,
      data: { category, enabled }
    };
  }

  async verifyEmail(token) {
    const tokenData = await redisClient.get(CACHE_KEYS.SECURITY_TOKENS(token));
    if (!tokenData) {
      throw new Error(ERROR_MESSAGES.INVALID_2FA_TOKEN);
    }

    const { userId } = JSON.parse(tokenData);

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.emailPreferences.emailVerified': true,
          updatedAt: new Date()
        }
      }
    );

    await redisClient.del(CACHE_KEYS.SECURITY_TOKENS(token));
    await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.EMAIL_VERIFIED
    };
  }

  async unsubscribeEmail(token) {
    const cacheKey = CACHE_KEYS.UNSUBSCRIBE_TOKENS(token);
    const tokenData = await redisClient.get(cacheKey);
    
    if (!tokenData) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const { userId, category } = JSON.parse(tokenData);

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          [`privacySecurity.emailPreferences.subscriptions.${category}`]: false,
          updatedAt: new Date()
        }
      }
    );

    await redisClient.del(CACHE_KEYS.EMAIL_PREFERENCES(userId));
    await redisClient.del(cacheKey);

    return {
      success: true,
      message: SUCCESS_MESSAGES.UNSUBSCRIBE_SUCCESSFUL,
      data: { category, userId }
    };
  }

  async getEmailSubscriptionStatus(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.emailPreferences.subscriptions').lean();
    return {
      success: true,
      message: SUCCESS_MESSAGES.EMAIL_SUBSCRIPTION_STATUS_RETRIEVED,
      data: settings?.privacySecurity?.emailPreferences?.subscriptions || {}
    };
  }

  //=========================================================================================
  // Data Export (109)
  //=========================================================================================

  async requestDataExport(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.dataExport.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const settings = await ProfessionalDevModel.findOne({ userId: sanitizedData.userId }).select('dataManagement.dataExports').lean();
      const existingExport = settings?.dataManagement?.dataExports?.find(exp => 
        ['requested', 'processing'].includes(exp.status)
      );
      if (existingExport) {
        throw new Error(ERROR_MESSAGES.EXPORT_REQUEST_EXISTS);
      }

      const exportId = uuidv4();
      
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

      await ProfessionalDevModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        {
          $push: { 'dataManagement.dataExports': exportRequest },
          $set: { updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );

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

  async getExportHistory(userId, limit = 10, offset = 0) {
    const settings = await ProfessionalDevModel.findOne({ userId }).select('dataManagement.dataExports').lean();
    const exports = settings?.dataManagement?.dataExports || [];

    const paginatedExports = exports
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(offset, offset + limit);

    return {
      success: true,
      message: SUCCESS_MESSAGES.EXPORT_HISTORY_RETRIEVED,
      data: {
        exports: paginatedExports,
        total: exports.length
      }
    };
  }

  async getExportStatus(exportId, userId) {
    const settings = await ProfessionalDevModel.findOne({ userId }).select('dataManagement.dataExports').lean();
    const exportRequest = settings?.dataManagement?.dataExports?.find(exp => exp.exportId === exportId);
    
    if (!exportRequest) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.EXPORT_STATUS_RETRIEVED,
      data: exportRequest
    };
  }

  async downloadExport(exportId, userId) {
    const settings = await ProfessionalDevModel.findOne({ userId }).select('dataManagement.dataExports').lean();
    const exportRequest = settings?.dataManagement?.dataExports?.find(exp => exp.exportId === exportId);

    if (!exportRequest || exportRequest.status !== 'completed') {
      throw new Error(ERROR_MESSAGES.EXPORT_FILE_NOT_FOUND);
    }

    if (exportRequest.fileDetails.downloadCount >= exportRequest.fileDetails.maxDownloads) {
      throw new Error(ERROR_MESSAGES.EXPORT_FILE_NOT_FOUND); // Expired
    }

    await ProfessionalDevModel.findOneAndUpdate(
      { userId, 'dataManagement.dataExports.exportId': exportId },
      { $inc: { 'dataManagement.dataExports.$.fileDetails.downloadCount': 1 } }
    );

    return {
      success: true,
      message: SUCCESS_MESSAGES.EXPORT_DOWNLOADED,
      data: { downloadUrl: exportRequest.fileDetails.downloadUrl }
    };
  }

  async cancelExport(exportId, userId) {
    const update = {};
    update['dataManagement.dataExports.$.status'] = 'cancelled';

    const result = await ProfessionalDevModel.findOneAndUpdate(
      { userId, 'dataManagement.dataExports.exportId': exportId, 'dataManagement.dataExports.status': { $in: ['requested', 'processing'] } },
      { $set: update },
      { new: true }
    );

    if (!result) {
      throw new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.EXPORT_CANCELLED,
      data: { exportId }
    };
  }

  //=========================================================================================
  // Account Security (110)
  //=========================================================================================

  async updateSecuritySettings(data) {
    const { error, value } = NOTIFICATION_VALIDATION_SCHEMAS.securitySettings.validate(data);
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    const sanitizedData = sanitizeInput(value);

    return await retry(async () => {
      const updates = {};
      if (sanitizedData.newPassword) {
        await this.validateCurrentPassword(sanitizedData.userId, sanitizedData.currentPassword);
        const hashedPassword = await bcrypt.hash(sanitizedData.newPassword, 12);
        
        updates['privacySecurity.accountSecurity.passwordLastChanged'] = new Date();
        updates['$push'] = {
          'privacySecurity.accountSecurity.passwordHistory': {
            hash: hashedPassword,
            changedAt: new Date()
          }
        };
      }

      if (sanitizedData.twoFactorAuth) {
        updates['privacySecurity.accountSecurity.twoFactorAuth'] = await this.handle2FAUpdate(sanitizedData.userId, sanitizedData.twoFactorAuth);
      }

      if (sanitizedData.loginNotifications !== undefined) {
        updates['privacySecurity.accountSecurity.loginNotifications'] = sanitizedData.loginNotifications;
      }
      if (sanitizedData.sessionTimeout !== undefined) {
        updates['privacySecurity.accountSecurity.sessionTimeout'] = sanitizedData.sessionTimeout;
      }
      if (sanitizedData.allowMultipleSessions !== undefined) {
        updates['privacySecurity.accountSecurity.allowMultipleSessions'] = sanitizedData.allowMultipleSessions;
      }
      if (sanitizedData.ipWhitelist !== undefined) {
        updates['privacySecurity.accountSecurity.ipWhitelist'] = sanitizedData.ipWhitelist;
      }
      if (sanitizedData.deviceTrust !== undefined) {
        updates['privacySecurity.accountSecurity.deviceTrust'] = sanitizedData.deviceTrust;
      }

      await UserInteractionModel.findOneAndUpdate(
        { userId: sanitizedData.userId },
        updates,
        { upsert: true, new: true }
      );

      await this.logSecurityEvent(sanitizedData.userId, 'security_settings_updated', {
        changes: Object.keys(updates).filter(key => key !== 'updatedAt'),
        timestamp: new Date()
      });

      await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(sanitizedData.userId));

      return {
        success: true,
        message: SUCCESS_MESSAGES.SECURITY_SETTINGS_UPDATED,
        data: { updated: Object.keys(updates) }
      };
    }, { retries: 3, minTimeout: 1000 });
  }

  async changePassword(data) {
    const { userId, currentPassword, newPassword } = data;
    await this.validateCurrentPassword(userId, currentPassword);
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.accountSecurity.passwordLastChanged': new Date()
        },
        $push: {
          'privacySecurity.accountSecurity.passwordHistory': {
            hash: hashedPassword,
            changedAt: new Date()
          }
        },
        updatedAt: new Date()
      }
    );

    await this.logSecurityEvent(userId, 'password_changed', { timestamp: new Date() });

    await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.PASSWORD_UPDATED
    };
  }

  async enable2FA(userId, method, phoneNumber = null) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.accountSecurity.twoFactorAuth').lean();
    if (settings.privacySecurity.accountSecurity.twoFactorAuth?.enabled) {
      throw new Error(ERROR_MESSAGES.TWO_FA_ALREADY_ENABLED);
    }

    if (method === 'authenticator') {
      const secret = speakeasy.generateSecret({
        name: 'Job Platform',
        account: userId,
        length: 32
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      const tokenKey = CACHE_KEYS.SECURITY_TOKENS(secret.base32);
      await redisClient.setex(tokenKey, 600, JSON.stringify({ userId, method }));

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

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const tokenKey = CACHE_KEYS.SECURITY_TOKENS(verificationCode);
    await redisClient.setex(tokenKey, CACHE_TTL.SECURITY_TOKENS, JSON.stringify({
      userId,
      action: 'enable_2fa',
      method,
      phoneNumber
    }));

    await this.sendVerificationCode(userId, method, verificationCode, phoneNumber);

    return {
      success: true,
      message: `Verification code sent via ${method}`,
      data: { method, masked: method === 'sms' ? this.maskPhoneNumber(phoneNumber) : null }
    };
  }

  async verify2FASetup(userId, token, secret = null) {
    const { error } = NOTIFICATION_VALIDATION_SCHEMAS.tokenVerification.validate({ userId, token, action: 'enable_2fa' });
    if (error) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`);
    }

    let verified = false;
    let method;

    if (secret) {
      verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });
      method = 'authenticator';
    } else {
      const tokenKey = CACHE_KEYS.SECURITY_TOKENS(token);
      const tokenData = await redisClient.get(tokenKey);
      if (tokenData) {
        const parsed = JSON.parse(tokenData);
        verified = parsed.userId === userId;
        method = parsed.method;
        await redisClient.del(tokenKey);
      }
    }

    if (!verified) {
      throw new Error(ERROR_MESSAGES.INVALID_2FA_TOKEN);
    }

    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.accountSecurity.twoFactorAuth': {
            enabled: true,
            method,
            secret: secret ? await this.encryptSecret(secret) : null,
            phoneNumber: method === 'sms' ? phoneNumber : null,
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
      method,
      timestamp: new Date()
    });

    await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA_ENABLED,
      data: {
        backupCodes,
        method
      }
    };
  }

  async disable2FA(userId, currentPassword) {
    await this.validateCurrentPassword(userId, currentPassword);

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.accountSecurity.twoFactorAuth.enabled': false,
          updatedAt: new Date()
        }
      }
    );

    await this.logSecurityEvent(userId, '2fa_disabled', {
      timestamp: new Date()
    });

    await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA_DISABLED
    };
  }

  async generateBackupCodes(userId, currentPassword) {
    await this.validateCurrentPassword(userId, currentPassword);

    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());

    const encryptedBackupCodes = await Promise.all(
      backupCodes.map(async code => ({
        code: await this.encryptSecret(code),
        used: false,
        usedAt: null
      }))
    );

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.accountSecurity.twoFactorAuth.backupCodes': encryptedBackupCodes,
          updatedAt: new Date()
        }
      }
    );

    await this.logSecurityEvent(userId, 'backup_codes_generated', { timestamp: new Date() });

    await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.BACKUP_CODES_GENERATED,
      data: { backupCodes }
    };
  }

  async getLoginActivity(userId, limit = 50, offset = 0) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.accountSecurity.securityEvents').lean();
    const activity = settings?.privacySecurity?.accountSecurity?.securityEvents?.filter(e => e.eventType === 'login') || [];

    const paginatedActivity = activity
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);

    return {
      success: true,
      message: SUCCESS_MESSAGES.LOGIN_ACTIVITY_RETRIEVED,
      data: {
        activity: paginatedActivity,
        total: activity.length
      }
    };
  }

  async getTrustedDevices(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.accountSecurity.trustedDevices').lean();
    const devices = settings?.privacySecurity?.accountSecurity?.trustedDevices || [];

    return {
      success: true,
      message: SUCCESS_MESSAGES.TRUSTED_DEVICES_RETRIEVED,
      data: devices
    };
  }

  async revokeTrustedDevice(userId, deviceId) {
    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $pull: { 'privacySecurity.accountSecurity.trustedDevices': { deviceId } },
        updatedAt: new Date()
      }
    );

    await this.logSecurityEvent(userId, 'trusted_device_revoked', { deviceId, timestamp: new Date() });

    await redisClient.del(CACHE_KEYS.SECURITY_SETTINGS(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.TRUSTED_DEVICE_REVOKED,
      data: { deviceId }
    };
  }

  async lockAccount(userId, reason, duration = 1800) { // Default 30 minutes
    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $push: {
          'privacySecurity.accountSecurity.accountLocks': {
            reason,
            lockedAt: new Date(),
            lockDuration: duration,
            unlockAt: new Date(Date.now() + duration * 1000),
            isActive: true
          }
        },
        updatedAt: new Date()
      }
    );

    await this.logSecurityEvent(userId, 'account_locked', { reason, duration, timestamp: new Date() });

    await redisClient.setex(CACHE_KEYS.ACCOUNT_LOCKS(userId), duration, 'locked');

    return {
      success: true,
      message: SUCCESS_MESSAGES.ACCOUNT_LOCKED,
      data: { reason, unlockAt: new Date(Date.now() + duration * 1000) }
    };
  }

  async unlockAccount(userId, currentPassword) {
    await this.validateCurrentPassword(userId, currentPassword);

    await UserInteractionModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          'privacySecurity.accountSecurity.accountLocks.$[elem].isActive': false
        },
        updatedAt: new Date()
      },
      { arrayFilters: [{ 'elem.isActive': true }] }
    );

    await this.logSecurityEvent(userId, 'account_unlocked', { timestamp: new Date() });

    await redisClient.del(CACHE_KEYS.ACCOUNT_LOCKS(userId));

    return {
      success: true,
      message: SUCCESS_MESSAGES.ACCOUNT_UNLOCKED
    };
  }

  async getSecurityAudit(userId) {
    const settings = await UserInteractionModel.findOne({ userId }).select('privacySecurity.accountSecurity').lean();
    const audit = {
      twoFAEnabled: settings.privacySecurity.accountSecurity.twoFactorAuth?.enabled,
      passwordLastChanged: settings.privacySecurity.accountSecurity.passwordLastChanged,
      activeLocks: settings.privacySecurity.accountSecurity.accountLocks.filter(l => l.isActive).length,
      trustedDevicesCount: settings.privacySecurity.accountSecurity.trustedDevices.length,
      recentEvents: settings.privacySecurity.accountSecurity.securityEvents.slice(-10)
    };

    return {
      success: true,
      message: SUCCESS_MESSAGES.SECURITY_AUDIT_RETRIEVED,
      data: audit
    };
  }

  async getDefaultVisibilitySettings() {
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

  async getDefaultDNDSettings() {
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
  }

  async getDefaultAlertFrequencySettings() {
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
  }

  async getDefaultEmailSettings() {
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
  }

  async processScheduledNotifications() {
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

  async updateAlertScheduler(userId, settings) {
    logger.info('Updating alert scheduler for user', userId);
  }

  async updateProfileSearchIndex(payload) {
    logger.info('Updating profile search index', payload);
  }

  async checkRateLimit(userId, feature, limit, windowSeconds) {
    const key = `ratelimit:${userId}:${feature}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, windowSeconds);
    if (count > limit) throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    return true;
  }
}