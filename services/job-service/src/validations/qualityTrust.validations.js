import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "ObjectId validation");

export const validateCompanyVerification = (data) =>
  Joi.object({
    companyId: objectId.required().messages({
      "any.invalid": "Invalid companyId format",
      "any.required": "companyId is required",
    }),
  }).validate(data);

export const validateJobSpamCheck = (data) =>
  Joi.object({
    jobId: objectId.required().messages({
      "any.invalid": "Invalid jobId format",
      "any.required": "jobId is required",
    }),
  }).validate(data);

export const validateSalaryVerification = (data) =>
  Joi.object({
    jobId: objectId.required().messages({
      "any.invalid": "Invalid jobId format",
      "any.required": "jobId is required",
    }),
    salaryData: Joi.object({
      amount: Joi.number().min(0).required().messages({
        "number.min": "Salary amount cannot be negative",
        "any.required": "Salary amount is required",
      }),
      currency: Joi.string().pattern(/^[A-Z]{3}$/).default("USD").messages({
        "string.pattern.base": "Currency must be a valid ISO 4217 code (e.g., USD, EUR)",
      }),
      period: Joi.string().valid("hourly", "monthly", "yearly").required().messages({
        "any.only": "Salary period must be one of: hourly, monthly, yearly",
        "any.required": "Salary period is required",
      }),
    }).required().messages({
      "any.required": "salaryData is required",
    }),
  }).validate(data);

export const validateDuplicateApplication = (data) =>
  Joi.object({
    jobId: objectId.required().messages({
      "any.invalid": "Invalid jobId format",
      "any.required": "jobId is required",
    }),
  }).validate(data);

export const validateJobQuality = (data) =>
  Joi.object({
    jobId: objectId.required().messages({
      "any.invalid": "Invalid jobId format",
      "any.required": "jobId is required",
    }),
  }).validate(data);