import express from "express";
import * as controllers from "../controllers/qualityTrust.controller.js";
import { authenticate } from "../auth.js";
import {
  companyVerificationLimiter,
  jobSpamLimiter,
  salaryVerificationLimiter,
  duplicateApplicationLimiter,
  jobQualityLimiter,
} from "../config/rate.limiter.js";

const router = express.Router();

// Routes
router.get(
  "/company/:companyId/verification",
  authenticate,
  controllers.getCompanyVerificationController
);
router.post(
  "/company/:companyId/verify",
  authenticate,
  companyVerificationLimiter,
  controllers.verifyCompanyController
);
router.post(
  "/job/:jobId/spam",
  authenticate,
  jobSpamLimiter,
  controllers.checkJobSpamController
);
router.post(
  "/job/:jobId/salary",
  authenticate,
  salaryVerificationLimiter,
  controllers.verifySalaryController
);
router.post(
  "/application/duplicate",
  authenticate,
  duplicateApplicationLimiter,
  controllers.checkDuplicateApplicationController
);
router.post(
  "/job/:jobId/quality",
  authenticate,
  jobQualityLimiter,
  controllers.calculateJobQualityController
);

export default router;
