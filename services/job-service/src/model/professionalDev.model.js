import mongoose from 'mongoose';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import logger from '../utils/logger.js';
import redisClient from '../config/redis.js';
import { SearchEventService } from '../services/search.services.js';
import { cacheHits } from '../utils/metrics.js';

const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// TTL configurations
const TTL_CONFIG = {
  PROFESSIONAL_DEV: 2 * 365 * 24 * 60 * 60, // 2 years in seconds
  DATA_EXPORT: 30 * 24 * 60 * 60, // 30 days for export files
};

const professionalDevSchema = new mongoose.Schema(
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
    skillsAnalysis: {
      currentSkills: [{ skillId: { type: String, validate: validUUIDRegex }, proficiencyLevel: Number }],
      targetRole: String,
      targetIndustry: String,
      skillGaps: [{
        skillId: { type: String, validate: validUUIDRegex },
        skillName: String,
        requiredLevel: Number,
        currentLevel: Number,
        priority: String,
        estimatedLearningTime: Number,
      }],
      recommendations: [{
        skillId: { type: String, validate: validUUIDRegex },
        skillName: String,
        recommendation: String,
        resources: [String],
        estimatedTime: Number,
      }],
      analysisScore: Number,
      lastAnalyzedAt: Date,
      estimatedLearningTime: Number,
    },
    certifications: [{
      certificationId: { type: String, default: uuidv4, validate: validUUIDRegex },
      name: String,
      issuer: String,
      issueDate: Date,
      credentialUrl: String,
      addedAt: { type: Date, default: Date.now },
    }],
    linkedinLearning: {
      connected: Boolean,
      accessToken: String,
      lastSyncAt: Date,
      courses: [{
        courseId: { type: String, validate: validUUIDRegex },
        title: String,
        provider: String,
        status: String,
        progress: Number,
        completedAt: Date,
        skillsLearned: [String],
        timeSpent: Number,
      }],
      learningPaths: [String],
      syncPreferences: Object,
    },
    careerPath: {
      currentRole: String,
      experienceLevel: String,
      suggestedPaths: [{
        targetRole: String,
        targetLevel: String,
        estimatedTime: String,
        requiredSkills: [String],
        salaryRange: { min: Number, max: Number, currency: String },
        pathScore: Number,
      }],
      lastUpdatedAt: Date,
    },
    assessments: [{
      assessmentId: { type: String, default: uuidv4, validate: validUUIDRegex },
      skillId: { type: String, validate: validUUIDRegex },
      difficulty: String,
      assessmentType: String,
      timeLimit: Number,
      questions: [{
        questionId: { type: String, validate: validUUIDRegex },
        question: String,
        options: [String],
        correctAnswer: String,
        explanation: String,
        timeSpent: Number,
      }],
      answers: [{ questionId: { type: String, validate: validUUIDRegex }, answer: String, timeSpent: Number }],
      results: {
        score: Number,
        percentile: Number,
        correctAnswers: Number,
        totalQuestions: Number,
        strengths: [String],
        weaknesses: [String],
        recommendations: [String],
      },
      status: String,
      startedAt: Date,
      completedAt: Date,
      timeTaken: Number,
      expiresAt: { type: Date, default: () => new Date(Date.now() + TTL_CONFIG.PROFESSIONAL_DEV * 1000) },
    }],
    mockInterviews: [{
      sessionId: { type: String, default: uuidv4, validate: validUUIDRegex },
      jobRole: String,
      interviewType: String,
      experienceLevel: String,
      scheduledAt: Date,
      duration: Number,
      questions: [{
        questionId: { type: String, validate: validUUIDRegex },
        question: String,
        category: String,
        difficulty: String,
        answer: String,
        timeSpent: Number,
        feedback: Object,
      }],
      status: String,
      completedAt: Date,
      overallFeedback: {
        communicationScore: Number,
        technicalScore: Number,
        confidenceScore: Number,
        overallRating: Number,
        strengths: [String],
        areasForImprovement: [String],
        nextSteps: [String],
      },
    }],
    practiceStats: {
      totalAssessments: Number,
      completedAssessments: Number,
      averageScore: Number,
      totalInterviews: Number,
      averageInterviewRating: Number,
      streak: { lastPracticeDate: Date, currentStreak: Number },
    },
    resumeReviews: [{
      reviewId: { type: String, default: uuidv4, validate: validUUIDRegex },
      resumeUrl: String,
      targetRole: String,
      urgency: String,
      status: String,
      submittedAt: Date,
      reviewerId: { type: String, validate: validUUIDRegex },
      feedback: {
        overallRating: Number,
        sections: [{ section: String, rating: Number, comments: String, suggestions: [String] }],
        atsCompatibility: { score: Number, issues: [String], recommendations: [String] },
        improvements: [{ category: String, priority: String, suggestion: String, example: String }],
        finalNotes: String,
      },
      completedAt: Date,
    }],
    coachingSessions: [{
      sessionId: { type: String, default: uuidv4, validate: validUUIDRegex },
      coachId: { type: String, validate: validUUIDRegex },
      sessionMode: String,
      scheduledAt: Date,
      duration: Number,
      goals: [String],
      status: String,
      actionItems: [{ itemId: { type: String, validate: validUUIDRegex }, description: String, dueDate: Date, status: String }],
      feedback: {
        rating: Number,
        comments: String,
        areasCovered: [String],
        outcomes: [String],
      },
    }],
    coachingPlan: {
      planId: { type: String, default: uuidv4, validate: validUUIDRegex },
      goals: [String],
      timeline: String,
      milestones: [{ milestone: String, targetDate: Date, status: String, achievedAt: Date, notes: String }],
      progress: Number,
      createdAt: Date,
      lastUpdatedAt: Date,
    },
    assignedCoach: {
      coachId: { type: String, validate: validUUIDRegex },
      name: String,
      specializations: [String],
      industries: [String],
      experience: String,
      rating: Number,
    },
    dataManagement: {
      dataExports: [{
        exportId: { type: String, default: uuidv4, validate: validUUIDRegex },
        exportType: { type: String, enum: ['full', 'profile', 'applications', 'search_history', 'preferences', 'analytics'], default: 'full' },
        format: { type: String, enum: ['json', 'csv', 'xml', 'pdf'], default: 'json' },
        status: { type: String, enum: ['requested', 'processing', 'completed', 'failed', 'expired'], default: 'requested' },
        dateRange: { startDate: Date, endDate: Date },
        includeDeleted: { type: Boolean, default: false },
        anonymize: { type: Boolean, default: false },
        compressionEnabled: { type: Boolean, default: true },
        deliveryMethod: { type: String, enum: ['download', 'email', 'secure_link'], default: 'download' },
        fileDetails: {
          fileName: String,
          fileSize: Number,
          downloadUrl: String,
          expiresAt: { type: Date, default: () => new Date(Date.now() + TTL_CONFIG.DATA_EXPORT * 1000) },
          downloadCount: { type: Number, default: 0 },
          maxDownloads: { type: Number, default: 5 },
        },
        processingDetails: {
          startedAt: Date,
          completedAt: Date,
          processingTime: Number,
          recordsExported: Number,
          errorMessage: String,
        },
        requestedAt: { type: Date, default: Date.now },
        gdprCompliant: { type: Boolean, default: true },
      }],
      retentionSettings: {
        autoDeleteInactiveData: { type: Boolean, default: false },
        inactivityThreshold: { type: Number, default: 365 },
        dataCategories: {
          searchHistory: { retain: Boolean, retentionDays: Number },
          applicationHistory: { retain: Boolean, retentionDays: Number },
          viewHistory: { retain: Boolean, retentionDays: Number },
          analyticsData: { retain: Boolean, retentionDays: Number },
        },
      },
      gdprCompliance: {
        consentGiven: { type: Boolean, default: false },
        consentDate: Date,
        consentVersion: String,
        dataProcessingPurposes: [String],
        rightToErasureRequests: [{
          requestId: { type: String, default: uuidv4, validate: validUUIDRegex },
          requestedAt: Date,
          status: { type: String, enum: ['pending', 'approved', 'completed', 'rejected'] },
          completedAt: Date,
          dataCategories: [String],
        }],
        dataPortabilityRequests: [{
          requestId: { type: String, default: uuidv4, validate: validUUIDRegex },
          requestedAt: Date,
          status: String,
          exportId: { type: String, validate: validUUIDRegex },
          completedAt: Date,
        }],
        lastDataAudit: Date,
      },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: { updatedAt: 'updatedAt' },
    versionKey: false,
    collection: 'professional_dev',
    shardKey: { userId: 1 },
  }
);

// Optimized Indexes for 10M+ Users
professionalDevSchema.index({ userId: 1, 'assessments.startedAt': -1 });
professionalDevSchema.index({ 'certifications.certificationId': 1 });
professionalDevSchema.index({ 'assessments.assessmentId': 1 });
professionalDevSchema.index({ 'mockInterviews.sessionId': 1 });
professionalDevSchema.index({ 'resumeReviews.reviewId': 1 });
professionalDevSchema.index({ 'coachingSessions.sessionId': 1 });
professionalDevSchema.index({ 'skillsAnalysis.lastAnalyzedAt': 1 });
professionalDevSchema.index({ 'dataManagement.dataExports.exportId': 1 });
professionalDevSchema.index({ 'dataManagement.dataExports.status': 1 });
professionalDevSchema.index({ 'dataManagement.dataExports.requestedAt': -1 });
professionalDevSchema.index({ 'dataManagement.rightToErasureRequests.requestId': 1 });
professionalDevSchema.index({ 'dataManagement.dataPortabilityRequests.requestId': 1 });
professionalDevSchema.index({ isDeleted: 1 });
professionalDevSchema.index({ 'assessments.expiresAt': 1 }, { expireAfterSeconds: 0 });
professionalDevSchema.index({ 'dataManagement.dataExports.fileDetails.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Pre-save Middleware
professionalDevSchema.pre('save', async function (next) {
  try {
    this.updatedAt = new Date();
    if (this.isNew || this.isModified()) {
      await SearchEventService.emit('analytics:professional_dev_updated', {
        userId: this.userId,
        assessmentIds: this.assessments.map(a => a.assessmentId),
        sessionIds: this.mockInterviews.map(m => m.sessionId),
        reviewIds: this.resumeReviews.map(r => r.reviewId),
        coachingSessionIds: this.coachingSessions.map(c => c.sessionId),
        exportIds: this.dataManagement.dataExports.map(e => e.exportId),
        erasureRequestIds: this.dataManagement.gdprCompliance.rightToErasureRequests.map(r => r.requestId),
        portabilityRequestIds: this.dataManagement.gdprCompliance.dataPortabilityRequests.map(r => r.requestId),
      });
    }
    next();
  } catch (error) {
    logger.error('ProfessionalDev pre-save error:', error);
    next(error);
  }
});

// Static Methods
professionalDevSchema.statics.findUserDevelopment = async function (userId, pagination = {}) {
  const { page = 1, limit = 20 } = pagination;
  return this.findOne({ userId, isDeleted: false })
    .select('skillsAnalysis certifications linkedinLearning careerPath assessments mockInterviews practiceStats resumeReviews coachingSessions coachingPlan assignedCoach dataManagement')
    .slice('assessments', [(page - 1) * limit, limit])
    .slice('mockInterviews', [(page - 1) * limit, limit])
    .slice('resumeReviews', [(page - 1) * limit, limit])
    .slice('coachingSessions', [(page - 1) * limit, limit])
    .slice('dataManagement.dataExports', [(page - 1) * limit, limit])
    .slice('dataManagement.gdprCompliance.rightToErasureRequests', [(page - 1) * limit, limit])
    .slice('dataManagement.gdprCompliance.dataPortabilityRequests', [(page - 1) * limit, limit])
    .lean();
};

professionalDevSchema.statics.updatePracticeStats = async function (userId, stats) {
  const update = {
    $set: {
      'practiceStats.totalAssessments': stats.totalAssessments || 0,
      'practiceStats.completedAssessments': stats.completedAssessments || 0,
      'practiceStats.averageScore': stats.averageScore || 0,
      'practiceStats.totalInterviews': stats.totalInterviews || 0,
      'practiceStats.averageInterviewRating': stats.averageInterviewRating || 0,
      'practiceStats.streak': stats.streak || { lastPracticeDate: null, currentStreak: 0 },
      updatedAt: new Date(),
    },
  };
  return this.updateOne({ userId }, update, { upsert: true });
};

professionalDevSchema.statics.getRecentAssessments = async function (userId, limit = 10) {
  return this.findOne({ userId, isDeleted: false })
    .select('assessments')
    .slice('assessments', limit)
    .sort({ 'assessments.startedAt': -1 })
    .lean();
};

professionalDevSchema.statics.getDataExports = async function (userId, status = 'completed', limit = 10) {
  return this.findOne({ userId, isDeleted: false })
    .select('dataManagement.dataExports')
    .slice('dataManagement.dataExports', limit)
    .where('dataManagement.dataExports.status').equals(status)
    .sort({ 'dataManagement.dataExports.requestedAt': -1 })
    .lean();
};

professionalDevSchema.statics.getGDPRRequests = async function (userId, type = 'erasure', limit = 10) {
  const field = type === 'erasure' ? 'dataManagement.gdprCompliance.rightToErasureRequests' : 'dataManagement.gdprCompliance.dataPortabilityRequests';
  return this.findOne({ userId, isDeleted: false })
    .select(field)
    .slice(field, limit)
    .sort({ [`${field}.requestedAt`]: -1 })
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

const ProfessionalDevModel = mongoose.model('ProfessionalDev', professionalDevSchema);

export { CacheManager };
export default ProfessionalDevModel;