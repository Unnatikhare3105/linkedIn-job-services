import express from 'express';
import { requirePremium } from '../../middlewares/require.premium.js'; // Updated path
import { authenticate } from '../../middlewares/auth.js';
import * as controllers from '../../controllers/premium/premium.controller.js';

const router = express.Router();

// Premium Basics
router.get(
    '/access',
     authenticate,
      controllers.checkPremiumAccessController
    );

router.get(
    '/features',
    authenticate,
    controllers.getFeaturesController
);

// Applicant Insights
router.get(
    '/insights/:jobId',
     authenticate,
     requirePremium,
      controllers.getApplicantInsightsController
);

router.get(
    '/competition/:jobId',
     authenticate,
     requirePremium,
      controllers.getCompetitionController
);

// Competitive Analysis
router.post(
    '/competition/:jobId',
     authenticate,
     requirePremium,
      controllers.analyzeCompetitionController
    );

router.get(
    '/benchmark',
     authenticate,
     requirePremium,
      controllers.getBenchmarkController
    );

// InMail Credits
router.get(
    '/inmail/credits',
    authenticate,
    requirePremium,
    controllers.getCreditsController
);

router.post(
    '/inmail/send',
    authenticate,
    requirePremium,
    controllers.sendInmailController
);

router.get(
    '/inmail/can-send',
    authenticate,
    requirePremium,
    controllers.checkInmailController
);

router.post(
    '/inmail/refill',
    authenticate,
    requirePremium,
    controllers.refillCreditsController
);

// Interview Preparation
router.get(
    '/interview/questions/:jobId',
    authenticate,
    requirePremium,
    controllers.getQuestionsController
);

router.post(
    '/interview/prep/:jobId',
    authenticate,
    requirePremium,
    controllers.generatePrepController
);

router.post(
    '/interview/progress/:jobId',
    authenticate,
    requirePremium,
    controllers.updateProgressController
);

router.get(
    '/interview/tips',
    authenticate,
    requirePremium,
    controllers.getTipsController
);

// Utility
router.get(
    '/limit/:feature',
    authenticate,
    requirePremium,
    controllers.checkLimitController
);

router.get(
    '/analytics',
    authenticate,
    requirePremium,
    controllers.getAnalyticsController
);

export default router;