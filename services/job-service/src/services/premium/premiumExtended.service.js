import { consumer, publishJobEvent } from '../../config/kafka.js';
import { createCacheService } from './analytics.service.js';
import UserInteractionModel from '../../model/userInteraction.model.js';
import logger from '../../utils/logger.js';
import { CACHE_TTL, CACHE_KEYS } from '../../constants/cache.js';
import { sanitizeInput, generateSecureId } from '../../utils/security.js';
import JobApplication from '../../model/jobApplication.model.js';
import UserActivity from '../../model/userInteraction.model.js';
import JobAnalytics from '../../model/Insights.model.js';
import { schemas } from "../../validations/premium.validations.js";
import retry from 'async-retry';
import SearchModel from '../../model/search.model.js';

// Initialize Cache and Search Services
const cacheService = createCacheService('premium');

// UUID Validation Helper
const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validateUUID = (id, fieldName = 'ID') => {
  if (!id || !validUUIDRegex.test(id)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`);
  }
  return true;
};

// Date Helper for YYYY-MM-DD
const getFormattedDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Optimized Search Service
class OptimizedModelService {
  constructor(cacheService) {
    this.SearchModel = SearchModel;
    this.JobAnalytics = JobAnalytics;
    this.UserInteractionModel = UserInteractionModel;
    this.cacheService = cacheService;
  }

  async initializeUserPreferences(userId, defaultPreferences = {}) {
    if (!validUUIDRegex.test(userId)) throw new Error('Invalid userId');
    const existing = await this.SearchModel.findOne({ userId });
    if (existing) return existing;

    const preferences = new this.SearchModel({
      userId,
      ...defaultPreferences
    });
    
    return await preferences.save();
  }

  async getUserPreferences(userId) {
    if (!validUUIDRegex.test(userId)) throw new Error('Invalid userId');
    const cacheKey = `user_preferences:${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) return cached;

    let preferences = await this.SearchModel.findOne({ userId });
    if (!preferences) {
      preferences = await this.initializeUserPreferences(userId);
    }

    await this.cacheService.set(cacheKey, preferences, 3600);
    return preferences;
  }

  async updateTrendingScores(jobId, metrics) {
    if (!validUUIDRegex.test(jobId)) throw new Error('Invalid jobId');
    const trendingScore = this.calculateTrendingScore(metrics);
    
    await this.JobAnalytics.findOneAndUpdate(
      { jobId },
      {
        $set: {
          trendingScore,
          viewCount: metrics.viewCount,
          applicationCount: metrics.applicationCount,
          lastUpdated: new Date()
        },
        $push: {
          dailyViews: {
            date: new Date(),
            count: metrics.dailyViewIncrease || 0
          }
        }
      },
      { upsert: true }
    );

    await this.cacheService.del(`job_analytics:${jobId}`);
    return trendingScore;
  }

  async getUserNetwork(userId) {
    if (!validUUIDRegex.test(userId)) throw new Error('Invalid userId');
    const cacheKey = `user_network:${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) return cached;

    const network = await this.UserInteractionModel.findOne({ userId });
    if (network) {
      await this.cacheService.set(cacheKey, network, 1800);
    }

    return network || null;
  }

  async getNetworkCompanies(userId) {
    const network = await this.getUserNetwork(userId);
    if (!network) return [];

    const companyIds = [
      ...network.connections.map(c => c.companyId).filter(id => validUUIDRegex.test(id)),
      ...network.workHistory.map(w => w.companyId).filter(id => validUUIDRegex.test(id))
    ];

    return [...new Set(companyIds)];
  }

  async getUserAlumniSchools(userId) {
    const network = await this.getUserNetwork(userId);
    if (!network) return [];

    return network.education
      .filter(edu => validUUIDRegex.test(edu.schoolId))
      .map(edu => ({
        schoolId: edu.schoolId,
        schoolName: edu.schoolName,
        graduationYear: edu.graduationYear
      }));
  }

  calculateTrendingScore(metrics) {
    const {
      viewCount = 0,
      applicationCount = 0,
      saveCount = 0,
      shareCount = 0,
      timeDecay = Math.exp(-((Date.now() - metrics.createdAt) / (7 * 24 * 60 * 60 * 1000)))
    } = metrics;

    const viewScore = viewCount * 1;
    const applicationScore = applicationCount * 10;
    const saveScore = saveCount * 5;
    const shareScore = shareCount * 7;

    const rawScore = viewScore + applicationScore + saveScore + shareScore;
    const decayedScore = rawScore * timeDecay;

    return Math.min(100, Math.max(0, Math.floor(decayedScore / 10)));
  }

  async trackSearchWithAnalytics(userId, searchParams, results, searchType = 'simple') {
    if (!validUUIDRegex.test(userId)) throw new Error('Invalid userId');
    const searchEntry = {
      userId,
      query: searchParams.q,
      filters: searchParams,
      searchType,
      searchContext: searchParams.context,
      resultMetrics: {
        totalResults: results.total,
        clickedResults: 0,
        applicationsMade: 0,
        timeSpentOnResults: 0
      },
      timestamp: new Date()
    };

    // Placeholder: Save to SearchHistory (assumed existing model)
    // await SearchHistory.create(searchEntry);

    await this.updateUserSearchBehavior(userId, searchParams);
    return searchEntry;
  }

  async updateUserSearchBehavior(userId, searchParams) {
    if (!validUUIDRegex.test(userId)) throw new Error('Invalid userId');
    const hour = new Date().getHours();
    
    const updateData = {
      $addToSet: {
        'searchBehavior.preferredFilters': {
          $each: Object.keys(searchParams).filter(key => searchParams[key])
        },
        'searchBehavior.commonKeywords': searchParams.q?.split(' ').filter(Boolean) || []
      },
      $inc: {
        [`searchBehavior.searchPatterns.${hour}.frequency`]: 1
      },
      $set: {
        lastActiveAt: new Date()
      }
    };

    // Placeholder: Update UserActivity (assumed existing model)
    // await UserActivity.updateOne({ userId }, updateData, { upsert: true });
  }

  async logFeatureUsage(userId, feature, details = {}) {
    try {
      const usageKey = `feature_usage:${userId}:${feature}:${new Date().getMonth()}`;
      await this.cacheService.getClient().incr(usageKey);
      await this.cacheService.getClient().expire(usageKey, CACHE_TTL.FEATURE_USAGE || 30 * 86400);
      return { logged: true, timestamp: new Date(), feature, userId, details };
    } catch (err) {
      logger.error(`logFeatureUsage failed: ${err.message}`, { userId, feature });
      throw err;
    }
  }
}

const modelService = new OptimizedModelService(cacheService);

class PremiumExtendedService {
  async handleMessage(topic, message) {
    try {
      const task = JSON.parse(message.value.toString());
      const { type, payload, requestId } = task;
      let result;

      await retry(
        async () => {
          switch (type) {
            case 'reminder-scheduler':
              result = await this.processReminder(payload);
              break;
            case 'calendar-events':
              result = await this.processCalendarEvent(payload);
              break;
            case 'batch-application-queue':
              result = await this.processBatchApplication(payload);
              break;
            case 'data-export-queue':
              result = await this.processExportJob(payload);
              break;
            case 'realtime-notifications':
              result = await this.processNotification(payload);
              break;
            default:
              throw new Error(`Unknown task type: ${type}`);
          }
          await publishJobEvent('premium_results', { type, payload: result, requestId });
          logger.info(`Processed ${topic} message`, { service: 'premium-extended-service', requestId, type });
        },
        {
          retries: 3,
          minTimeout: 1000,
          onRetry: (error) => {
            logger.warn(`Retrying ${topic} message: ${error.message}`, { service: 'premium-extended-service', requestId, type });
          }
        }
      );

      return result;
    } catch (error) {
      logger.error(`Error processing ${topic} message: ${error.message}`, {
        service: 'premium-extended-service',
        requestId: message.requestId,
        type: message.type,
        stack: error.stack,
      });
      await publishJobEvent('dead_letter_queue', { topic, message, error: error.message });
      throw error;
    }
  }

  async processReminder(payload) {
    validateUUID(payload.id, 'reminderId');
    validateUUID(payload.userId, 'userId');
    validateUUID(payload.jobId, 'jobId');
    validateUUID(payload.applicationId, 'applicationId');
    const note = {
      id: payload.id,
      type: 'reminder',
      content: payload.message,
      reminderDate: payload.reminderDate,
      status: payload.status,
      createdAt: new Date()
    };
    await JobApplication.updateOne(
      { applicationId: payload.applicationId, userId: payload.userId },
      { $push: { notes: note }, $set: { updatedAt: new Date() } }
    );
    await modelService.logFeatureUsage(payload.userId, 'reminder', { reminderId: payload.id });
    return { success: true, reminderId: payload.id };
  }

  async processCalendarEvent(payload) {
    validateUUID(payload.id, 'eventId');
    validateUUID(payload.userId, 'userId');
    validateUUID(payload.jobId, 'jobId');
    validateUUID(payload.applicationId, 'applicationId');
    const note = {
      id: payload.id,
      type: 'interview',
      content: payload.details,
      status: payload.status,
      createdAt: new Date()
    };
    await JobApplication.updateOne(
      { applicationId: payload.applicationId, userId: payload.userId },
      { $push: { notes: note }, $set: { status: 'interviewed', updatedAt: new Date() } }
    );
    await UserActivity.create({
      userId: payload.userId,
      action: payload.status === 'scheduled' ? 'INTERVIEW_SCHEDULED' : 'INTERVIEW_CONFIRMED',
      entityType: 'interview',
      jobId: payload.jobId,
      details: { scheduleId: payload.id, interviewType: payload.interviewType || 'other' },
      createdAt: new Date()
    });
    return { success: true, eventId: payload.id };
  }

  async processBatchApplication(batch) {
    validateUUID(batch.userId, 'userId');
    batch.jobIds.forEach((id) => validateUUID(id, 'jobId'));
    const preferences = await modelService.getUserPreferences(batch.userId);
    const results = [];
    const currentDate = getFormattedDate();

    for (const jobId of batch.jobIds) {
      try {
        const application = await this.processIndividualApplication(
          jobId,
          batch.userId,
          preferences.quickApplySettings.templates?.[0]?.id,
          sanitizeInput(batch.customizations?.[jobId] || {})
        );
        results.push({ jobId, status: 'success', applicationId: application.applicationId });
        await JobAnalytics.incrementMetric(jobId, currentDate, 'metrics.applications', 1);
        await JobAnalytics.incrementMetric(jobId, currentDate, `sources.${application.source}`, 1);
        await modelService.updateTrendingScores(jobId, {
          applicationCount: 1,
          viewCount: 0,
          saveCount: 0,
          shareCount: 0,
          createdAt: new Date()
        });
      } catch (error) {
        results.push({ jobId, status: 'failed', error: error.message });
      }
    }
    return results;
  }

  async processExportJob(exportData) {
    validateUUID(exportData.exportId, 'exportId');
    validateUUID(exportData.userId, 'userId');
    return {
      success: true,
      exportId: exportData.exportId,
      fileUrl: `https://storage.example.com/exports/${exportData.exportId}`,
    };
  }

  async processNotification(payload) {
    validateUUID(payload.id, 'notificationId');
    validateUUID(payload.userId, 'userId');
    return { success: true, notificationId: payload.id };
  }

  async processIndividualApplication(jobId, userId, templateId, customization) {
    validateUUID(jobId, 'jobId');
    validateUUID(userId, 'userId');
    if (templateId) validateUUID(templateId, 'templateId');

    const preferences = await modelService.getUserPreferences(userId);
    const applicationId = generateSecureId();
    const application = {
      applicationId,
      jobId,
      userId,
      companyId: customization.companyId,
      status: 'submitted',
      appliedAt: new Date(),
      resumeVersion: preferences.quickApplySettings.resumeId,
      coverLetter: customization.coverLetter,
      source: preferences.quickApplySettings.source || 'direct',
      metadata: customization.metadata || {},
      notes: [],
      attachments: [],
      offerDetails: null
    };
    await JobApplication.create(application);
    await UserActivity.create({
      userId,
      action: 'apply_job',
      entityType: 'job',
      jobId,
      details: { applicationStatus: 'submitted' },
      createdAt: new Date()
    });
    await modelService.logFeatureUsage(userId, 'application', { applicationId });
    return application;
  }

  async createFollowUpReminder(data) {
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.followUpReminder.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.jobId, 'jobId');
    validateUUID(value.applicationId, 'applicationId');
    await this.checkRateLimit(value.userId, 'followUpReminder', 20, 3600);

    return await retry(
      async () => {
        const reminderId = generateSecureId();
        const reminder = {
          id: reminderId,
          type: 'reminder',
          content: value.message,
          reminderDate: value.reminderDate,
          status: 'pending',
          createdAt: new Date()
        };

        const cacheKey = `${CACHE_KEYS.FOLLOW_UPS(value.userId)}:${reminderId}`;
        await cacheService.set(cacheKey, reminder, CACHE_TTL.FOLLOW_UPS);
        await JobApplication.updateOne(
          { applicationId: value.applicationId, userId: value.userId },
          { $push: { notes: reminder }, $set: { updatedAt: new Date() } }
        );
        await publishJobEvent('reminder-scheduler', { ...reminder, userId: value.userId, jobId: value.jobId, applicationId: value.applicationId });
        await modelService.logFeatureUsage(value.userId, 'followUpReminder', { reminderId });

        return { success: true, reminderId, reminder };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async getFollowUpReminders(userId, status = null) {
    validateUUID(userId, 'userId');
    const cacheKey = CACHE_KEYS.FOLLOW_UPS(userId);
    const pattern = `${cacheKey}:*`;
    const keys = await cacheService.getClient().keys(pattern);
    const reminders = [];

    if (keys.length > 0) {
      const cached = await cacheService.getClient().mget(keys);
      cached.forEach((data) => {
        if (data) {
          const reminder = JSON.parse(data);
          if (reminder.type === 'reminder' && (!status || reminder.status === status)) {
            reminders.push(reminder);
          }
        }
      });
    } else {
      const applications = await JobApplication.find({ userId }).lean();
      const dbReminders = applications.flatMap(app => (app.notes || []).filter(note => note.type === 'reminder' && (!status || note.status === status)));
      const setPromises = dbReminders.map((reminder) =>
        cacheService.set(`${cacheKey}:${reminder.id}`, reminder, CACHE_TTL.FOLLOW_UPS)
      );
      await Promise.all(setPromises);
      reminders.push(...dbReminders);
    }

    return reminders.sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));
  }

  async createInterview(data) {
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.interview.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.jobId, 'jobId');
    validateUUID(value.applicationId, 'applicationId');

    return await retry(
      async () => {
        const interviewId = generateSecureId();
        const interview = {
          id: interviewId,
          type: 'interview',
          content: value.details,
          status: value.status || 'scheduled',
          tags: ['interview'],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const cacheKey = `${CACHE_KEYS.INTERVIEWS(value.userId)}:${interviewId}`;
        await cacheService.set(cacheKey, interview, CACHE_TTL.INTERVIEWS);
        await JobApplication.updateOne(
          { applicationId: value.applicationId, userId: value.userId },
          { $push: { notes: interview }, $set: { status: 'interviewed', updatedAt: new Date() } }
        );
        await UserActivity.create({
          userId: value.userId,
          action: value.status === 'scheduled' ? 'INTERVIEW_SCHEDULED' : 'INTERVIEW_CONFIRMED',
          entityType: 'interview',
          jobId: value.jobId,
          details: { scheduleId: interviewId, interviewType: value.interviewType || 'other' },
          createdAt: new Date()
        });
        await publishJobEvent('calendar-events', { id: interviewId, userId: value.userId, jobId: value.jobId, applicationId: value.applicationId, details: value.details, status: value.status });
        await modelService.logFeatureUsage(value.userId, 'interview', { interviewId });

        return { success: true, interviewId, interview };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async updateInterviewStatus(interviewId, userId, status, notes = '') {
    validateUUID(interviewId, 'interviewId');
    validateUUID(userId, 'userId');
    if (!['scheduled', 'completed', 'cancelled', 'rescheduled'].includes(status)) {
      throw new Error('Invalid status');
    }

    const cacheKey = `${CACHE_KEYS.INTERVIEWS(userId)}:${interviewId}`;
    const interviewData = await cacheService.get(cacheKey);
    let interview;

    if (interviewData) {
      interview = JSON.parse(interviewData);
    } else {
      const application = await JobApplication.findOne({ userId, 'notes.id': interviewId }, { 'notes.$': 1 }).lean();
      if (!application || !application.notes[0]) throw new Error('Interview not found');
      interview = application.notes[0];
      await cacheService.set(cacheKey, interview, CACHE_TTL.INTERVIEWS);
    }

    interview.status = status;
    interview.content = sanitizeInput(notes) || interview.content;
    interview.updatedAt = new Date();

    await cacheService.set(cacheKey, interview, CACHE_TTL.INTERVIEWS);
    await JobApplication.updateOne(
      { userId, 'notes.id': interviewId },
      { $set: { 'notes.$.status': status, 'notes.$.content': interview.content, 'notes.$.updatedAt': new Date(), updatedAt: new Date() } }
    );
    await UserActivity.create({
      userId,
      action: status === 'completed' ? 'INTERVIEW_CONFIRMED' : `INTERVIEW_${status.toUpperCase()}`,
      entityType: 'interview',
      details: { scheduleId: interviewId },
      createdAt: new Date()
    });

    if (status === 'completed') {
      await this.scheduleThankYouReminder(userId, interviewId);
    }

    return { success: true, interview };
  }

  async createOffer(data) {
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.offer.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.jobId, 'jobId');
    validateUUID(value.applicationId, 'applicationId');

    return await retry(
      async () => {
        const offerId = generateSecureId();
        const offer = {
          id: offerId,
          salary: value.salary,
          equity: value.equity,
          benefits: value.benefits,
          companyName: value.companyName,
          competitiveScore: await this.calculateOfferScore(value),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await JobApplication.updateOne(
          { applicationId: value.applicationId, userId: value.userId },
          { $set: { offerDetails: offer, status: 'hired', updatedAt: new Date() } }
        );
        await cacheService.set(`offer:${value.userId}:${offerId}`, offer, CACHE_TTL.OFFERS);
        await JobAnalytics.updateMetrics(value.jobId, {
          offerCount: 1,
          averageSalary: value.salary,
          averageEquity: value.equity
        });
        await modelService.logFeatureUsage(value.userId, 'offer', { offerId });

        return { success: true, offerId, offer };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async compareOffers(userId, offerIds) {
    validateUUID(userId, 'userId');
    offerIds.forEach((id) => validateUUID(id, 'offerId'));
    const cacheKeys = offerIds.map((id) => `offer:${userId}:${id}`);
    const cached = await cacheService.getClient().mget(cacheKeys);
    const offers = [];

    const missingIds = offerIds.filter((id, i) => !cached[i]);
    if (missingIds.length > 0) {
      const dbApplications = await JobApplication.find(
        { userId, 'offerDetails.id': { $in: missingIds } },
        { offerDetails: 1 }
      ).lean();
      const dbOffers = dbApplications.map(app => app.offerDetails).filter(Boolean);
      const setPromises = dbOffers.map((offer) =>
        cacheService.set(`offer:${userId}:${offer.id}`, offer, CACHE_TTL.OFFERS)
      );
      await Promise.all(setPromises);
      offers.push(...dbOffers);
    }
    offers.push(...cached.filter(Boolean).map(JSON.parse));

    return {
      offers: offers.map((offer) => ({
        ...offer,
        totalCompensation: this.calculateTotalComp(offer),
        benefits: offer.benefits || [],
      })),
      recommendations: this.generateOfferRecommendations(offers),
    };
  }

  async createApplicationNote(data) {
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.applicationNotes.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.applicationId, 'applicationId');

    const noteId = generateSecureId();
    const note = {
      id: noteId,
      type: 'note',
      content: value.content,
      tags: value.tags,
      isPrivate: value.isPrivate,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const cacheKey = `${CACHE_KEYS.NOTES(value.applicationId)}:${noteId}`;
    await cacheService.set(cacheKey, note, CACHE_TTL.NOTES);
    await JobApplication.updateOne(
      { applicationId: value.applicationId, userId: value.userId },
      { $push: { notes: note }, $set: { updatedAt: new Date() } }
    );
    await modelService.logFeatureUsage(value.userId, 'applicationNote', { noteId });

    return { success: true, noteId, note };
  }

  async getApplicationNotes(applicationId, userId) {
    validateUUID(applicationId, 'applicationId');
    validateUUID(userId, 'userId');

    const pattern = `${CACHE_KEYS.NOTES(applicationId)}:*`;
    const keys = await cacheService.getClient().keys(pattern);
    const notes = [];

    if (keys.length > 0) {
      const cached = await cacheService.getClient().mget(keys);
      cached.forEach((data) => {
        if (data) {
          const note = JSON.parse(data);
          if (note.userId === userId && note.type === 'note') notes.push(note);
        }
      });
    } else {
      const application = await JobApplication.findOne({ applicationId, userId }).lean();
      if (!application) throw new Error('Application not found');
      notes.push(...(application.notes || []).filter(note => note.type === 'note'));
      const setPromises = notes.map((note) =>
        cacheService.set(`${CACHE_KEYS.NOTES(applicationId)}:${note.id}`, note, CACHE_TTL.NOTES)
      );
      await Promise.all(setPromises);
    }

    return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createBatchApplication(data) {
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.batchApplication.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    value.jobIds.forEach((id) => validateUUID(id, 'jobId'));

    if (!(await this.checkFeatureLimit(value.userId, 'batchApplications'))) {
      throw new Error('Monthly batch application limit exceeded');
    }

    const preferences = await modelService.getUserPreferences(value.userId);
    if (preferences.quickApplySettings?.enabled && value.jobIds.length > preferences.quickApplySettings.maxApplicationsPerDay) {
      throw new Error('Batch size exceeds daily quick apply limit');
    }

    const networkCompanies = await modelService.getNetworkCompanies(value.userId);
    const networkJobs = await Promise.all(value.jobIds.map(async (jobId) => {
      const job = await Job.findOne({ id: jobId }).lean();
      return job && networkCompanies.includes(job.companyId) ? jobId : null;
    })).then(results => results.filter(Boolean));

    const batchId = generateSecureId();
    const batch = {
      id: batchId,
      userId: value.userId,
      jobIds: value.jobIds,
      templateId: value.templateId || preferences.quickApplySettings.templates?.[0]?.id,
      status: 'processing',
      createdAt: new Date(),
      networkJobs
    };

    await publishJobEvent('batch-application-queue', batch);
    await modelService.logFeatureUsage(value.userId, 'batchApplication', { batchId });
    return { success: true, batchId, estimatedTime: value.jobIds.length * 30 };
  }

  async updateQuickApplySettings(userId, settings) {
    const sanitizedSettings = sanitizeInput(settings);
    const { error, value } = schemas.quickApplySettings.validate(sanitizedSettings);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(userId, 'userId');
    await this.checkRateLimit(userId, 'quickApplySettings', 5, 3600);

    return await retry(
      async () => {
        const preferences = await modelService.getUserPreferences(userId);
        preferences.quickApplySettings = {
          ...preferences.quickApplySettings,
          ...value,
          templates: value.templates || preferences.quickApplySettings.templates || []
        };
        preferences.updatedAt = new Date();

        const cacheKey = `user_preferences:${userId}`;
        await cacheService.set(cacheKey, preferences, CACHE_TTL.QUICK_APPLY);
        await Search.updateOne(
          { userId },
          { $set: { quickApplySettings: preferences.quickApplySettings, updatedAt: new Date() } },
          { upsert: true }
        );
        await modelService.logFeatureUsage(userId, 'quickApplySettings', { settings });

        return { success: true, settings: preferences.quickApplySettings };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async calculateApplicationScore(applicationId, userId) {
    validateUUID(applicationId, 'applicationId');
    validateUUID(userId, 'userId');

    const cacheKey = CACHE_KEYS.SCORING(applicationId);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const score = await this.computeApplicationScore(applicationId, userId);
    await cacheService.set(cacheKey, score, CACHE_TTL.SCORING);
    return score;
  }

  async exportApplicationData(userId, format = 'json', filters = {}) {
    validateUUID(userId, 'userId');
    if (!['json', 'csv', 'excel'].includes(format)) {
      throw new Error('Invalid export format');
    }

    await this.checkRateLimit(userId, 'dataExport', 5, 3600);
    const exportId = generateSecureId();
    await publishJobEvent('data-export-queue', { exportId, userId, format, filters });
    await modelService.logFeatureUsage(userId, 'dataExport', { exportId });

    return { success: true, exportId, message: 'Export queued', estimatedTime: '5-10 minutes' };
  }

  async createThankYouNote(interviewId, userId, message) {
    validateUUID(interviewId, 'interviewId');
    validateUUID(userId, 'userId');

    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage || sanitizedMessage.length > 2000) {
      throw new Error('Invalid message length');
    }

    const noteId = generateSecureId();
    const thankYouNote = {
      id: noteId,
      type: 'thankYou',
      content: sanitizedMessage,
      interviewId,
      createdAt: new Date(),
      status: 'draft'
    };

    const cacheKey = `thankyou:${interviewId}:${noteId}`;
    await cacheService.set(cacheKey, thankYouNote, CACHE_TTL.THANK_YOU);
    await JobApplication.updateOne(
      { userId, 'notes.id': interviewId },
      { $push: { notes: thankYouNote }, $set: { updatedAt: new Date() } }
    );
    await modelService.logFeatureUsage(userId, 'thankYouNote', { noteId });

    return { success: true, noteId, thankYouNote };
  }

  async saveVideoIntroduction(data, fileBuffer) {
    if (!fileBuffer) throw new Error('Video file required');
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.videoIntro.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.applicationId, 'applicationId');

    return await retry(
      async () => {
        const videoId = generateSecureId();
        const video = {
          id: videoId,
          type: 'video',
          fileUrl: await this.uploadVideoFile(videoId, fileBuffer),
          tags: value.tags,
          createdAt: new Date()
        };

        const cacheKey = `${CACHE_KEYS.VIDEO(value.userId)}:${videoId}`;
        await cacheService.set(cacheKey, video, CACHE_TTL.VIDEO);
        await JobApplication.updateOne(
          { applicationId: value.applicationId, userId: value.userId },
          { $push: { attachments: video }, $set: { updatedAt: new Date() } }
        );
        await modelService.logFeatureUsage(value.userId, 'videoIntroduction', { videoId });

        return { success: true, videoId, video };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async savePortfolioAttachment(data, fileBuffer) {
    if (!fileBuffer) throw new Error('Portfolio file required');
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.portfolio.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.applicationId, 'applicationId');

    return await retry(
      async () => {
        const portfolioId = generateSecureId();
        const portfolio = {
          id: portfolioId,
          type: 'portfolio',
          fileUrl: await this.uploadPortfolioFile(portfolioId, fileBuffer),
          categories: value.categories,
          createdAt: new Date()
        };

        const cacheKey = `${CACHE_KEYS.PORTFOLIO(value.userId)}:${portfolioId}`;
        await cacheService.set(cacheKey, portfolio, CACHE_TTL.PORTFOLIO);
        await JobApplication.updateOne(
          { applicationId: value.applicationId, userId: value.userId },
          { $push: { attachments: portfolio }, $set: { updatedAt: new Date() } }
        );
        await modelService.logFeatureUsage(value.userId, 'portfolio', { portfolioId });

        return { success: true, portfolioId, portfolio };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async createReference(data) {
    const sanitizedData = sanitizeInput(data);
    const { error, value } = schemas.reference.validate(sanitizedData);
    if (error) throw new Error(`Validation error: ${error.details[0].message}`);

    validateUUID(value.userId, 'userId');
    validateUUID(value.companyId, 'companyId');

    return await retry(
      async () => {
        const referenceId = generateSecureId();
        const reference = {
          connectionId: referenceId,
          connectionType: 'referral',
          name: value.name,
          email: value.email,
          company: value.company,
          companyId: value.companyId,
          position: value.position,
          canRefer: true,
          isActive: true,
          connectedAt: new Date()
        };

        const cacheKey = `user_network:${value.userId}`;
        await cacheService.del(cacheKey);
        await UserInteractionModel.updateOne(
          { userId: value.userId },
          { $push: { connections: reference }, $set: { updatedAt: new Date() } },
          { upsert: true }
        );
        await modelService.logFeatureUsage(value.userId, 'reference', { referenceId });

        return { success: true, referenceId, reference };
      },
      { retries: 3, minTimeout: 1000 }
    );
  }

  async checkRateLimit(userId, feature, limit, windowSeconds) {
    validateUUID(userId, 'userId');
    const key = `ratelimit:${userId}:${feature}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await cacheService.getClient().incr(key);
    if (count === 1) await cacheService.getClient().expire(key, windowSeconds);
    if (count > limit) throw new Error(`Rate limit exceeded for ${feature}`);
    return true;
  }

  async checkFeatureLimit(userId, feature) {
    validateUUID(userId, 'userId');
    const limits = { batchApplications: 10, quickApplySettings: 5 };
    const usageKey = `feature:${userId}:${feature}:${new Date().getMonth()}`;
    const count = await cacheService.getClient().incr(usageKey);
    if (count === 1) await cacheService.getClient().expire(usageKey, 86400 * 31);
    if (count > limits[feature]) throw new Error(`Monthly limit exceeded for ${feature}`);
    return true;
  }

  async calculateOfferScore(offer) {
    const baseScore = (offer.salary || 0) / 100000 + (offer.equity || 0) * 10;
    return Math.min(100, Math.max(0, Math.floor(baseScore)));
  }

  async calculateTotalComp(offer) {
    return (offer.salary || 0) + (offer.equity || 0) * 1000;
  }

  async generateOfferRecommendations(offers) {
    return offers.map((offer) => `Review ${offer.companyName} offer for salary negotiation`);
  }

  async computeApplicationScore(applicationId, userId) {
    validateUUID(applicationId, 'applicationId');
    validateUUID(userId, 'userId');

    const application = await JobApplication.findOne({ applicationId, userId }).lean();
    if (!application) throw new Error('Application not found');

    const preferences = await modelService.getUserPreferences(userId);
    const score = {
      score: 85,
      factors: {
        skillMatch: preferences.searchFilters.skills.some(s => application.skills?.includes(s)) ? 90 : 70,
        experienceMatch: preferences.searchFilters.experienceLevel.includes(application.experienceLevel) ? 85 : 65,
        locationPreference: preferences.searchFilters.locations.includes(application.location) ? 80 : 60,
        salaryAlignment: preferences.searchFilters.salaryRange.min <= (application.salary || 0) ? 85 : 65,
      },
      recommendations: ['Highlight project management experience', 'Emphasize technical skills']
    };
    return score;
  }

  async scheduleThankYouReminder(userId, interviewId) {
    validateUUID(userId, 'userId');
    validateUUID(interviewId, 'interviewId');

    const reminderId = generateSecureId();
    const reminder = {
      id: reminderId,
      type: 'reminder',
      content: 'Send thank you note for interview',
      reminderDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending',
      createdAt: new Date()
    };

    await cacheService.set(`${CACHE_KEYS.FOLLOW_UPS(userId)}:${reminderId}`, reminder, CACHE_TTL.FOLLOW_UPS);
    await JobApplication.updateOne(
      { userId, 'notes.id': interviewId },
      { $push: { notes: reminder }, $set: { updatedAt: new Date() } }
    );
    await publishJobEvent('reminder-scheduler', { ...reminder, userId, jobId: interviewId });
    await modelService.logFeatureUsage(userId, 'thankYouReminder', { reminderId });
  }

  async uploadVideoFile(videoId, fileBuffer) {
    validateUUID(videoId, 'videoId');
    return `https://storage.example.com/videos/${videoId}`;
  }

  async uploadPortfolioFile(portfolioId, fileBuffer) {
    validateUUID(portfolioId, 'portfolioId');
    return `https://storage.example.com/portfolios/${portfolioId}`;
  }
}

export const premiumExtendedService = new PremiumExtendedService();