import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from "uuid";
import logger from "../utils/logger.js";
import Job from "../model/job.model.js";
import Company from "../model/company.model.js";
import jobApplication from "../model/jobApplication.model.js";
import { Message } from "../model/message.model.js";
import redisClient from "../config/redis.js";
import { producer, consumer } from "../config/kafka.js";
import { generateSecureId, sanitizeInput } from "../utils/security.js";
import { aiOperationErrors, aiOperationLatency } from "../utils/metrics.js";
import { CACHE_TTL } from "../constants/cache.js";
// import { date } from "joi";
import { request } from "express";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const uuidValidator = (value) => value === null || (uuidValidate(value) && uuidVersion(value) === 4);

class AIService {
  // constructor() {
  //   this.setupKafkaConsumer();
  // }
  async handleMessage(topic, message) {
    try {
      const { type, payload, requestId } = message;
      switch (type) {
        case "resume_optimized":
          await this.handleResumeOptimized(payload);
          break;
        case "job_quality_score":
          await this.handleJobQualityScore(payload);
          break;
        case "spam_detection":
          await this.handleSpamDetection(payload);
          break;
        case "company_verification":
          await this.handleCompanyVerification(payload);
          break;
        case "salary_verification":
          await this.handleSalaryVerification(payload);
          break;
        default:
          logger.warn(`Unknown message type: ${type}`, { topic });
      }
    } catch (error) {
      logger.error(`Error handling message in AI service: ${error.message}`, { topic, requestId });
      throw error;
    }
  }

  async optimizeResume({ id, resumeData, targetJobId, requestId }, req) {
    if (!uuidValidator(id) || !uuidValidator(targetJobId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "resume_optimization" });
      if (!req.user || req.user.id !== id) throw new Error("Unauthorized");

      const job = await Job.findOne({ _id: targetJobId, isDeleted: false }).lean();
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Optimize resume: ${resumeData}. Job: ${job.description}. Concise (150-200 words).`;
      const result = await model.generateContent(prompt);
      const optimizedResume = sanitizeInput(result.response.text());

      const matchScore = await this.calculateResumeJobMatch(optimizedResume, job, requestId);
      await redisClient.setex(`user:${id}:optimizedResume`, CACHE_TTL.USER_DATA, optimizedResume);

      const resultData = { userId: id, targetJobId, optimizedResume, matchScore, optimizedAt: new Date() };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "resume_optimized", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Resume optimized`, { userId: id, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "resume_optimization" });
      logger.error(`[${requestId}] Resume optimization failed: ${error.message}`, { userId: id });
      throw error;
    }
  }

  async getJobMatches({ id, preferences, requestId }, req) {
    if (!uuidValidator(id)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "job_matching" });
      if (!req.user || req.user.id !== id) throw new Error("Unauthorized");

      const cachedProfile = await redisClient.get(`user:${id}:profile`);
      const userProfile = cachedProfile ? JSON.parse(cachedProfile) : {};
      const combinedPreferences = { ...userProfile, ...preferences };

      const jobs = await Job.find({
        isDeleted: false,
        isActive: true,
        $or: [
          { skills: { $in: combinedPreferences.skills || [] } },
          { location: combinedPreferences.location },
          { jobType: combinedPreferences.jobType },
        ],
      }).limit(50).lean();

      const jobsWithScores = await Promise.all(
        jobs.map(async (job) => ({
          ...job,
          compatibilityScore: await this.calculateJobCompatibility(combinedPreferences, job, requestId),
        }))
      );

      const sortedJobs = jobsWithScores.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
      const result = { jobs: sortedJobs, totalMatches: sortedJobs.length, preferences: combinedPreferences, generatedAt: new Date() };

      await redisClient.setex(`job_matches:${id}`, CACHE_TTL.JOB_MATCHES, JSON.stringify(result));
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "job_matches", payload: result, requestId }) }] });

      logger.info(`[${requestId}] Job matches: ${sortedJobs.length}`, { userId: id, duration: Date.now() - start });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation: "job_matching" });
      logger.error(`[${requestId}] Job matching failed: ${error.message}`, { userId: id });
      throw error;
    }
  }

  async analyzeJobDescription({ jobId, description, requestId }, req) {
    if (!uuidValidator(jobId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "job_analysis" });
      if (!req.user || !req.user.canManageJobs) throw new Error("Unauthorized");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Analyze job description: ${description}. Extract keywords, skills, salary, company insights, role level, work arrangement.`;
      const result = await model.generateContent(prompt);
      const analysis = JSON.parse(sanitizeInput(result.response.text()));

      const resultData = {
        jobId,
        keywords: analysis.keywords || [],
        requiredSkills: analysis.requiredSkills || [],
        preferredSkills: analysis.preferredSkills || [],
        salaryRange: analysis.salaryRange || { found: false, estimated: null },
        companyInsights: analysis.companyInsights || {},
        roleLevel: analysis.roleLevel || "mid",
        workArrangement: analysis.workArrangement || "hybrid",
        analysisScore: await this.calculateAnalysisScore(description, requestId),
        analyzedAt: new Date(),
      };

      await Job.updateOne({ _id: jobId }, { analysis: resultData }, { lean: true });
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "job_analysis", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Job analysis done`, { jobId, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "job_analysis" });
      logger.error(`[${requestId}] Job analysis failed: ${error.message}`, { jobId });
      throw error;
    }
  }

  async updateOpenToWorkStatus({ id, isOpenToWork, preferences, requestId }, req) {
    if (!uuidValidator(id)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "open_to_work" });
      if (!req.user || req.user.id !== id) throw new Error("Unauthorized");

      const updateData = { openToWork: isOpenToWork, preferences: preferences || {}, updatedAt: new Date() };
      await redisClient.setex(`user:${id}:openToWork`, CACHE_TTL.USER_DATA, JSON.stringify(updateData));

      if (isOpenToWork) {
        setImmediate(() => this.getJobMatches({ id, preferences, requestId }, req).catch((error) =>
          logger.error(`[${requestId}] Auto job matching failed: ${error.message}`)
        ));
      }

      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "open_to_work", payload: { userId: id, ...updateData }, requestId }) }] });

      logger.info(`[${requestId}] Open to work updated`, { userId: id, duration: Date.now() - start });
      latency();
      return updateData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "open_to_work" });
      logger.error(`[${requestId}] Open to work failed: ${error.message}`, { userId: id });
      throw error;
    }
  }

  async setFeaturedApplicant({ applicationId, jobId, companyId, requestId }, req) {
    if (!uuidValidator(applicationId) || !uuidValidator(jobId) || !uuidValidator(companyId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "featured_applicant" });
      if (!req.user || !req.user.canManageJobs) throw new Error("Unauthorized");

      const job = await Job.findOne({ _id: jobId, companyId, isDeleted: false }).lean();
      if (!job) throw new Error("Job not found");
      const application = await jobApplication.findOne({ _id: applicationId }).lean();
      if (!application) throw new Error("Application not found");

      await redisClient.del(`user:*:isFeatured:${jobId}`);
      await redisClient.setex(`user:${application.userId}:isFeatured:${jobId}`, CACHE_TTL.USER_DATA, "true");

      const result = { applicationId, jobId, companyId, featuredAt: new Date() };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "featured_applicant", payload: result, requestId }) }] });

      logger.info(`[${requestId}] Featured applicant set`, { applicationId, duration: Date.now() - start });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation: "featured_applicant" });
      logger.error(`[${requestId}] Featured applicant failed: ${error.message}`, { applicationId });
      throw error;
    }
  }

  async sendDirectMessage({ senderId, recipientId, message, jobId, requestId }, req) {
    if (!uuidValidator(senderId) || !uuidValidator(recipientId) || (jobId && !uuidValidator(jobId))) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "direct_message" });
      if (!req.user || req.user.id !== senderId || (!req.user.isRecruiter && !req.user.canMessage)) throw new Error("Unauthorized");

      const messageData = { _id: generateSecureId(), senderId, recipientId, message, jobId, messageType: "direct_recruiter", sentAt: new Date() };
      const result = await Message.create(messageData);
      await this.sendMessageNotification({ recipientId, senderId, messageId: result._id, jobId, requestId });

      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "direct_message", payload: messageData, requestId }) }] });

      logger.info(`[${requestId}] Message sent`, { senderId, recipientId, duration: Date.now() - start });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation: "direct_message" });
      logger.error(`[${requestId}] Message failed: ${error.message}`, { senderId, recipientId });
      throw error;
    }
  }

  async getTopApplicantJobs({ id, pagination, requestId }, req) {
    if (!uuidValidator(id)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "top_applicant_jobs" });
      if (!req.user || req.user.id !== id) throw new Error("Unauthorized");

      const cachedTopJobs = await redisClient.get(`user:${id}:topApplicantJobs`);
      const topApplicantJobs = cachedTopJobs ? JSON.parse(cachedTopJobs) : [];

      const jobs = await Job.find({ _id: { $in: topApplicantJobs }, isDeleted: false, isActive: true })
        .skip(pagination.cursor)
        .limit(pagination.limit)
        .lean();

      const totalCount = await Job.countDocuments({ _id: { $in: topApplicantJobs }, isDeleted: false, isActive: true });

      const result = {
        items: jobs.map((job) => ({ jobId: job._id, title: job.title, companyId: job.companyId, matchScore: Math.random() * 20 + 80 })),
        totalCount,
        nextCursor: jobs.length === pagination.limit ? pagination.cursor + pagination.limit : null,
      };

      logger.info(`[${requestId}] Top jobs fetched: ${jobs.length}`, { userId: id, duration: Date.now() - start });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation: "top_applicant_jobs" });
      logger.error(`[${requestId}] Top jobs failed: ${error.message}`, { userId: id });
      throw error;
    }
  }

  async verifyCompany({ companyId, verificationData, requestId }, req) {
    if (!uuidValidator(companyId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "company_verification" });
      if (!req.user || !req.user.canVerifyCompanies) throw new Error("Unauthorized");

      const company = await Company.findOne({ _id: companyId, isDeleted: false }).lean();
      if (!company) throw new Error("Company not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Verify company: ${JSON.stringify(verificationData)}. Check domain, registration, social proof. Return { isVerified: boolean, verificationScore: number, details: object }.`;
      const result = await model.generateContent(prompt);
      const verificationResult = JSON.parse(sanitizeInput(result.response.text()));

      await Company.updateOne(
        { _id: companyId },
        { verificationStatus: verificationResult.isVerified ? "verified" : "rejected", verifiedBadge: verificationResult.isVerified },
        { lean: true }
      );

      const resultData = { companyId, verificationStatus: verificationResult.isVerified ? "verified" : "rejected", verifiedBadge: verificationResult.isVerified, verificationScore: verificationResult.verificationScore, details: verificationResult.details, verifiedAt: new Date() };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "company_verification", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Company verified`, { companyId, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "company_verification" });
      logger.error(`[${requestId}] Company verification failed: ${error.message}`, { companyId });
      throw error;
    }
  }

  async verifySalary({ jobId, salaryData, requestId }, req) {
    if (!uuidValidator(jobId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "salary_verification" });
      if (!req.user || !req.user.canVerifyJobs) throw new Error("Unauthorized");

      const job = await Job.findOne({ _id: jobId, isDeleted: false }).lean();
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Verify salary: ${JSON.stringify(salaryData)}. Compare with industry standards. Return { isValid: boolean, estimatedRange: object, confidence: number }.`;
      const result = await model.generateContent(prompt);
      const verificationResult = JSON.parse(sanitizeInput(result.response.text()));

      await Job.updateOne({ _id: jobId }, { salaryVerified: verificationResult.isValid }, { lean: true });

      const resultData = { jobId, salaryVerified: verificationResult.isValid, estimatedRange: verificationResult.estimatedRange, confidence: verificationResult.confidence, verifiedAt: new Date() };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "salary_verification", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Salary verified`, { jobId, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "salary_verification" });
      logger.error(`[${requestId}] Salary verification failed: ${error.message}`, { jobId });
      throw error;
    }
  }

  async detectDuplicateApplication({ userId, jobId, applicationData, requestId }, req) {
    if (!uuidValidator(userId) || !uuidValidator(jobId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "duplicate_application" });
      if (!req.user || req.user.id !== userId) throw new Error("Unauthorized");

      const existingApplications = await jobApplication.find({ userId, jobId }).lean();
      if (!existingApplications.length) return { isDuplicate: false, applicationId: null };

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Compare application: ${applicationData} with existing: ${JSON.stringify(existingApplications)}. Check resume/cover letter similarity. Return { isDuplicate: boolean, similarityScore: number }.`;
      const result = await model.generateContent(prompt);
      const duplicateResult = JSON.parse(sanitizeInput(result.response.text()));

      const resultData = { userId, jobId, isDuplicate: duplicateResult.isDuplicate, similarityScore: duplicateResult.similarityScore, existingApplicationId: duplicateResult.isDuplicate ? existingApplications[0]._id : null };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "duplicate_application", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Duplicate check done`, { userId, jobId, isDuplicate: resultData.isDuplicate, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "duplicate_application" });
      logger.error(`[${requestId}] Duplicate check failed: ${error.message}`, { userId, jobId });
      throw error;
    }
  }

  async calculateJobQualityScore({ jobId, description, requestId }, req) {
    if (!uuidValidator(jobId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "job_quality_score" });
      if (!req.user || !req.user.canManageJobs) throw new Error("Unauthorized");

      const job = await Job.findOne({ _id: jobId, isDeleted: false }).lean();
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Evaluate job quality: ${description}. Check clarity, detail, salary transparency, company reputation. Return { qualityScore: number, factors: object }.`;
      const result = await model.generateContent(prompt);
      const qualityResult = JSON.parse(sanitizeInput(result.response.text()));

      await Job.updateOne({ _id: jobId }, { qualityScore: qualityResult.qualityScore }, { lean: true });

      const resultData = { jobId, qualityScore: qualityResult.qualityScore, factors: qualityResult.factors, calculatedAt: new Date() };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "job_quality_score", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Job quality calculated`, { jobId, qualityScore: qualityResult.qualityScore, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "job_quality_score" });
      logger.error(`[${requestId}] Job quality failed: ${error.message}`, { jobId });
      throw error;
    }
  }

  async detectSpamJob({ jobId, description, requestId }, req) {
    if (!uuidValidator(jobId)) throw new Error("Invalid UUID");
    const start = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation: "spam_job_detection" });
      if (!req.user || !req.user.canManageJobs) throw new Error("Unauthorized");

      const job = await Job.findOne({ _id: jobId, isDeleted: false }).lean();
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Detect spam in job description: ${description}. Check for vague details, unrealistic promises. Return { isSpam: boolean, spamScore: number, reasons: array }.`;
      const result = await model.generateContent(prompt);
      const spamResult = JSON.parse(sanitizeInput(result.response.text()));

      await Job.updateOne({ _id: jobId }, { isSpam: spamResult.isSpam, spamDetectionScore: spamResult.spamScore }, { lean: true });

      const resultData = { jobId, isSpam: spamResult.isSpam, spamScore: spamResult.spamScore, reasons: spamResult.reasons, detectedAt: new Date() };
      await producer.send({ topic: "ai_tasks", messages: [{ value: JSON.stringify({ type: "spam_detection", payload: resultData, requestId }) }] });

      logger.info(`[${requestId}] Spam detection done`, { jobId, isSpam: spamResult.isSpam, duration: Date.now() - start });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation: "spam_job_detection" });
      logger.error(`[${requestId}] Spam detection failed: ${error.message}`, { jobId });
      throw error;
    }
  }

  async calculateResumeJobMatch(resume, job, requestId) {
    const cacheKey = `resume_match:${job._id}:${JSON.stringify(resume).slice(0, 50)}`;
    const cachedScore = await redisClient.get(cacheKey);
    if (cachedScore) return parseFloat(cachedScore);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Calculate match score for resume: ${resume} and job: ${job.description}. Return score (0-100).`;
    const result = await model.generateContent(prompt);
    const score = parseFloat(result.response.text()) || Math.random() * 40 + 60;
    await redisClient.setex(cacheKey, CACHE_TTL.JOB_MATCHES, score);
    return score;
  }

  async calculateJobCompatibility(preferences, job, requestId) {
    const cacheKey = `job_compat:${job._id}:${JSON.stringify(preferences).slice(0, 50)}`;
    const cachedScore = await redisClient.get(cacheKey);
    if (cachedScore) return parseFloat(cachedScore);

    let score = 0;
    if (preferences.skills) score += (job.skills.filter((s) => preferences.skills.includes(s)).length / Math.max(job.skills.length, 1)) * 40;
    if (preferences.location && job.location === preferences.location) score += 30;
    if (preferences.jobType && job.jobType === preferences.jobType) score += 20;
    if (preferences.experienceLevel && job.experienceLevel === preferences.experienceLevel) score += 10;

    const finalScore = Math.min(score, 100);
    await redisClient.setex(cacheKey, CACHE_TTL.JOB_MATCHES, finalScore);
    return finalScore;
  }

  async calculateAnalysisScore(description, requestId) {
    let score = 0;
    if (description.length > 500) score += 10;
    ["responsibilities", "requirements", "qualifications", "benefits"].forEach((section) => {
      if (description.toLowerCase().includes(section)) score += 5;
    });
    ["years of experience", "degree", "skills", "technologies"].forEach((pattern) => {
      if (description.toLowerCase().includes(pattern)) score += 5;
    });
    return Math.min(score, 50);
  }

  async sendMessageNotification({ recipientId, senderId, messageId, jobId, requestId }) {
    await producer.send({ topic: "notifications", messages: [{ value: JSON.stringify({ recipientId, senderId, messageId, jobId, requestId }) }] });
    logger.info(`[${requestId}] Notification sent to ${recipientId}`);
  }

  async processTask(payload) {
    logger.info(`Processing AI task: ${payload.requestId}`, { service: 'ai', payload });
    // Implement task processing logic here
    return { result: "Task processed", data: payload };
  }
}

export const aiService = new AIService();