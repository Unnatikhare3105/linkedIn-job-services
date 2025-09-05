import Joi from "joi";

export const validateResumeOptimization = (data) =>
  Joi.object({
    userId: Joi.string().uuid().required(),
    resumeData: Joi.string().required(),
    targetJobId: Joi.string().uuid().required(),
  }).validate(data);

export const validateJobMatching = (data) =>
  Joi.object({
    skills: Joi.array().items(Joi.string()).optional(),
    location: Joi.string().optional(),
    jobType: Joi.string().optional(),
    experienceLevel: Joi.string().optional(),
  }).validate(data);

export const validateJobAnalysis = (data) =>
  Joi.object({
    jobId: Joi.string().uuid().required(),
    description: Joi.string().required(),
  }).validate(data);

export const validateOpenToWork = (data) =>
  Joi.object({
    isOpenToWork: Joi.boolean().required(),
    preferences: Joi.object({
      skills: Joi.array().items(Joi.string()).optional(),
      location: Joi.string().optional(),
      jobType: Joi.string().optional(),
      experienceLevel: Joi.string().optional(),
    }).optional(),
  }).validate(data);

export const validateFeaturedApplicant = (data) =>
  Joi.object({
    applicationId: Joi.string().uuid().required(),
    jobId: Joi.string().uuid().required(),
  }).validate(data);

export const validateDirectMessage = (data) =>
  Joi.object({
    recipientId: Joi.string().uuid().required(),
    message: Joi.string().max(1000).required(),
    jobId: Joi.string().uuid().optional(),
  }).validate(data);

export const validateTopApplicantJobs = (data) =>
  Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
    cursor: Joi.number().integer().min(0).optional(),
  }).validate(data);

export const validateCompanyVerification = (data) =>
  Joi.object({
    companyId: Joi.string().uuid().required(),
    verificationData: Joi.object({
      domain: Joi.string().hostname().required(),
      registration: Joi.string().required(),
      socialProof: Joi.array().items(Joi.string().uri()).optional(),
    }).required(),
  }).validate(data);

export const validateSalaryVerification = (data) =>
  Joi.object({
    jobId: Joi.string().uuid().required(),
    salaryData: Joi.object({
      min: Joi.number().required(),
      max: Joi.number().optional(),
      currency: Joi.string().default("USD"),
    }).required(),
  }).validate(data);

export const validateApplicationDuplicate = (data) =>
  Joi.object({
    userId: Joi.string().uuid().required(),
    jobId: Joi.string().uuid().required(),
    applicationData: Joi.string().required(),
  }).validate(data);