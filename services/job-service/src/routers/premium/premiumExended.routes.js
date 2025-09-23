import express from "express";
import { requirePremium } from "../../middlewares/require.premium.js";
import { authenticate } from "../../middlewares/auth.js";
import * as controllers from "../../controllers/premium/premiumExtended.controller.js";
import * as rateLimiters from "../../config/premium.rate.limiter.js";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100000000 },
}); // 100MB max

// Follow-up Reminders
router.post(
  "/follow-ups",
  authenticate,
  requirePremium,
  rateLimiters.createFollowUpReminderRateLimit,
  controllers.createFollowUpReminderController
);
router.get(
  "/follow-ups",
  authenticate,
  requirePremium,
  rateLimiters.getFollowUpRemindersRateLimit,
  controllers.getFollowUpRemindersController
);

// Interview Tracking
router.post(
  "/interviews",
  authenticate,
  requirePremium,
  rateLimiters.createInterviewRateLimit,
  controllers.createInterviewController
);

router.patch(
  "/interviews/:interviewId/status",
  authenticate,
  requirePremium,
  rateLimiters.updateInterviewStatusRateLimit,
  controllers.updateInterviewStatusController
);

// Offer Management
router.post(
  "/offers",
  authenticate,
  requirePremium,
  rateLimiters.createOfferRateLimit,
  controllers.createOfferController
);

router.post(
  "/offers/compare",
  authenticate,
  requirePremium,
  rateLimiters.compareOffersRateLimit,
  controllers.compareOffersController
);

// Application Notes
router.post(
  "/notes",
  authenticate,
  requirePremium,
  rateLimiters.createApplicationNoteRateLimit,
  controllers.createApplicationNoteController
);

router.get(
  "/notes/:applicationId",
  authenticate,
  requirePremium,
  rateLimiters.getApplicationNotesRateLimit,
  controllers.getApplicationNotesController
);

// Batch Applications
router.post(
  "/batch-applications",
  authenticate,
  requirePremium,
  rateLimiters.createBatchApplicationRateLimit,
  controllers.createBatchApplicationController
);

// Application Templates
router.post(
  "/templates",
  authenticate,
  requirePremium,
  rateLimiters.createApplicationTemplateRateLimit,
  controllers.createApplicationTemplateController
);

// Quick Apply Settings
router.patch(
  "/quick-apply",
  authenticate,
  requirePremium,
  rateLimiters.updateQuickApplySettingsRateLimit,
  controllers.updateQuickApplySettingsController
);

// Application Scoring
router.get(
  "/scoring/:applicationId",
  authenticate,
  requirePremium,
  rateLimiters.calculateApplicationScoreRateLimit,
  controllers.calculateApplicationScoreController
);

// Application Export
router.post(
  "/export",
  authenticate,
  requirePremium,
  rateLimiters.exportApplicationDataRateLimit,
  controllers.exportApplicationDataController
);

// Thank You Note
router.post(
  "/thank-you",
  authenticate,
  requirePremium,
  rateLimiters.createThankYouNoteRateLimit,
  controllers.createThankYouNoteController
);

// Video Introduction
router.post(
  "/videos",
  authenticate,
  requirePremium,
  upload.single("video"),
  rateLimiters.saveVideoIntroductionRateLimit,
  controllers.saveVideoIntroductionController
);

// Portfolio Attachment
router.post(
  "/portfolio",
  authenticate,
  requirePremium,
  upload.single("file"),
  rateLimiters.savePortfolioAttachmentRateLimit,
  controllers.savePortfolioAttachmentController
);

// Reference Management
router.post(
  "/references",
  authenticate,
  requirePremium,
  rateLimiters.createReferenceRateLimit,
  controllers.createReferenceController
);

export default router;
