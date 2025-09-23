import { redisClient } from '../config/redis.js';
import { publishJobEvent } from '../config/kafka.js';
import logger from '../../utils/logger.js';
import { sanitizeInput, generateSecureId, encryptData, decryptData } from '../../utils/security.js';
import retry from 'async-retry';
import mongoose from 'mongoose';
import ProfessionalDevModel from '../../model/professionalDev.model.js';
import InsightsModel from '../../model/Insights.model.js';
import { VALIDATION_SCHEMAS } from '../../validations/premium.validations.js';
import { CACHE_KEYS, CACHE_TTL } from '../../constants/cache.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/messages.js';

export class ProfessionalDevelopmentService {

  async initialize() {
    try {
      logger.info('Professional Development Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Professional Development Service', error);
      throw error;
    }
  }

  async processEvent(event) {
    const { type, payload } = event;
    try {
      switch (type) {
        case 'skills_analysis_request':
          await this.processSkillsAnalysis(payload);
          break;
        case 'career_path_generation':
          await this.processCareerPathGeneration(payload);
          break;
        case 'assessment_completion':
          await this.processAssessmentCompletion(payload);
          break;
        case 'linkedin_sync':
          await this.processLinkedInSync(payload);
          break;
        case 'resume_review_queue':
          await this.processResumeReview(payload);
          break;
        case 'calendar_invitation':
          await this.processCoachingSession(payload);
          break;
        case 'salary_benchmark_request':
          await this.processSalaryBenchmark(payload);
          break;
        case 'market_report_generation':
          await this.processMarketReportGeneration(payload);
          break;
        default:
          logger.warn('Unknown event type', { type });
      }
    } catch (error) {
        logger.error(`Failed to process event of type ${type}`, {
          context: 'ProfessionalDevelopmentService:processEvent',
          userId: payload?.userId || null,
          error: error.message,
        });
        throw error;
      }
    }

  async analyzeSkillsGap(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.skillsGapAnalysis.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      await this.checkRateLimit(sanitizedData.userId, 'skills_analysis', 5, 3600);

      const cacheKey = CACHE_KEYS.SKILLS_GAP(sanitizedData.userId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached skills gap analysis', { userId: sanitizedData.userId });
        return JSON.parse(cached);
      }

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const requiredSkills = await this.getIndustrySkillRequirements(sanitizedData.targetRole, sanitizedData.targetIndustry);
          const skillGaps = this.calculateSkillGaps(sanitizedData.currentSkills, requiredSkills);
          const recommendations = await this.generateSkillRecommendations(skillGaps);

          const analysisResult = {
            skillGaps,
            recommendations,
            analysisScore: this.calculateOverallReadinessScore(skillGaps),
            lastAnalyzedAt: new Date(),
            estimatedLearningTime: skillGaps.reduce((total, gap) => total + gap.estimatedLearningTime, 0)
          };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $set: { skillsAnalysis: { ...sanitizedData, ...analysisResult }, updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          await redisClient.setEx(cacheKey, CACHE_TTL.SKILLS_GAP, JSON.stringify(analysisResult));
          await publishJobEvent('skills_analysis_completed', {
            userId: sanitizedData.userId,
            analysisScore: analysisResult.analysisScore,
            topGaps: skillGaps.slice(0, 5)
          });

          await session.commitTransaction();
          logger.info('Skills gap analysis completed', { userId: sanitizedData.userId });
          return { success: true, message: SUCCESS_MESSAGES.SKILLS_GAP_ANALYZED, data: analysisResult };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to analyze skills gap', error);
      throw error;
    }
  }

  async getSkillsGapAnalysis(userId) {
    try {
      const cacheKey = CACHE_KEYS.SKILLS_GAP(userId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached skills gap analysis', { userId });
        return JSON.parse(cached);
      }

      const profile = await ProfessionalDevModel.findOne({ userId });
      if (!profile?.skillsAnalysis?.lastAnalyzedAt) {
        throw Object.assign(new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND), { status: HTTP_STATUS.NOT_FOUND });
      }

      await redisClient.setEx(cacheKey, CACHE_TTL.SKILLS_GAP, JSON.stringify(profile.skillsAnalysis));
      logger.info('Skills gap analysis retrieved', { userId });
      return { success: true, message: SUCCESS_MESSAGES.SKILLS_GAP_RETRIEVED, data: profile.skillsAnalysis };
    } catch (error) {
        logger.error('Failed to retrieve skills gap analysis', error);
      throw error;
    }
  }

  async generateCareerPath(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.careerPathRequest.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      const cacheKey = CACHE_KEYS.CAREER_PATH(sanitizedData.userId);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const careerPaths = await this.generateCareerPathSuggestions(sanitizedData);
          const pathData = { ...sanitizedData, suggestedPaths: careerPaths, lastUpdatedAt: new Date() };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $set: { careerPath: pathData, updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          await redisClient.setEx(cacheKey, CACHE_TTL.CAREER_PATH, JSON.stringify(pathData));
          await publishJobEvent('career_path_generated', {
            userId: sanitizedData.userId,
            pathCount: careerPaths.length,
            topPath: careerPaths[0]
          });

          await session.commitTransaction();
          logger.info('Career path generated', { userId: sanitizedData.userId });
          return { success: true, message: SUCCESS_MESSAGES.CAREER_PATH_GENERATED, data: pathData };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to generate career path', error);
      throw error;
    }
  }

  async getCareerPathSuggestions(userId) {
    try {
      const cacheKey = CACHE_KEYS.CAREER_PATH(userId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached career path suggestions', { userId });
        return JSON.parse(cached);
      }

      const profile = await ProfessionalDevModel.findOne({ userId });
      if (!profile?.careerPath?.lastUpdatedAt) {
        throw Object.assign(new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND), { status: HTTP_STATUS.NOT_FOUND });
      }

      await redisClient.setEx(cacheKey, CACHE_TTL.CAREER_PATH, JSON.stringify(profile.careerPath));
      logger.info('Career path suggestions retrieved', { userId });
      return { success: true, message: SUCCESS_MESSAGES.CAREER_PATH_RETRIEVED, data: profile.careerPath };
    } catch (error) {
        logger.error('Failed to retrieve career path suggestions', error);
      throw error;
    }
  }

  async createSkillAssessment(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.skillAssessment.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      const existingAssessment = await this.checkExistingAssessment(sanitizedData.userId, sanitizedData.skillId);
      if (existingAssessment) {
        throw Object.assign(new Error(ERROR_MESSAGES.ASSESSMENT_ALREADY_COMPLETED), { status: HTTP_STATUS.CONFLICT });
      }

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const assessmentId = generateSecureId();
          const questions = await this.generateAssessmentQuestions(sanitizedData.skillId, sanitizedData.difficulty, sanitizedData.assessmentType);

          const assessment = {
            assessmentId,
            ...sanitizedData,
            questions,
            status: 'pending',
            startedAt: new Date(),
            answers: []
          };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $push: { assessments: assessment }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          const cacheKey = CACHE_KEYS.ASSESSMENT(assessmentId);
          await redisClient.setEx(cacheKey, CACHE_TTL.ASSESSMENT, JSON.stringify(assessment));

          await session.commitTransaction();
          logger.info('Skill assessment created', { userId: sanitizedData.userId, assessmentId });
          return {
            success: true,
            message: SUCCESS_MESSAGES.ASSESSMENT_CREATED,
            data: {
              assessmentId,
              questions: questions.map(q => ({ questionId: q.questionId, question: q.question, options: q.options })),
              timeLimit: sanitizedData.timeLimit,
              startedAt: assessment.startedAt
            }
          };
        } catch (error) {
          await session.abortTransaction();
          logger.error('Failed to create skill assessment', error);
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
      logger.error('Failed to create skill assessment', error);
      throw error;
    }
  }

  async submitAssessment(assessmentId, userId, answers) {
    try {
      const assessment = await this.getAssessment(assessmentId, userId);
      if (assessment.status !== 'pending' && assessment.status !== 'in_progress') {
        throw Object.assign(new Error(ERROR_MESSAGES.ASSESSMENT_ALREADY_COMPLETED), { status: HTTP_STATUS.CONFLICT });
      }

      const timeElapsed = (Date.now() - new Date(assessment.startedAt).getTime()) / 1000;
      if (timeElapsed > assessment.timeLimit) {
        throw Object.assign(new Error(ERROR_MESSAGES.ASSESSMENT_EXPIRED), { status: HTTP_STATUS.GONE });
      }

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const results = await this.calculateAssessmentResults(assessment, answers);
          await ProfessionalDevModel.findOneAndUpdate(
            { userId, 'assessments.assessmentId': assessmentId },
            {
              $set: {
                'assessments.$.answers': answers,
                'assessments.$.results': results,
                'assessments.$.status': 'completed',
                'assessments.$.completedAt': new Date(),
                'assessments.$.timeTaken': timeElapsed,
                updatedAt: new Date()
              }
            },
            { session }
          );

          await this.updatePracticeStats(userId, 'assessment', results.score, session);
          const resultsCacheKey = CACHE_KEYS.ASSESSMENT_RESULTS(userId, assessment.skillId);
          await redisClient.setEx(resultsCacheKey, CACHE_TTL.ASSESSMENT_RESULTS, JSON.stringify(results));
          await publishJobEvent('assessment_completed', {
            userId,
            assessmentId,
            skillId: assessment.skillId,
            score: results.score,
            percentile: results.percentile
          });

          await session.commitTransaction();
          logger.info('Assessment submitted', { userId, assessmentId });
          return { success: true, message: SUCCESS_MESSAGES.ASSESSMENT_COMPLETED, data: results };
        } catch (error) {
          await session.abortTransaction();
          logger.error('Failed to submit assessment', error);
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to submit assessment', error);
      throw error;
    }
  }

  async addCertification(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.certification.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const certificationId = generateSecureId();
          const certification = { certificationId, ...sanitizedData, addedAt: new Date() };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $push: { certifications: certification }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          if (certification.credentialUrl) {
            await publishJobEvent('certification_verification', {
              userId: sanitizedData.userId,
              certificationId,
              credentialUrl: certification.credentialUrl
            });
          }

          await redisClient.del(CACHE_KEYS.USER_CERTIFICATIONS(sanitizedData.userId));
          await session.commitTransaction();
          logger.info('Certification added', { userId: sanitizedData.userId, certificationId });
          return { success: true, message: SUCCESS_MESSAGES.CERTIFICATION_ADDED, data: { certificationId, certification } };
        } catch (error) {
          await session.abortTransaction();
            logger.error('Failed to add certification', error);
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to add certification', error);
      throw error;
    }
  }

  async getCertifications(userId) {
    try {
      const cacheKey = CACHE_KEYS.USER_CERTIFICATIONS(userId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached certifications', { userId });
        return JSON.parse(cached);
      }

      const profile = await ProfessionalDevModel.findOne({ userId });
      const certifications = profile?.certifications || [];
      await redisClient.setEx(cacheKey, CACHE_TTL.USER_CERTIFICATIONS, JSON.stringify(certifications));
      logger.info('Certifications retrieved', { userId });
      return { success: true, message: SUCCESS_MESSAGES.CERTIFICATIONS_RETRIEVED, data: certifications };
    } catch (error) {
        logger.error('Failed to retrieve certifications', error);
      throw error;
    }
  }

  async connectLinkedInLearning(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.linkedinLearning.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const encryptedToken = await encryptData(sanitizedData.accessToken);
          const linkedinData = {
            connected: true,
            accessToken: encryptedToken,
            lastSyncAt: new Date(),
            courses: [],
            learningPaths: [],
            syncPreferences: sanitizedData.syncPreferences
          };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $set: { linkedinLearning: linkedinData, updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          await publishJobEvent('linkedin_sync', { userId: sanitizedData.userId, action: 'initial_sync' });
          await session.commitTransaction();
          logger.info('LinkedIn Learning connected', { userId: sanitizedData.userId });
          return { success: true, message: SUCCESS_MESSAGES.LINKEDIN_CONNECTED, data: { connected: true, syncScheduled: true } };
        } catch (error) {
          await session.abortTransaction();
            logger.error('Failed to connect LinkedIn Learning', error);
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
      logger.error('Failed to connect LinkedIn Learning', error);
      throw error;
    }
  }

  async syncLinkedInCourses(userId) {
    try {
      const profile = await ProfessionalDevModel.findOne({ userId });
      if (!profile?.linkedinLearning?.connected) {
        throw Object.assign(new Error(ERROR_MESSAGES.LINKEDIN_NOT_CONNECTED), { status: HTTP_STATUS.BAD_REQUEST });
      }

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const courses = await this.fetchLinkedInCourses(userId, await decryptData(profile.linkedinLearning.accessToken));
          await ProfessionalDevModel.findOneAndUpdate(
            { userId },
            { $set: { 'linkedinLearning.courses': courses, 'linkedinLearning.lastSyncAt': new Date(), updatedAt: new Date() } },
            { session }
          );

          await redisClient.del(CACHE_KEYS.LINKEDIN_COURSES(userId));
          await session.commitTransaction();
          logger.info('LinkedIn courses synced', { userId });
          return { success: true, message: SUCCESS_MESSAGES.COURSES_SYNCED, data: { courseCount: courses.length, lastSyncAt: new Date() } };
        } catch (error) {
          await session.abortTransaction();
            logger.error('Failed to sync LinkedIn courses', error);
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to sync LinkedIn courses', error);
      throw error;
    }
  }

  async scheduleMockInterview(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.mockInterview.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      await this.checkRateLimit(sanitizedData.userId, 'mock_interview', 3, 86400);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const sessionId = generateSecureId();
          const questions = await this.generateInterviewQuestions(sanitizedData.jobRole, sanitizedData.interviewType, sanitizedData.experienceLevel);

          const mockInterview = { sessionId, ...sanitizedData, questions, status: 'scheduled', overallFeedback: null };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $push: { mockInterviews: mockInterview }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          await redisClient.del(CACHE_KEYS.MOCK_INTERVIEWS(sanitizedData.userId));
          await session.commitTransaction();
          logger.info('Mock interview scheduled', { userId: sanitizedData.userId, sessionId });
          return {
            success: true,
            message: SUCCESS_MESSAGES.MOCK_INTERVIEW_SCHEDULED,
            data: { sessionId, scheduledAt: sanitizedData.scheduledAt, duration: sanitizedData.duration, questionCount: questions.length }
          };
        } catch (error) {
          await session.abortTransaction();
            logger.error('Failed to schedule mock interview', error);
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to schedule mock interview', error);
      throw error;
    }
  }

  async completeMockInterview(sessionId, userId, answers) {
    try {
      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const feedback = await this.generateInterviewFeedback(answers);
          await ProfessionalDevModel.findOneAndUpdate(
            { userId, 'mockInterviews.sessionId': sessionId },
            {
              $set: {
                'mockInterviews.$.completedAt': new Date(),
                'mockInterviews.$.status': 'completed',
                'mockInterviews.$.overallFeedback': feedback,
                'mockInterviews.$.questions': answers,
                updatedAt: new Date()
              }
            },
            { session }
          );

          await this.updatePracticeStats(userId, 'interview', feedback.overallRating, session);
          await redisClient.del(CACHE_KEYS.MOCK_INTERVIEWS(userId));
          await session.commitTransaction();
          logger.info('Mock interview completed', { userId, sessionId });
          return { success: true, message: SUCCESS_MESSAGES.INTERVIEW_COMPLETED, data: feedback };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to complete mock interview', error);
      throw error;
    }
  }

  async submitResumeForReview(data, resumeFile) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.resumeReview.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      if (!resumeFile) throw Object.assign(new Error(ERROR_MESSAGES.RESUME_UPLOAD_REQUIRED), { status: HTTP_STATUS.BAD_REQUEST });

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const reviewId = generateSecureId();
          const resumeUrl = await this.uploadResumeFile(reviewId, resumeFile);
          const resumeReview = {
            reviewId,
            resumeUrl,
            ...sanitizedData,
            status: 'submitted',
            submittedAt: new Date(),
            reviewerId: null,
            feedback: null
          };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $push: { resumeReviews: resumeReview }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          await publishJobEvent('resume_review_queue', {
            reviewId,
            userId: sanitizedData.userId,
            urgency: sanitizedData.urgency,
            targetRole: sanitizedData.targetRole
          });

          await session.commitTransaction();
          logger.info('Resume submitted for review', { userId: sanitizedData.userId, reviewId });
          return {
            success: true,
            message: SUCCESS_MESSAGES.RESUME_SUBMITTED,
            data: { reviewId, estimatedCompletion: this.calculateReviewTime(sanitizedData.urgency), status: 'submitted' }
          };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to submit resume for review', error);
      throw error;
    }
  }

  async getResumeReview(reviewId, userId) {
    try {
      const cacheKey = CACHE_KEYS.REVIEW_FEEDBACK(reviewId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached resume review', { userId, reviewId });
        return JSON.parse(cached);
      }

      const ProfessionalDev = await ProfessionalDevModel.findOne({ userId });
      const review = ProfessionalDev?.resumeReviews?.find(r => r.reviewId === reviewId);
      if (!review) {
        throw Object.assign(new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND), { status: HTTP_STATUS.NOT_FOUND });
      }

      if (review.feedback) {
        await redisClient.setEx(cacheKey, CACHE_TTL.REVIEW_FEEDBACK, JSON.stringify(review));
      }
      logger.info('Resume review retrieved', { userId, reviewId });
      return {
        success: true,
        message: review.status === 'completed' ? SUCCESS_MESSAGES.FEEDBACK_RETRIEVED : 'Review in progress',
        data: review
      };
    } catch (error) {
        logger.error('Failed to get resume review', error);
      throw error;
    }
  }

  async scheduleCoachingSession(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.coachingSession.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      await this.checkRateLimit(sanitizedData.userId, 'coaching_session', 5, 7 * 24 * 60 * 60);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const assignedCoach = await this.findAvailableCoach(sanitizedData);
          if (!assignedCoach) {
            throw Object.assign(new Error(ERROR_MESSAGES.NO_COACHES_AVAILABLE), { status: HTTP_STATUS.SERVICE_UNAVAILABLE });
          }

          const sessionId = generateSecureId();
          const coachingSession = { sessionId, coachId: assignedCoach.coachId, ...sanitizedData, status: 'scheduled', actionItems: [], feedback: null };

          await ProfessionalDevModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            {
              $push: { coachingSessions: coachingSession },
              $set: { assignedCoach, updatedAt: new Date() }
            },
            { upsert: true, new: true, session }
          );

          await publishJobEvent('calendar_invitation', {
            userId: sanitizedData.userId,
            sessionId,
            coachId: assignedCoach.coachId,
            scheduledAt: sanitizedData.scheduledAt,
            duration: sanitizedData.duration
          });

          await session.commitTransaction();
          logger.info('Coaching session scheduled', { userId: sanitizedData.userId, sessionId });
          return {
            success: true,
            message: SUCCESS_MESSAGES.SESSION_SCHEDULED,
            data: {
              sessionId,
              coach: { name: assignedCoach.name, specializations: assignedCoach.specializations, rating: assignedCoach.rating },
              scheduledAt: sanitizedData.scheduledAt,
              sessionMode: sanitizedData.sessionMode
            }
          };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to get coaching plan', error);
      throw error;
    }
  }

  async getCoachingPlan(userId) {
    try {
      const cacheKey = CACHE_KEYS.COACHING_PLAN(userId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached coaching plan', { userId });
        return JSON.parse(cached);
      }

      const ProfessionalDevModel = await ProfessionalDevModel.findOne({ userId });
      if (!ProfessionalDevModel?.coachingPlan) {
        throw Object.assign(new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND), { status: HTTP_STATUS.NOT_FOUND });
      }

      await redisClient.setEx(cacheKey, CACHE_TTL.COACHING_PLAN, JSON.stringify(ProfessionalDevModel.coachingPlan));
      logger.info('Coaching plan retrieved', { userId });
      return { success: true, message: SUCCESS_MESSAGES.COACHING_PLAN_CREATED, data: ProfessionalDevModel.coachingPlan };
    } catch (error) {
        logger.error('Failed to get coaching plan', error);
      throw error;
    }
  }

  async analyzeSalaryBenchmark(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.salaryNegotiation.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const marketData = await this.fetchSalaryMarketData(sanitizedData);
          const benchmarkScore = this.calculateBenchmarkScore(sanitizedData.currentSalary || sanitizedData.offerSalary, marketData);
          const negotiationStrategy = await this.generateNegotiationStrategy(sanitizedData, marketData);

          const salaryAnalysis = { ...sanitizedData, marketData, benchmarkScore, negotiationStrategy, lastAnalyzed: new Date() };

          await InsightsModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $set: { salaryNegotiation: salaryAnalysis, updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          const cacheKey = CACHE_KEYS.SALARY_DATA(sanitizedData.jobTitle, sanitizedData.location);
          await redisClient.setEx(cacheKey, CACHE_TTL.SALARY_DATA, JSON.stringify(salaryAnalysis));
          await publishJobEvent('salary_benchmark_request', { userId: sanitizedData.userId, ...sanitizedData });

          await session.commitTransaction();
          logger.info('Salary benchmark analyzed', { userId: sanitizedData.userId });
          return { success: true, message: SUCCESS_MESSAGES.SALARY_BENCHMARKED, data: salaryAnalysis };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to analyze salary benchmark', error);
      throw error;
    }
  }

  async getNegotiationTips(level, industry) {
    try {
      const cacheKey = CACHE_KEYS.NEGOTIATION_TIPS(level, industry);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached negotiation tips', { level, industry });
        return JSON.parse(cached);
      }

      const tips = await this.fetchNegotiationTips(level, industry);
      await redisClient.setEx(cacheKey, CACHE_TTL.NEGOTIATION_TIPS, JSON.stringify(tips));
      logger.info('Negotiation tips retrieved', { level, industry });
      return { success: true, message: SUCCESS_MESSAGES.NEGOTIATION_TIPS_RETRIEVED, data: tips };
    } catch (error) {
        logger.error('Failed to get negotiation tips', error);
      throw error;
    }
  }

  async generateMarketReport(data) {
    try {
      const { error, value } = VALIDATION_SCHEMAS.marketReport.validate(data, { abortEarly: false });
      if (error) throw Object.assign(new Error(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${error.details[0].message}`), { status: HTTP_STATUS.BAD_REQUEST });

      const sanitizedData = sanitizeInput(value);
      await this.checkRateLimit(sanitizedData.userId, 'market_report', 3, 86400);

      return await retry(async () => {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          const reportId = generateSecureId();
          const reportData = await this.generateMarketReportData(sanitizedData);

          await InsightsModel.findOneAndUpdate(
            { userId: sanitizedData.userId },
            { $push: { marketReports: { reportId, ...sanitizedData, ...reportData, generatedAt: new Date() } }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true, session }
          );

          await publishJobEvent('market_report_generation', { userId: sanitizedData.userId, reportId, reportType: sanitizedData.reportType });
          await session.commitTransaction();
          logger.info('Market report generated', { userId: sanitizedData.userId, reportId });
          return { success: true, message: SUCCESS_MESSAGES.REPORT_GENERATED, data: { reportId, ...reportData } };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }, { retries: 3, minTimeout: 1000 });
    } catch (error) {
        logger.error('Failed to generate market report', error);
      throw error;
    }
  }

  async getMarketReport(reportId, userId) {
    try {
      const cacheKey = CACHE_KEYS.MARKET_REPORT(reportId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached market report', { userId, reportId });
        return JSON.parse(cached);
      }

      const marketIntel = await InsightsModel.findOne({ userId });
      const report = marketIntel?.marketReports?.find(r => r.reportId === reportId);
      if (!report) {
        throw Object.assign(new Error(ERROR_MESSAGES.RESOURCE_NOT_FOUND), { status: HTTP_STATUS.NOT_FOUND });
      }

      await redisClient.setEx(cacheKey, CACHE_TTL.MARKET_REPORT, JSON.stringify(report));
      logger.info('Market report retrieved', { userId, reportId });
      return { success: true, message: SUCCESS_MESSAGES.REPORT_RETRIEVED, data: report };
    } catch (error) {
        logger.error('Failed to get market report', error);
      throw error;
    }
  }

  // Helper Methods
  async checkRateLimit(userId, feature, limit, windowSeconds) {
    try {
      const key = `ratelimit:${userId}:${feature}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, windowSeconds);
      if (count > limit) {
        throw Object.assign(new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED), { status: HTTP_STATUS.TOO_MANY_REQUESTS });
      }
      logger.debug('Rate limit check passed', { userId, feature, count });
      return true;
    } catch (error) {
        logger.error('Failed to check rate limit', error);
      throw error;
    }
  }

  async getIndustrySkillRequirements(role, industry) {
    try {
      const cacheKey = CACHE_KEYS.INDUSTRY_SKILLS(industry);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached industry skills', { role, industry });
        return JSON.parse(cached);
      }

      const skills = await this.fetchIndustrySkills(role, industry);
      await redisClient.setEx(cacheKey, CACHE_TTL.INDUSTRY_SKILLS, JSON.stringify(skills));
      logger.info('Industry skills fetched', { role, industry });
      return skills;
    } catch (error) {
        logger.error('Failed to get industry skill requirements', error);
      throw error;
    }
  }

  calculateSkillGaps(currentSkills, requiredSkills) {
    try {
      const gaps = requiredSkills.map(required => {
        const current = currentSkills.find(skill => skill.skillId === required.skillId);
        const currentLevel = current?.proficiencyLevel || 0;
        if (currentLevel < required.requiredLevel) {
          return {
            skillId: required.skillId,
            skillName: required.skillName,
            requiredLevel: required.requiredLevel,
            currentLevel,
            priority: this.calculatePriority(required.requiredLevel - currentLevel),
            estimatedLearningTime: (required.requiredLevel - currentLevel) * 20
          };
        }
        return null;
      }).filter(gap => gap);

      logger.debug('Skill gaps calculated', { gapsCount: gaps.length });
      return gaps.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
        logger.error('Failed to calculate skill gaps', error);
      throw error;
    }
  }

  calculatePriority(gapSize) {
    try {
      if (gapSize >= 3) return 'high';
      if (gapSize >= 2) return 'medium';
      return 'low';
    } catch (error) {
        logger.error('Failed to calculate priority', error);
      throw error;
    }
  }

  calculateOverallReadinessScore(skillGaps) {
    try {
      if (skillGaps.length === 0) return 100;
      const totalGap = skillGaps.reduce((sum, gap) => sum + (gap.requiredLevel - gap.currentLevel), 0);
      const maxPossibleGap = skillGaps.length * 5;
      return Math.max(0, Math.floor(((maxPossibleGap - totalGap) / maxPossibleGap) * 100));
    } catch (error) {
        logger.error('Failed to calculate overall readiness score', error);
      throw error;
    }
  }

  async generateSkillRecommendations(skillGaps) {
    try {
      return skillGaps.slice(0, 5).map(gap => ({
        skillId: gap.skillId,
        skillName: gap.skillName,
        recommendation: `Focus on ${gap.skillName} through online courses and practical projects`,
        resources: [`Course: Advanced ${gap.skillName}`, `Practice: ${gap.skillName} projects`],
        estimatedTime: gap.estimatedLearningTime
      }));
    } catch (error) {
        logger.error('Failed to generate skill recommendations', error);
      throw error;
    }
  }

  async generateCareerPathSuggestions(data) {
    try {
      return [
        {
          targetRole: `Senior ${data.currentRole}`,
          targetLevel: 'senior',
          estimatedTime: '2-3 years',
          requiredSkills: ['leadership', 'project management', 'advanced technical skills'],
          salaryRange: { min: 120000, max: 180000, currency: 'USD' },
          pathScore: 85
        },
        {
          targetRole: `${data.currentRole} Manager`,
          targetLevel: 'lead',
          estimatedTime: '3-4 years',
          requiredSkills: ['people management', 'strategic planning', 'budget management'],
          salaryRange: { min: 140000, max: 200000, currency: 'USD' },
          pathScore: 78
        }
      ];
    } catch (error) {
        logger.error('Failed to generate career path suggestions', error);
      throw error;
    }
  }

  async generateAssessmentQuestions(skillId, difficulty, assessmentType) {
    try {
      return [
        {
          questionId: generateSecureId(),
          question: `Sample ${skillId} question for ${difficulty} level`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'Option A',
          explanation: 'Sample explanation',
          timeSpent: 0
        }
      ];
    } catch (error) {
        logger.error('Failed to generate assessment questions', error);
      throw error;
    }
  }

  async generateInterviewQuestions(jobRole, interviewType, experienceLevel) {
    try {
      return [
        {
          questionId: generateSecureId(),
          question: `Tell me about a challenging project you worked on as a ${jobRole}`,
          category: 'behavioral',
          difficulty: experienceLevel,
          answer: '',
          timeSpent: 0,
          feedback: null
        }
      ];
    } catch (error) {
        logger.error('Failed to generate interview questions', error);
      throw error;
    }
  }

  async generateInterviewFeedback(answers) {
    try {
      return {
        communicationScore: 4,
        technicalScore: 4,
        confidenceScore: 3,
        overallRating: 4,
        strengths: ['Clear communication', 'Good technical knowledge'],
        areasForImprovement: ['More confidence in answers', 'Provide specific examples'],
        nextSteps: ['Practice behavioral questions', 'Prepare STAR method examples']
      };
    } catch (error) {
        logger.error('Failed to generate interview feedback', error);
      throw error;
    }
  }

  async updatePracticeStats(userId, type, score, session) {
    try {
      const updateData = type === 'assessment' ?
        {
          $inc: { 'practiceStats.totalAssessments': 1, 'practiceStats.completedAssessments': 1 },
          $set: { 'practiceStats.averageScore': score, 'practiceStats.streak.lastPracticeDate': new Date() }
        } :
        {
          $inc: { 'practiceStats.totalInterviews': 1 },
          $set: { 'practiceStats.averageInterviewRating': score, 'practiceStats.streak.lastPracticeDate': new Date() }
        };

      await ProfessionalDevModel.findOneAndUpdate({ userId }, updateData, { upsert: true, session });
      logger.debug('Practice stats updated', { userId, type, score });
    } catch (error) {
        logger.error('Failed to update practice stats', error);
      throw error;
    }
  }

  async checkExistingAssessment(userId, skillId) {
    try {
      return await ProfessionalDevModel.findOne({
        userId,
        'assessments': { $elemMatch: { skillId, completedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }
      });
    } catch (error) {
        logger.error('Failed to check existing assessment', error);
      throw error;
    }
  }

  async getAssessment(assessmentId, userId) {
    try {
      const cacheKey = CACHE_KEYS.ASSESSMENT(assessmentId);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached assessment', { userId, assessmentId });
        return JSON.parse(cached);
      }

      const practice = await ProfessionalDevModel.findOne({ userId, 'assessments.assessmentId': assessmentId });
      if (!practice) {
        throw Object.assign(new Error(ERROR_MESSAGES.ASSESSMENT_NOT_FOUND), { status: HTTP_STATUS.NOT_FOUND });
      }

      const assessment = practice.assessments.find(a => a.assessmentId === assessmentId);
      await redisClient.setEx(cacheKey, CACHE_TTL.ASSESSMENT, JSON.stringify(assessment));
      logger.info('Assessment retrieved', { userId, assessmentId });
      return assessment;
    } catch (error) {
        logger.error('Failed to get assessment', error);
      throw error;
    }
  }

  async calculateAssessmentResults(assessment, answers) {
    try {
      let correctAnswers = 0;
      const totalQuestions = assessment.questions.length;
      assessment.questions.forEach(question => {
        const userAnswer = answers.find(a => a.questionId === question.questionId);
        if (userAnswer && userAnswer.answer === question.correctAnswer) correctAnswers++;
      });

      const score = Math.floor((correctAnswers / totalQuestions) * 100);
      return {
        score,
        percentile: this.calculatePercentile(score),
        correctAnswers,
        totalQuestions,
        strengths: ['Problem solving', 'Technical knowledge'],
        weaknesses: ['Advanced concepts', 'Implementation details'],
        recommendations: ['Focus on advanced topics', 'Practice more coding problems']
      };
    } catch (error) {
        logger.error('Failed to calculate assessment results', error);
      throw error;
    }
  }

  calculatePercentile(score) {
    try {
      if (score >= 90) return 95;
      if (score >= 80) return 85;
      if (score >= 70) return 70;
      if (score >= 60) return 50;
      return 25;
    } catch (error) {
        logger.error('Failed to calculate percentile', error);
      throw error;
    }
  }

  async fetchLinkedInCourses(userId, accessToken) {
    try {
      // Simulate LinkedIn Learning API call
      return [
        {
          courseId: generateSecureId(),
          title: 'Advanced JavaScript',
          provider: 'LinkedIn Learning',
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          skillsLearned: ['javascript', 'es6', 'async programming'],
          timeSpent: 180
        }
      ];
    } catch (error) {
        logger.error('Failed to fetch LinkedIn courses', error);
      throw error;
    }
  }

  async fetchIndustrySkills(role, industry) {
    try {
      // Simulate external API call for industry skills
      return [
        { skillId: 'javascript', skillName: 'JavaScript', requiredLevel: 4, importance: 'high' },
        { skillId: 'react', skillName: 'React', requiredLevel: 3, importance: 'medium' }
      ];
    } catch (error) {
        logger.error('Failed to fetch industry skills', error);
      throw error;
    }
  }

  async uploadResumeFile(reviewId, fileBuffer) {
    try {
      // Simulate file upload to storage (e.g., AWS S3)
      return `https://storage.example.com/resumes/${reviewId}.pdf`;
    } catch (error) {
        logger.error('Failed to upload resume file', error);
      throw error;
    }
  }

  async processResumeReview(payload) {
    try {
      const { reviewId, userId } = payload;
      const feedback = await this.generateResumeFeedback(payload);
      await ProfessionalDevModel.findOneAndUpdate(
        { userId, 'resumeReviews.reviewId': reviewId },
        {
          $set: {
            'resumeReviews.$.feedback': feedback,
            'resumeReviews.$.status': 'completed',
            'resumeReviews.$.completedAt': new Date(),
            updatedAt: new Date()
          }
        }
      );

      await redisClient.del(CACHE_KEYS.RESUME_REVIEWS(userId));
      await publishJobEvent('resume_review_completed', { reviewId, userId, feedback });
      logger.info('Resume review processed', { userId, reviewId });
    } catch (error) {
        logger.error('Failed to process resume review', error);
      throw error;
    }
  }

  async generateResumeFeedback(payload) {
    try {
      return {
        overallRating: 4,
        sections: [
          { section: 'summary', rating: 4, comments: 'Clear and concise', suggestions: ['Add quantifiable achievements'] },
          { section: 'experience', rating: 3, comments: 'Good detail', suggestions: ['Highlight impact metrics'] }
        ],
        atsCompatibility: { score: 85, issues: ['Missing keywords'], recommendations: ['Add specific technical skills'] },
        improvements: [{ category: 'formatting', priority: 'medium', suggestion: 'Use consistent fonts', example: 'Arial 11pt' }],
        finalNotes: 'Strong resume, focus on ATS optimization'
      };
    } catch (error) {
      logger.error('Failed to generate resume feedback', error);
      throw error;
    }
  }

  calculateReviewTime(urgency) {
    try {
      const times = { 'same_day': '4-6 hours', 'rush': '24-48 hours', 'standard': '3-5 business days' };
      return times[urgency] || times['standard'];
    } catch (error) {
        logger.error('Failed to calculate review time', error);
      throw error;
    }
  }

  async findAvailableCoach(sessionData) {
    try {
      const cacheKey = CACHE_KEYS.AVAILABLE_COACHES;
      let coaches = await redisClient.get(cacheKey);
      if (!coaches) {
        coaches = await this.fetchAvailableCoaches();
        await redisClient.setEx(cacheKey, CACHE_TTL.AVAILABLE_COACHES, JSON.stringify(coaches));
      } else {
        coaches = JSON.parse(coaches);
      }

      const suitableCoaches = coaches.filter(coach => {
        const hasSpecialization = !sessionData.coachPreferences?.specializations?.length ||
          sessionData.coachPreferences.specializations.some(spec => coach.specializations.includes(spec));
        const hasIndustryExperience = !sessionData.coachPreferences?.industry ||
          coach.industries.includes(sessionData.coachPreferences.industry);
        return hasSpecialization && hasIndustryExperience && coach.isAvailable;
      });

      return suitableCoaches.sort((a, b) => b.rating - a.rating)[0] || null;
    } catch (error) {
        logger.error('Failed to find available coach', error);
      throw error;
    }
  }

  async fetchAvailableCoaches() {
    try {
      // Simulate fetching coaches from external service
      return [
        {
          coachId: generateSecureId(),
          name: 'Sarah Johnson',
          specializations: ['career_planning', 'leadership_coaching'],
          industries: ['technology', 'finance'],
          experience: '10-15',
          rating: 4.8,
          isAvailable: true
        },
        {
          coachId: generateSecureId(),
          name: 'Michael Chen',
          specializations: ['interview_prep', 'salary_negotiation'],
          industries: ['technology', 'startups'],
          experience: '15-20',
          rating: 4.9,
          isAvailable: true
        }
      ];
    } catch (error) {
        logger.error('Failed to fetch available coaches', error);
      throw error;
    }
  }

  async createCoachingPlan(userId, goals, timeline) {
    try {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const planId = generateSecureId();
        const coachingPlan = {
          planId,
          goals,
          timeline,
          milestones: this.generateMilestones(goals, timeline),
          progress: 0,
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        };

        await ProfessionalDevModel.findOneAndUpdate(
          { userId },
          { $set: { coachingPlan, updatedAt: new Date() } },
          { upsert: true, new: true, session }
        );

        await redisClient.del(CACHE_KEYS.COACHING_PLAN(userId));
        await session.commitTransaction();
        logger.info('Coaching plan created', { userId, planId });
        return { success: true, message: SUCCESS_MESSAGES.COACHING_PLAN_CREATED, data: coachingPlan };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
        logger.error('Failed to create coaching plan', error);
      throw error;
    }
  }

  generateMilestones(goals, timeline) {
    try {
      const timelineMonths = { '3months': 3, '6months': 6, '1year': 12 }[timeline] || 6;
      return goals.map((goal, index) => ({
        milestone: `Complete goal: ${goal}`,
        targetDate: new Date(Date.now() + ((index + 1) * (timelineMonths / goals.length) * 30 * 24 * 60 * 60 * 1000)),
        status: 'pending',
        achievedAt: null,
        notes: ''
      }));
    } catch (error) {
        logger.error('Failed to generate milestones', error);
      throw error;
    }
  }

  async fetchSalaryMarketData(data) {
    try {
      // Simulate external API call for salary data
      return {
        jobTitle: data.jobTitle,
        location: data.location,
        industry: data.industry,
        experienceYears: data.experienceYears,
        marketData: {
          percentile25: 85000,
          percentile50: 105000,
          percentile75: 130000,
          percentile90: 155000,
          average: 112000,
          dataPoints: 1250,
          lastUpdated: new Date()
        },
        comparableRoles: [
          { title: 'Software Developer', salaryRange: { min: 90000, max: 140000 }, similarity: 95 },
          { title: 'Full Stack Engineer', salaryRange: { min: 95000, max: 145000 }, similarity: 90 }
        ]
      };
    } catch (error) {
        logger.error('Failed to fetch salary market data', error);
      throw error;
    }
  }

  calculateBenchmarkScore(currentSalary, marketData) {
    try {
      const marketMedian = marketData.marketData.percentile50;
      const percentDifference = ((currentSalary - marketMedian) / marketMedian) * 100;
      return Math.round(Math.min(Math.max(50 + percentDifference, 0), 100));
    } catch (error) {
        logger.error('Failed to calculate benchmark score', error);
      throw error;
    }
  }

  async generateNegotiationStrategy(data, marketData) {
    try {
      return {
        suggestedOffer: Math.round(marketData.marketData.percentile75 * 1.1),
        negotiationPoints: [
          'Highlight relevant experience and certifications',
          'Emphasize unique skills aligned with company needs',
          'Propose performance-based incentives'
        ],
        marketPosition: marketData.marketData.percentile50 < data.currentSalary ? 'above_market' : 'below_market',
        recommendedApproach: data.currentSalary < marketData.marketData.percentile50 ? 'aggressive' : 'balanced'
      };
    } catch (error) {
        logger.error('Failed to generate negotiation strategy', error);
      throw error;
    }
  }

  async fetchNegotiationTips(level, industry) {
    try {
      // Simulate fetching negotiation tips
      return [
        {
          tip: `For ${level} roles in ${industry}, research market salary ranges before negotiating`,
          priority: 'high',
          example: 'Use data from recent industry reports to justify your ask'
        },
        {
          tip: 'Practice your pitch focusing on your unique contributions',
          priority: 'medium',
          example: 'Highlight a project where you saved costs or improved efficiency'
        }
      ];
    } catch (error) {
        logger.error('Failed to fetch negotiation tips', error);
      throw error;
    }
  }

  async generateMarketReportData(data) {
    try {
      return {
        reportType: data.reportType,
        generatedAt: new Date(),
        summary: `Market report for ${data.reportType} in ${data.filters?.industry || 'all industries'}`,
        data: {
          demandTrends: ['Increasing demand for cloud skills', 'AI expertise growing 30% YoY'],
          topSkills: ['Python', 'AWS', 'Data Analysis'],
          salaryTrends: { median: 110000, growthRate: '5% YoY' },
          hiringTrends: { activeListings: 25000, growthRate: '10% YoY' }
        },
        recommendations: ['Upskill in AI and cloud technologies', 'Target high-growth sectors']
      };
    } catch (error) {
        logger.error('Failed to generate market report data', error);
      throw error;
    }
  }

  async processSkillsAnalysis(payload) {
    try {
      logger.info('Processing skills analysis', { userId: payload.userId });
      await this.analyzeSkillsGap(payload);
    } catch (error) {
      logger.error('Failed to process skills analysis', error);
      throw error;
    }
  }

  async processCareerPathGeneration(payload) {
    try {
      logger.info('Processing career path generation', { userId: payload.userId });
      await this.generateCareerPath(payload);
    } catch (error) {
        logger.error('Failed to process career path generation', error);
      throw error;
    }
  }

  async processAssessmentCompletion(payload) {
    try {
      logger.info('Processing assessment completion', { userId: payload.userId });
      await this.submitAssessment(payload.assessmentId, payload.userId, payload.answers);
    } catch (error) {
        logger.error('Failed to process assessment completion', error);
      throw error;
    }
  }

  async processLinkedInSync(payload) {
    try {
      logger.info('Processing LinkedIn sync', { userId: payload.userId });
      await this.syncLinkedInCourses(payload.userId);
    } catch (error) {
        logger.error('Failed to process LinkedIn sync', error);
      throw error;
    }
  }

  async processResumeReview(payload) {
    try {
      logger.info('Processing resume review', { userId: payload.userId });
      await this.submitResumeForReview(payload, payload.resumeFile);
    } catch (error) {
        logger.error('Failed to process resume review', error);
      throw error;
    }
  }

  async processCoachingSession(payload) {
    try {
      logger.info('Processing coaching session', { userId: payload.userId });
      await this.scheduleCoachingSession(payload);
    } catch (error) {
        logger.error('Failed to process coaching session', error);
      throw error;
    }
  }

  async processSalaryBenchmark(payload) {
    try {
      logger.info('Processing salary benchmark', { userId: payload.userId });
      await this.analyzeSalaryBenchmark(payload);
    } catch (error) {
      logger.error('Failed to process salary benchmark', error);
      throw error;
    }
  }

  async processMarketReportGeneration(payload) {
    try {
      logger.info('Processing market report generation', { userId: payload.userId });
      await this.generateMarketReport(payload);
    } catch (error) {
        logger.error('Failed to process market report generation', error);
      throw error;
    }
  }
}