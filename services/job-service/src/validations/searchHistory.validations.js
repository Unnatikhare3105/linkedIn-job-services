import Joi from "joi";

export const createSearchHistorySchema = Joi.object({
  query: Joi.string().min(1).max(500).required(),
  type: Joi.string().valid('location', 'company', 'keyword', 'title', 'natural').required(),
  filters: Joi.object({
    skills: Joi.array().items(
      Joi.object({
        name: Joi.string().max(50).pattern(/^[a-zA-Z0-9\s\-\.+#]+$/).optional(),
        weight: Joi.number().min(0).max(1).default(0.5),
      })
    ).optional(),
    locations: Joi.array().items(
      Joi.object({
        city: Joi.string().max(100).pattern(/^[a-zA-Z\s\-'\.]+$/).optional().allow(''),
        state: Joi.string().max(50).pattern(/^[a-zA-Z\s\-'\.]+$/).optional().allow(''),
        country: Joi.string().max(50).pattern(/^[a-zA-Z\s\-'\.]+$/).default('India'),
      })
    ).optional(),
    excludeKeywords: Joi.array().items(Joi.string().max(50).pattern(/^[a-zA-Z0-9\s\-\.]+$/)).optional(),
    jobTypes: Joi.array().items(Joi.string().valid('full-time', 'part-time', 'contract', 'freelance', 'internship')).optional(),
    experienceLevels: Joi.array().items(Joi.string().valid('entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive')).optional(),
  }).optional(),
  ip: Joi.string().max(45).pattern(/^([0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/).optional(),
  userAgent: Joi.string().max(500).optional(),
  resultCount: Joi.number().integer().min(0).optional(),
  executionTime: Joi.number().integer().min(0).optional(),
});

export const updateSearchHistorySchema = Joi.object({
  query: Joi.string().min(1).max(500).optional(),
  type: Joi.string().valid('location', 'company', 'keyword', 'title', 'natural').optional(),
  filters: Joi.object({
    skills: Joi.array().items(
      Joi.object({
        name: Joi.string().max(50).pattern(/^[a-zA-Z0-9\s\-\.+#]+$/).optional(),
        weight: Joi.number().min(0).max(1).default(0.5),
      })
    ).optional(),
    locations: Joi.array().items(
      Joi.object({
        city: Joi.string().max(100).pattern(/^[a-zA-Z\s\-'\.]+$/).optional().allow(''),
        state: Joi.string().max(50).pattern(/^[a-zA-Z\s\-'\.]+$/).optional().allow(''),
        country: Joi.string().max(50).pattern(/^[a-zA-Z\s\-'\.]+$/).optional(),
      })
    ).optional(),
    excludeKeywords: Joi.array().items(Joi.string().max(50).pattern(/^[a-zA-Z0-9\s\-\.]+$/)).optional(),
    jobTypes: Joi.array().items(Joi.string().valid('full-time', 'part-time', 'contract', 'freelance', 'internship')).optional(),
    experienceLevels: Joi.array().items(Joi.string().valid('entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive')).optional(),
  }).optional(),
  ip: Joi.string().max(45).pattern(/^([0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/).optional(),
  userAgent: Joi.string().max(500).optional(),
  resultCount: Joi.number().integer().min(0).optional(),
  executionTime: Joi.number().integer().min(0).optional(),
});