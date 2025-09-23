// services/qualityTrust.services.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import Company from "../model/company.model.js";
import Job from "../model/job.model.js";
import jobApplication from "../model/jobApplication.model.js";
import QualityTrust from "../model/qualityTrust.model.js";
import logger from "../utils/logger.js";
import redisClient from "../config/redis.js";
import { producer, publishJobEvent } from "../config/kafka.js";
import { sanitizeInput } from "../utils/security.js";
import axios from "axios";
import { serviceLatency, serviceErrors } from "../utils/metrics.js";
import { CACHE_TTL } from "../constants/cache.js";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export class QualityTrustService {
  async handleMessage(topic, message) {
    try {
      const { type, payload, requestId } = message;
      let result;

      switch (type) {
        case 'quality_tasks':
          result = await this.processTask(payload, requestId);
          await publishJobEvent('quality_results', { type, payload: result, requestId });
          break;
        case 'company_verification':
          result = await this.verifyCompany({ companyId: payload.companyId, verifiedBy: payload.verifiedBy, requestId });
          await publishJobEvent('quality_results', { type, payload: result, requestId });
          break;
        case 'spam_detection':
          result = await this.checkJobSpam({ jobId: payload.jobId, requestId });
          await publishJobEvent('quality_results', { type, payload: result, requestId });
          break;
        case 'salary_verification':
          result = await this.verifySalary({ jobId: payload.jobId, salaryData: payload.salaryData, requestId });
          await publishJobEvent('quality_results', { type, payload: result, requestId });
          break;
        case 'duplicate_application':
          result = await this.checkDuplicateApplication({ userId: payload.userId, jobId: payload.jobId, requestId });
          await publishJobEvent('quality_results', { type, payload: result, requestId });
          break;
        case 'job_quality':
          result = await this.calculateJobQuality({ jobId: payload.jobId, requestId });
          await publishJobEvent('quality_results', { type, payload: result, requestId });
          break;
        default:
          throw new Error(`Unknown task type: ${type}`);
      }
      logger.info(`Processed ${topic} message`, { service: 'quality-trust', requestId });
      return result;
    } catch (error) {
      logger.error(`Error processing ${topic} message: ${error.message}`, { service: 'quality-trust', requestId });
      throw error;
    }
  }

  async verifyCompany({ companyId, verifiedBy, requestId }) {
    const operation = "company_verification";
    try {
      const latency = serviceLatency.startTimer({ operation });
      logger.info(`[${requestId}] Starting company verification`, { companyId });

      const company = await Company.findById(companyId).lean();
      if (!company || company.isDeleted) throw new Error("Company not found");

      const verificationChecks = await this.runCompanyVerificationChecks(company, requestId);
      const verification = await QualityTrust.create({
        type: "company_verification",
        companyId,
        verifiedBy,
        verificationChecks,
        status: verificationChecks.overall.passed ? "verified" : "pending",
        verifiedAt: new Date(),
      });

      await Company.updateOne(
        { _id: companyId },
        {
          isVerified: verificationChecks.overall.passed,
          verifiedBadge: verificationChecks.overall.passed,
          verificationId: verification._id,
          lastVerificationCheck: new Date(),
        }
      );

      const result = {
        companyId: companyId.toString(),
        isVerified: verificationChecks.overall.passed,
        verification: verification.toObject(),
        checks: verificationChecks,
      };

      await redisClient.setex(
        `company_verification:${companyId}`,
        CACHE_TTL.COMPANY_VERIFICATION,
        JSON.stringify(result)
      );

      logger.info(`[${requestId}] Company verification completed`, { companyId, duration: Date.now() });
      latency();
      return result;
    } catch (error) {
      serviceErrors.inc({ operation });
      logger.error(`[${requestId}] Company verification failed: ${error.message}`, { companyId, error: error.stack });
      throw error;
    }
  }

  async checkJobSpam({ jobId, requestId }) {
    const operation = "spam_detection";
    try {
      const latency = serviceLatency.startTimer({ operation });
      logger.info(`[${requestId}] Starting spam check`, { jobId });

      const job = await Job.findById(jobId).populate("companyId").lean();
      if (!job || job.isDeleted) throw new Error("Job not found");

      const spamChecks = await this.runSpamDetection(job, requestId);
      const spamScore = this.calculateSpamScore(spamChecks);
      const isSpam = spamScore > 0.7;

      const verification = await QualityTrust.create({
        type: "spam_check",
        jobId,
        spamScore,
        isSpam,
        checks: spamChecks,
        checkedAt: new Date(),
      });

      if (isSpam) {
        await Job.updateOne({ _id: jobId }, { isSpam: true, spamScore, flaggedAt: new Date() });
      }

      const result = {
        jobId: jobId.toString(),
        isSpam,
        confidence: spamScore,
        checks: spamChecks,
        verification: verification.toObject(),
      };

      await redisClient.setex(`job_spam:${jobId}`, CACHE_TTL.JOB_SPAM, JSON.stringify(result));

      logger.info(`[${requestId}] Spam check completed`, { jobId, spamScore, duration: Date.now() });
      latency();
      return result;
    } catch (error) {
      serviceErrors.inc({ operation });
      logger.error(`[${requestId}] Spam check failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  async verifySalary({ jobId, salaryData, requestId }) {
    const operation = "salary_verification";
    try {
      const latency = serviceLatency.startTimer({ operation });
      logger.info(`[${requestId}] Starting salary verification`, { jobId });

      const job = await Job.findById(jobId).lean();
      if (!job || job.isDeleted) throw new Error("Job not found");

      const marketData = await this.getMarketSalaryData({
        title: job.title,
        location: job.location,
        experience: job.experienceLevel,
        skills: job.skills,
      });

      const verification = await this.compareSalaryToMarket(salaryData, marketData, requestId);
      const verificationRecord = await QualityTrust.create({
        type: "salary_verification",
        jobId,
        providedSalary: salaryData,
        marketData,
        verification,
        verifiedAt: new Date(),
      });

      await Job.updateOne({ _id: jobId }, { salaryVerified: verification.isValid });

      const result = {
        jobId: jobId.toString(),
        isVerified: verification.isValid,
        confidence: verification.confidence,
        marketComparison: verification.comparison,
        verification: verificationRecord.toObject(),
      };

      await redisClient.setex(
        `salary_verification:${jobId}`,
        CACHE_TTL.SALARY_VERIFICATION,
        JSON.stringify(result)
      );

      logger.info(`[${requestId}] Salary verification completed`, { jobId, duration: Date.now() });
      latency();
      return result;
    } catch (error) {
      serviceErrors.inc({ operation });
      logger.error(`[${requestId}] Salary verification failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  async checkDuplicateApplication({ userId, jobId, requestId }) {
    const operation = "duplicate_application";
    try {
      const latency = serviceLatency.startTimer({ operation });
      logger.info(`[${requestId}] Checking duplicate application`, { userId, jobId });

      const job = await Job.findById(jobId).lean();
      if (!job || job.isDeleted) throw new Error("Job not found");

      const existingApplication = await jobApplication.findOne({
        userId,
        jobId,
        status: { $ne: "withdrawn" },
      }).lean();

      const similarApplications = await jobApplication.find({
        userId,
        companyId: job.companyId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).lean();

      const isDuplicate = !!existingApplication;
      const hasSimilarRecent = similarApplications.length > 0;

      const verification = await QualityTrust.create({
        type: "duplicate_check",
        userId,
        jobId,
        isDuplicate,
        hasSimilarRecent,
        existingApplications: existingApplication ? [existingApplication._id] : [],
        similarApplications: similarApplications.map((app) => app._id),
        checkedAt: new Date(),
      });

      const result = {
        userId: userId.toString(),
        jobId: jobId.toString(),
        isDuplicate,
        hasSimilarRecent,
        existingApplication: existingApplication ? existingApplication._id.toString() : null,
        similarCount: similarApplications.length,
        recommendation: this.getDuplicateRecommendation(isDuplicate, hasSimilarRecent),
        verification: verification.toObject(),
      };

      await redisClient.setex(
        `duplicate_application:${userId}:${jobId}`,
        CACHE_TTL.DUPLICATE_APPLICATION,
        JSON.stringify(result)
      );

      logger.info(`[${requestId}] Duplicate check completed`, { userId, jobId, isDuplicate, duration: Date.now() });
      latency();
      return result;
    } catch (error) {
      serviceErrors.inc({ operation });
      logger.error(`[${requestId}] Duplicate check failed: ${error.message}`, { userId, jobId, error: error.stack });
      throw error;
    }
  }

  async calculateJobQuality({ jobId, requestId }) {
    const operation = "job_quality";
    try {
      const latency = serviceLatency.startTimer({ operation });
      logger.info(`[${requestId}] Calculating job quality`, { jobId });

      const job = await Job.findById(jobId).populate("companyId").lean();
      if (!job || job.isDeleted) throw new Error("Job not found");

      const qualityMetrics = await this.assessJobQuality(job, requestId);
      const overallScore = this.calculateOverallQualityScore(qualityMetrics);

      const verification = await QualityTrust.create({
        type: "quality_assessment",
        jobId,
        metrics: qualityMetrics,
        overallScore,
        assessedAt: new Date(),
      });

      await Job.updateOne({ _id: jobId }, { qualityScore: overallScore, lastQualityCheck: new Date() });

      const result = {
        jobId: jobId.toString(),
        score: overallScore,
        grade: this.getQualityGrade(overallScore),
        metrics: qualityMetrics,
        recommendations: this.getQualityRecommendations(qualityMetrics),
        verification: verification.toObject(),
      };

      await redisClient.setex(`job_quality:${jobId}`, CACHE_TTL.JOB_QUALITY, JSON.stringify(result));

      logger.info(`[${requestId}] Job quality calculated`, { jobId, score: overallScore, duration: Date.now() });
      latency();
      return result;
    } catch (error) {
      serviceErrors.inc({ operation });
      logger.error(`[${requestId}] Job quality calculation failed: ${error.message}`, { jobId, error: error.stack });
      throw error;
    }
  }

  async getCompanyVerification({ companyId, requestId }) {
    const operation = "get_company_verification";
    try {
      const latency = serviceLatency.startTimer({ operation });
      logger.info(`[${requestId}] Getting company verification status`, { companyId });

      const company = await Company.findById(companyId).lean();
      if (!company || company.isDeleted) throw new Error("Company not found");

      let verification = null;
      if (company.verificationId) {
        verification = await QualityTrust.findOne({ _id: company.verificationId, type: "company_verification" }).lean();
      }

      const result = {
        companyId: companyId.toString(),
        isVerified: company.isVerified || false,
        verificationDate: company.lastVerificationCheck,
        verification,
        badgeLevel: this.getVerificationBadgeLevel(company, verification),
      };

      await redisClient.setex(
        `company_verification_status:${companyId}`,
        CACHE_TTL.COMPANY_VERIFICATION,
        JSON.stringify(result)
      );

      logger.info(`[${requestId}] Company verification status retrieved`, { companyId, duration: Date.now() });
      latency();
      return result;
    } catch (error) {
      serviceErrors.inc({ operation });
      logger.error(`[${requestId}] Get verification status failed: ${error.message}`, { companyId, error: error.stack });
      throw error;
    }
  }

  async runCompanyVerificationChecks(company, requestId) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Verify company: ${JSON.stringify({
      name: company.name,
      domain: company.domain,
      address: company.address,
      socialProfiles: company.socialProfiles,
    })}. Check business registration, website, social media, employee count, and address. Return { checks: object, overall: { passed: boolean, score: number } }.`;

    const retry = async (fn, retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === retries - 1) throw new Error(`Gemini API failed: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    };

    const result = await retry(() => model.generateContent(prompt));
    const checks = JSON.parse(sanitizeInput(result.response.text()));

    const passedChecks = Object.values(checks.checks).filter((check) => check.passed).length;
    const totalChecks = Object.keys(checks.checks).length;

    checks.overall = {
      passed: passedChecks >= Math.ceil(totalChecks * 0.6),
      score: (passedChecks / totalChecks) * 100,
      passedChecks,
      totalChecks,
    };

    return checks;
  }

  async runSpamDetection(job, requestId) {
    const checks = await Promise.all([
      this.checkDuplicateJobContent(job),
      this.checkSuspiciousKeywords(job),
      this.checkUnrealisticSalary(job),
      this.assessDescriptionQuality(job),
      this.checkCompanyReputation(job.companyId),
      this.validateContactInformation(job),
    ]);

    return {
      duplicateContent: checks[0],
      suspiciousKeywords: checks[1],
      unrealisticSalary: checks[2],
      descriptionQuality: checks[3],
      companyReputation: checks[4],
      contactInformation: checks[5],
    };
  }

  calculateSpamScore(checks) {
    const weights = {
      duplicateContent: 0.25,
      suspiciousKeywords: 0.15,
      unrealisticSalary: 0.20,
      descriptionQuality: 0.15,
      companyReputation: 0.15,
      contactInformation: 0.10,
    };

    let score = 0;
    Object.keys(weights).forEach((check) => {
      if (checks[check]?.isSpam) {
        score += weights[check] * (checks[check].confidence || 1);
      }
    });

    return Math.min(score, 1.0);
  }

  async getMarketSalaryData({ title, location, experience, skills }) {
    const cacheKey = `market_salary:${title}:${location}:${experience}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    // Replace with real API (e.g., Glassdoor)
    const response = await axios.get(
      `https://api.glassdoor.com/salary?title=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}&experience=${experience}`,
      { timeout: 5000 }
    ).catch(() => ({
      data: {
        min: 70000,
        max: 120000,
        median: 95000,
        currency: "USD",
        source: "mock",
      },
    }));

    const marketData = {
      minSalary: response.data.min,
      maxSalary: response.data.max,
      medianSalary: response.data.median,
      currency: response.data.currency,
      dataSource: response.data.source,
      confidence: response.data.source === "mock" ? 0.5 : 0.9,
    };

    await redisClient.setex(cacheKey, CACHE_TTL.SALARY_VERIFICATION, JSON.stringify(marketData));
    return marketData;
  }

  async compareSalaryToMarket(providedSalary, marketData, requestId) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Compare provided salary: ${JSON.stringify(providedSalary)} with market data: ${JSON.stringify(marketData)}. Return { isValid: boolean, confidence: number, comparison: object, reasons: array }.`;

    const retry = async (fn, retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === retries - 1) throw new Error(`Gemini API failed: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    };

    const result = await retry(() => model.generateContent(prompt));
    return JSON.parse(sanitizeInput(result.response.text()));
  }

  getDuplicateRecommendation(isDuplicate, hasSimilarRecent) {
    if (isDuplicate) {
      return { action: "block", message: "You have already applied to this position" };
    } else if (hasSimilarRecent) {
      return { action: "warn", message: "You recently applied to a similar position at this company" };
    }
    return { action: "allow", message: "Application can proceed" };
  }

  async assessJobQuality(job, requestId) {
    const checks = await Promise.all([
      this.assessDescriptionQuality(job),
      this.assessCompanyInformation(job.companyId),
      this.assessSalaryTransparency(job),
      this.assessRequirementsClarity(job),
      this.assessContactInformation(job),
      this.assessApplicationProcess(job),
    ]);

    return {
      descriptionQuality: checks[0],
      companyInformation: checks[1],
      salaryTransparency: checks[2],
      requirementsClarity: checks[3],
      contactInformation: checks[4],
      applicationProcess: checks[5],
    };
  }

  calculateOverallQualityScore(metrics) {
    const weights = {
      descriptionQuality: 0.25,
      companyInformation: 0.20,
      salaryTransparency: 0.15,
      requirementsClarity: 0.20,
      contactInformation: 0.10,
      applicationProcess: 0.10,
    };

    let totalScore = 0;
    Object.keys(weights).forEach((metric) => {
      totalScore += (metrics[metric]?.score || 0) * weights[metric];
    });

    return Math.round(totalScore);
  }

  getQualityGrade(score) {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    return "D";
  }

  getQualityRecommendations(metrics) {
    const recommendations = [];
    Object.keys(metrics).forEach((key) => {
      if (metrics[key].score < 70) {
        recommendations.push({
          area: key,
          suggestion: metrics[key].suggestion || `Improve ${key}`,
          priority: metrics[key].score < 50 ? "high" : "medium",
        });
      }
    });
    return recommendations;
  }

  getVerificationBadgeLevel(company, verification) {
    if (!company.isVerified) return "none";
    if (verification && verification.checks.overall.score >= 90) return "gold";
    if (verification && verification.checks.overall.score >= 70) return "silver";
    return "bronze";
  }

  async checkBusinessRegistration(company) {
    try {
      const response = await axios.get(
        `https://api.business-registry.com/verify?name=${encodeURIComponent(company.name)}`,
        { timeout: 5000 }
      );
      return {
        passed: response.data.isRegistered,
        confidence: 0.9,
        details: response.data.details,
      };
    } catch (error) {
      return { passed: false, confidence: 0.3, details: "Registration check failed" };
    }
  }

  async verifyCompanyWebsite(company) {
    try {
      const response = await axios.get(`https://${company.domain}`, { timeout: 5000 });
      return {
        passed: response.status === 200,
        confidence: 0.8,
        details: `Website ${company.domain} is accessible`,
      };
    } catch (error) {
      return { passed: false, confidence: 0.4, details: `Website ${company.domain} is inaccessible` };
    }
  }

  async checkSocialMediaPresence(company) {
    const profiles = company.socialProfiles || [];
    const validProfiles = await Promise.all(
      profiles.map(async (url) => {
        try {
          await axios.get(url, { timeout: 5000 });
          return true;
        } catch {
          return false;
        }
      })
    );
    return {
      passed: validProfiles.some((v) => v),
      confidence: validProfiles.filter((v) => v).length / Math.max(profiles.length, 1),
      details: `Valid profiles: ${validProfiles.filter((v) => v).length}/${profiles.length}`,
    };
  }

  async verifyEmployeeCount(company) {
    return {
      passed: company.employeeCount >= 10,
      confidence: company.employeeCount >= 10 ? 0.8 : 0.5,
      details: `Employee count: ${company.employeeCount}`,
    };
  }

  async verifyBusinessAddress(company) {
    return {
      passed: !!company.address,
      confidence: company.address ? 0.9 : 0.2,
      details: company.address ? `Address: ${company.address}` : "No address provided",
    };
  }

  async checkDuplicateJobContent(job) {
    const cacheKey = `duplicate_job:${job._id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const similarJobs = await Job.find({
      companyId: { $ne: job.companyId },
      description: { $regex: job.description.slice(0, 100), $options: "i" },
      isDeleted: false,
    }).lean();

    const result = {
      isSpam: similarJobs.length > 0,
      confidence: similarJobs.length > 0 ? 0.8 : 0.2,
      details: similarJobs.length > 0 ? `Found ${similarJobs.length} similar jobs` : "No duplicates",
    };

    await redisClient.setex(cacheKey, CACHE_TTL.JOB_SPAM, JSON.stringify(result));
    return result;
  }

  checkSuspiciousKeywords(job) {
    const suspiciousWords = [
      "urgent",
      "immediate start",
      "no experience required",
      "work from home",
      "easy money",
      "guaranteed income",
    ];

    const description = (job.description || "").toLowerCase();
    const foundSuspicious = suspiciousWords.filter((word) => description.includes(word));

    return {
      isSpam: foundSuspicious.length > 2,
      confidence: Math.min(foundSuspicious.length * 0.3, 1.0),
      keywords: foundSuspicious,
    };
  }

  async checkUnrealisticSalary(job) {
    const salary = job.salaryRange || { min: 0, max: 0 };
    const marketData = await this.getMarketSalaryData({
      title: job.title,
      location: job.location,
      experience: job.experienceLevel,
      skills: job.skills,
    });

    const isUnrealistic = salary.max > marketData.maxSalary * 2 || salary.min < marketData.minSalary * 0.5;
    return {
      isSpam: isUnrealistic,
      confidence: isUnrealistic ? 0.9 : 0.3,
      details: isUnrealistic ? "Salary outside market range" : "Salary within market range",
    };
  }

  assessDescriptionQuality(job) {
    const description = job.description || "";
    let score = 0;
    const issues = [];

    if (description.length > 200) score += 20;
    else issues.push("Description too short");

    const sections = ["responsibilities", "requirements", "qualifications"];
    const foundSections = sections.filter((section) => description.toLowerCase().includes(section));
    score += (foundSections.length / sections.length) * 30;

    const commonErrors = ["recieve", "seperate", "occured"];
    const hasErrors = commonErrors.some((error) => description.includes(error));
    if (!hasErrors) score += 25;

    if (description.includes("years of experience") && description.includes("skills")) score += 25;

    return {
      score: Math.min(score, 100),
      issues,
      suggestion: issues.length > 0 ? "Improve job description content and structure" : null,
    };
  }

  async checkCompanyReputation(companyId) {
    const company = await Company.findById(companyId).lean();
    return {
      isSpam: !company.isVerified,
      confidence: company.isVerified ? 0.2 : 0.8,
      details: company.isVerified ? "Company verified" : "Company not verified",
    };
  }

  validateContactInformation(job) {
    const hasContact = !!(job.contactEmail || job.contactPhone);
    return {
      isSpam: !hasContact,
      confidence: hasContact ? 0.2 : 0.7,
      details: hasContact ? "Contact information provided" : "No contact information",
    };
  }

  async assessCompanyInformation(companyId) {
    const company = await Company.findById(companyId).lean();
    let score = 0;
    const issues = [];

    if (company.description) score += 30;
    else issues.push("Missing company description");

    if (company.website) score += 30;
    else issues.push("Missing company website");

    if (company.isVerified) score += 40;

    return {
      score,
      issues,
      suggestion: issues.length > 0 ? "Complete company profile" : null,
    };
  }

  assessSalaryTransparency(job) {
    const hasSalary = !!(job.salaryRange?.min && job.salaryRange?.max);
    return {
      score: hasSalary ? 80 : 20,
      suggestion: hasSalary ? null : "Provide salary range",
    };
  }

  assessRequirementsClarity(job) {
    const hasSkills = job.skills?.length > 0;
    const hasExperience = !!job.experienceLevel;
    let score = 0;
    const issues = [];

    if (hasSkills) score += 50;
    else issues.push("Missing required skills");

    if (hasExperience) score += 50;
    else issues.push("Missing experience level");

    return {
      score,
      issues,
      suggestion: issues.length > 0 ? "Specify skills and experience requirements" : null,
    };
  }

  assessContactInformation(job) {
    const hasContact = !!(job.contactEmail || job.contactPhone);
    return {
      score: hasContact ? 80 : 20,
      suggestion: hasContact ? null : "Provide contact information",
    };
  }

  assessApplicationProcess(job) {
    const hasApplyLink = !!job.applyLink;
    return {
      score: hasApplyLink ? 80 : 20,
      suggestion: hasApplyLink ? null : "Provide clear application instructions",
    };
  }

  async processTask(payload, requestId) {
    // Implement your task processing logic
    logger.info(`Processing task for request ${requestId}`, { service: 'quality-trust', payload });
    return { result: 'processed', data: payload }; // Example
  }
}

export const qualityTrustService = new QualityTrustService();