import express from 'express';
import * as middleware from '../../middlewares/premium.professionalDevelopment.js';
import * as controller from '../../controllers/premium/professionalDevelopment.controller.js';
import * as rateLimiter from '../../config/premium.rate.limiter.js';
const router = express.Router();

// Routes
router.post(
  '/skills/analyze',
  rateLimiter.skillsAnalysisLimit,
  middleware.validateSkillsGap,
  controller.analyzeSkillsGapController
);

router.get(
  '/skills/gap',
   rateLimiter.generalLimit,
    controller.getSkillsGapAnalysisController
);

router.post(
  '/career/path',
  rateLimiter.generalLimit,
  middleware.validateCareerPath,
  controller.generateCareerPathController
);

router.get(
  '/career/suggestions',
   rateLimiter.generalLimit,
   controller.getCareerPathSuggestionsController
);

router.post(
  '/assessments',
  rateLimiter.assessmentLimit,
  middleware.validateAssessment,
  controller.createSkillAssessmentController
);

router.post(
  '/assessments/:id/submit',
  rateLimiter.assessmentLimit,
  middleware.validateUUID,
  controller.submitAssessmentController
);

router.post(
  '/certifications',
  rateLimiter.generalLimit,
  middleware.validateCertification,
  controller.addCertificationController
);

router.get(
  '/certifications',
  rateLimiter.generalLimit,
  controller.getCertificationsController
);

router.post(
  '/linkedin/connect',
  rateLimiter.generalLimit,
  middleware.validateLinkedIn,
  controller.connectLinkedInLearningController
);

router.post(
  '/linkedin/sync',
  rateLimiter.generalLimit,
  controller.syncLinkedInCoursesController
);

router.post(
  '/interviews/mock',
  rateLimiter.interviewLimit,
  middleware.validateInterview,
  controller.scheduleMockInterviewController
);

router.post(
  '/interviews/:id/complete',
  rateLimiter.interviewLimit,
  middleware.validateUUID,
  controller.completeMockInterviewController
);

router.post(
  '/resume/review',
  rateLimiter.resumeLimit,
  middleware.validateResume,
  controller.submitResumeForReviewController
);

router.get(
  '/resume/review/:id',
  rateLimiter.generalLimit,
  middleware.validateUUID,
  controller.getResumeReviewController
);

router.post(
  '/coaching/schedule',
  rateLimiter.coachingLimit,
  middleware.validateCoaching,
  controller.scheduleCoachingSessionController
);

router.get(
  '/coaching/plan',
  rateLimiter.generalLimit,
  controller.getCoachingPlanController
);

router.post(
  '/salary/benchmark',
  rateLimiter.salaryLimit,
  middleware.validateSalary,
  controller.analyzeSalaryBenchmarkController
);

router.get(
  '/salary/tips/:level/:industry',
  rateLimiter.generalLimit,
  controller.getNegotiationTipsController
);

router.post(
  '/market/report',
  rateLimiter.reportLimit,
  middleware.validateReport,
  controller.generateMarketReportController
);

router.get(
  '/market/report/:id',
  rateLimiter.generalLimit,
  middleware.validateUUID,
  controller.getMarketReportController
);

export default router;
