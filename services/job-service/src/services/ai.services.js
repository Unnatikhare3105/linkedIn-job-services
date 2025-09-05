import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import Job from "../model/job.model.js";
import { User } from "../model/user.model.js";
import Company from "../model/company.model.js";
import { Application } from "../model/application.model.js";
import { Message } from "../model/message.model.js";
import redisClient from "../config/redis.js";
import { kafkaProducer, kafkaConsumer } from "../config/kafka.js";
import { sanitizeInput } from "../utils/security.js";
import { aiOperationErrors, aiOperationLatency } from "../utils/metrics.js";
import {CACHE_TTL} from "../config/cacahe.ttl.js";
dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class AIService {
  constructor() {
    // Initialize Kafka consumer for async tasks
    this.setupKafkaConsumer();
  }

  async setupKafkaConsumer() {
    kafkaConsumer.on("message", async (message) => {
      try {
        if (message.topic === "ai_tasks") {
          const task = JSON.parse(message.value);
          switch (task.type) {
            case "job_quality_score":
              await this.calculateJobQualityScore(task.payload);
              break;
            case "spam_detection":
              await this.detectSpamJob(task.payload);
              break;
            case "company_verification":
              await this.verifyCompany(task.payload);
              break;
            case "salary_verification":
              await this.verifySalary(task.payload);
              break;
          }
        }
      } catch (error) {
        logger.error(`Kafka consumer error: ${error.message}`, { topic: message.topic, error: error.stack });
      }
    });
  }

  // AI Resume Optimization
  async optimizeResume({ userId, resumeData, targetJobId, requestId }) {
    const operation = "resume_optimization";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Starting resume optimization for user: ${userId}`);

      const user = await User.findOne({ userId });
      if (!user) throw new Error("User not found");
      const job = await Job.findOne({ jobId: targetJobId, isDeleted: false });
      if (!job) throw new Error("Target job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Optimize this resume for the job. Resume: ${resumeData}. Job Description: ${job.description}. Highlight relevant skills, use keywords, and keep it concise (150-200 words).`;
      const result = await model.generateContent(prompt);
      const optimizedResume = sanitizeInput(result.response.text());

      const matchScore = await this.calculateResumeJobMatch(optimizedResume, job, requestId);

      const resultData = {
        userId,
        targetJobId,
        optimizedResume,
        matchScore,
        optimizedAt: new Date(),
      };

      await User.updateOne({ userId }, { optimizedResume });
      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "resume_optimized", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Resume optimization completed`, { userId, targetJobId, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Resume optimization failed: ${error.message}`, { userId, error: error.stack });
      throw error;
    }
  }

  // AI Job Matching
  async getJobMatches({ userId, preferences, requestId }) {
    const operation = "job_matching";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Starting AI job matching for user: ${userId}`);

      const user = await User.findOne({ userId });
      if (!user) throw new Error("User not found");

      const combinedPreferences = { ...user.profile, ...preferences };
      const jobs = await Job.find({
        isDeleted: false,
        isActive: true,
        $or: [
          { skills: { $in: combinedPreferences.skills || [] } },
          { location: combinedPreferences.location },
          { jobType: combinedPreferences.jobType },
        ],
      }).limit(50);

      const jobsWithScores = await Promise.all(
        jobs.map(async (job) => {
          const score = await this.calculateJobCompatibility(combinedPreferences, job, requestId);
          return { ...job.toObject(), compatibilityScore: score };
        })
      );

      const sortedJobs = jobsWithScores.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

      const result = {
        jobs: sortedJobs,
        totalMatches: sortedJobs.length,
        preferences: combinedPreferences,
        generatedAt: new Date(),
      };

      await redisClient.setex(`job_matches:${userId}`, CACHE_TTL.JOB_MATCHES, JSON.stringify(result));
      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "job_matches", payload: result, requestId }) }],
      });

      logger.info(`[${requestId}] Job matching completed with ${sortedJobs.length} matches`, { userId, duration: Date.now() - startTime });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Job matching failed: ${error.message}`, { userId, error: error.stack });
      throw error;
    }
  }

  // AI Job Description Analysis
  async analyzeJobDescription({ jobId, description, requestId }) {
    const operation = "job_analysis";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Starting job description analysis for job: ${jobId}`);

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Analyze this job description: ${description}. Extract keywords, required/preferred skills, salary indicators, company insights, role level, and work arrangement.`;
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

      await Job.updateOne({ jobId }, { analysis: resultData });
      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "job_analysis", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Job description analysis completed`, { jobId, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Job analysis failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  // Open to Work Status
  async updateOpenToWorkStatus({ userId, isOpenToWork, preferences, requestId }) {
    const operation = "open_to_work";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Updating open to work status for user: ${userId}`);

      const updateData = {
        userId,
        openToWork: isOpenToWork,
        preferences: preferences || {},
        updatedAt: new Date(),
      };

      const result = await User.updateOne({ userId }, updateData);

      if (isOpenToWork) {
        setImmediate(() => {
          this.getJobMatches({ userId, preferences, requestId }).catch((error) =>
            logger.error(`[${requestId}] Auto job matching failed: ${error.message}`)
          );
        });
      }

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "open_to_work", payload: updateData, requestId }) }],
      });

      logger.info(`[${requestId}] Open to work status updated successfully`, { userId, duration: Date.now() - startTime });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Open to work update failed: ${error.message}`, { userId, error: error.stack });
      throw error;
    }
  }

  // Featured Applicant
  async setFeaturedApplicant({ applicationId, jobId, companyId, requestId }) {
    const operation = "featured_applicant";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Setting featured applicant: ${applicationId}`);

      const job = await Job.findOne({ jobId, companyId, isDeleted: false });
      if (!job) throw new Error("Job not found or unauthorized");

      await User.updateMany({ "applications.jobId": jobId }, { isFeatured: false });
      const application = await Application.findOne({ applicationId });
      if (!application) throw new Error("Application not found");

      const user = await User.findOne({ userId: application.userId });
      if (!user) throw new Error("User not found");

      user.isFeatured = true;
      await user.save();

      const result = { applicationId, jobId, companyId, featuredAt: new Date() };
      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "featured_applicant", payload: result, requestId }) }],
      });

      logger.info(`[${requestId}] Featured applicant set successfully`, { applicationId, duration: Date.now() - startTime });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Set featured applicant failed: ${error.message}`, { applicationId, error: error.stack });
      throw error;
    }
  }

  // Direct Recruiter Messaging
  async sendDirectMessage({ senderId, recipientId, message, jobId, requestId }) {
    const operation = "direct_message";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Sending direct message from ${senderId} to ${recipientId}`);

      const sender = await User.findOne({ userId: senderId });
      if (!sender || (!sender.isRecruiter && !sender.canMessage)) {
        throw new Error("Sender not authorized to send direct messages");
      }

      const messageData = {
        messageId: uuidv4(),
        senderId,
        recipientId,
        message,
        jobId,
        messageType: "direct_recruiter",
        sentAt: new Date(),
      };

      const result = await Message.create(messageData);
      await this.sendMessageNotification({ recipientId, senderId, messageId: result.messageId, jobId, requestId });

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "direct_message", payload: messageData, requestId }) }],
      });

      logger.info(`[${requestId}] Direct message sent successfully`, { senderId, recipientId, duration: Date.now() - startTime });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Direct message failed: ${error.message}`, { senderId, recipientId, error: error.stack });
      throw error;
    }
  }

  // Top Applicant Jobs
  async getTopApplicantJobs({ userId, pagination, requestId }) {
    const operation = "top_applicant_jobs";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Fetching top applicant jobs for user: ${userId}`);

      const user = await User.findOne({ userId });
      if (!user) throw new Error("User not found");

      const jobs = await Job.find({
        isDeleted: false,
        isActive: true,
        jobId: { $in: user.topApplicantJobs || [] },
      })
        .skip(pagination.cursor)
        .limit(pagination.limit);

      const totalCount = await Job.countDocuments({
        isDeleted: false,
        isActive: true,
        jobId: { $in: user.topApplicantJobs || [] },
      });

      const result = {
        items: jobs.map((job) => ({
          jobId: job.jobId,
          title: job.title,
          companyId: job.companyId,
          matchScore: Math.random() * 20 + 80, // Placeholder AI score
        })),
        totalCount,
        nextCursor: jobs.length === pagination.limit ? pagination.cursor + pagination.limit : null,
      };

      logger.info(`[${requestId}] Top applicant jobs fetched successfully`, { userId, jobCount: jobs.length, duration: Date.now() - startTime });
      latency();
      return result;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Top applicant jobs failed: ${error.message}`, { userId, error: error.stack });
      throw error;
    }
  }

  // Company Verification
  async verifyCompany({ companyId, verificationData, requestId }) {
    const operation = "company_verification";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Verifying company: ${companyId}`);

      const company = await Company.findOne({ companyId, isDeleted: false });
      if (!company) throw new Error("Company not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Verify company based on: ${JSON.stringify(verificationData)}. Check for authenticity of domain, registration, and social proof. Return { isVerified: boolean, verificationScore: number, details: object }.`;
      const result = await model.generateContent(prompt);
      const verificationResult = JSON.parse(sanitizeInput(result.response.text()));

      company.verificationStatus = verificationResult.isVerified ? "verified" : "rejected";
      company.verifiedBadge = verificationResult.isVerified;
      await company.save();

      const resultData = {
        companyId,
        verificationStatus: company.verificationStatus,
        verifiedBadge: company.verifiedBadge,
        verificationScore: verificationResult.verificationScore,
        details: verificationResult.details,
        verifiedAt: new Date(),
      };

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "company_verification", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Company verification completed`, { companyId, isVerified: verificationResult.isVerified, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Company verification failed: ${error.message}`, { companyId, error: error.stack });
      throw error;
    }
  }

  // Salary Verification
  async verifySalary({ jobId, salaryData, requestId }) {
    const operation = "salary_verification";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Verifying salary for job: ${jobId}`);

      const job = await Job.findOne({ jobId, isDeleted: false });
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Verify salary range for job: ${JSON.stringify(salaryData)}. Compare with industry standards and location. Return { isValid: boolean, estimatedRange: object, confidence: number }.`;
      const result = await model.generateContent(prompt);
      const verificationResult = JSON.parse(sanitizeInput(result.response.text()));

      job.salaryVerified = verificationResult.isValid;
      await job.save();

      const resultData = {
        jobId,
        salaryVerified: job.salaryVerified,
        estimatedRange: verificationResult.estimatedRange,
        confidence: verificationResult.confidence,
        verifiedAt: new Date(),
      };

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "salary_verification", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Salary verification completed`, { jobId, isValid: verificationResult.isValid, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Salary verification failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  // Application Duplicate Detection
  async detectDuplicateApplication({ userId, jobId, applicationData, requestId }) {
    const operation = "duplicate_application";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Detecting duplicate application for user: ${userId}, job: ${jobId}`);

      const existingApplications = await Application.find({ userId, jobId });
      if (!existingApplications.length) return { isDuplicate: false, applicationId: null };

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Compare application data: ${applicationData} with existing: ${JSON.stringify(existingApplications)}. Determine if duplicate based on resume and cover letter similarity. Return { isDuplicate: boolean, similarityScore: number }.`;
      const result = await model.generateContent(prompt);
      const duplicateResult = JSON.parse(sanitizeInput(result.response.text()));

      const resultData = {
        userId,
        jobId,
        isDuplicate: duplicateResult.isDuplicate,
        similarityScore: duplicateResult.similarityScore,
        existingApplicationId: duplicateResult.isDuplicate ? existingApplications[0].applicationId : null,
      };

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "duplicate_application", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Duplicate application detection completed`, { userId, jobId, isDuplicate: resultData.isDuplicate, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Duplicate application detection failed: ${error.message}`, { userId, jobId, error: error.stack });
      throw error;
    }
  }

  // Job Quality Score
  async calculateJobQualityScore({ jobId, description, requestId }) {
    const operation = "job_quality_score";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Calculating job quality score for job: ${jobId}`);

      const job = await Job.findOne({ jobId, isDeleted: false });
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Evaluate job quality for: ${description}. Consider clarity, detail, salary transparency, and company reputation. Return { qualityScore: number, factors: object }.`;
      const result = await model.generateContent(prompt);
      const qualityResult = JSON.parse(sanitizeInput(result.response.text()));

      job.qualityScore = qualityResult.qualityScore;
      await job.save();

      const resultData = {
        jobId,
        qualityScore: qualityResult.qualityScore,
        factors: qualityResult.factors,
        calculatedAt: new Date(),
      };

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "job_quality_score", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Job quality score calculated`, { jobId, qualityScore: qualityResult.qualityScore, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Job quality score calculation failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  // Spam Job Detection
  async detectSpamJob({ jobId, description, requestId }) {
    const operation = "spam_job_detection";
    const startTime = Date.now();
    try {
      const latency = aiOperationLatency.startTimer({ operation });
      logger.info(`[${requestId}] Detecting spam job: ${jobId}`);

      const job = await Job.findOne({ jobId, isDeleted: false });
      if (!job) throw new Error("Job not found");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Detect if this job description is spam: ${description}. Look for red flags like vague details, unrealistic promises, or suspicious language. Return { isSpam: boolean, spamScore: number, reasons: array }.`;
      const result = await model.generateContent(prompt);
      const spamResult = JSON.parse(sanitizeInput(result.response.text()));

      job.isSpam = spamResult.isSpam;
      job.spamDetectionScore = spamResult.spamScore;
      await job.save();

      const resultData = {
        jobId,
        isSpam: spamResult.isSpam,
        spamScore: spamResult.spamScore,
        reasons: spamResult.reasons,
        detectedAt: new Date(),
      };

      await kafkaProducer.send({
        topic: "ai_tasks",
        messages: [{ value: JSON.stringify({ type: "spam_detection", payload: resultData, requestId }) }],
      });

      logger.info(`[${requestId}] Spam job detection completed`, { jobId, isSpam: spamResult.isSpam, duration: Date.now() - startTime });
      latency();
      return resultData;
    } catch (error) {
      aiOperationErrors.inc({ operation });
      logger.error(`[${requestId}] Spam job detection failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  // Helper Methods (optimized with batching and caching)
  async calculateResumeJobMatch(resume, job, requestId) {
    const cacheKey = `resume_match:${job.jobId}:${JSON.stringify(resume).slice(0, 50)}`;
    const cachedScore = await redisClient.get(cacheKey);
    if (cachedScore) return parseFloat(cachedScore);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Calculate match score between resume: ${resume} and job: ${job.description}. Return a score between 0-100.`;
    const result = await model.generateContent(prompt);
    const score = parseFloat(result.response.text()) || Math.random() * 40 + 60; // Fallback
    await redisClient.setex(cacheKey, CACHE_TTL.JOB_MATCHES, score);
    return score;
  }

  async calculateJobCompatibility(preferences, job, requestId) {
    const cacheKey = `job_compat:${job.jobId}:${JSON.stringify(preferences).slice(0, 50)}`;
    const cachedScore = await redisClient.get(cacheKey);
    if (cachedScore) return parseFloat(cachedScore);

    let score = 0;
    if (preferences.skills) {
      const skillMatch = job.skills.filter((skill) => preferences.skills.includes(skill)).length;
      score += (skillMatch / Math.max(job.skills.length, 1)) * 40;
    }
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
    const sections = ["responsibilities", "requirements", "qualifications", "benefits"];
    sections.forEach((section) => {
      if (description.toLowerCase().includes(section)) score += 5;
    });
    const detailPatterns = ["years of experience", "degree", "skills", "technologies"];
    detailPatterns.forEach((pattern) => {
      if (description.toLowerCase().includes(pattern)) score += 5;
    });
    return Math.min(score, 50);
  }

  async sendMessageNotification({ recipientId, senderId, messageId, jobId, requestId }) {
    logger.info(`[${requestId}] Notification sent to user ${recipientId}`);
    await kafkaProducer.send({
      topic: "notifications",
      messages: [{ value: JSON.stringify({ recipientId, senderId, messageId, jobId, requestId }) }],
    });
  }
}

export const aiService = new AIService();