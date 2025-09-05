import Joi from "joi";

export const validateCompanyId = (data) =>
  Joi.object({
    companyId: Joi.string().uuid().required(),
  }).validate(data);

export const validateReviewInput = (data) =>
  Joi.object({
    userId: Joi.string().uuid().required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(1000).required(),
    role: Joi.string().max(100).required(),
    tenure: Joi.string().max(50).required(),
  }).validate(data);

export const validatePaginationParams = (data) =>
  Joi.object({
    cursor: Joi.string().optional(),
    limit: Joi.number().min(1).max(100).default(20),
  }).validate(data);