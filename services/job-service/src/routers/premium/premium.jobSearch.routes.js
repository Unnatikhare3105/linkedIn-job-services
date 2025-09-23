import express from 'express';
import { createValidationMiddleware } from "../../middlewares/require.premium.js";
import { authenticate} from "../../middlewares/auth.js";
import * as controllers from '../../controllers/premium/premiumJobSearch.controller.js';

  const router = express.Router();  


router.get(
    '/boolean',
    authenticate,
    createValidationMiddleware,
    controllers.booleanSearchController
);
  router.get(
    '/network',
    authenticate,
    createValidationMiddleware,
    controllers.networkJobsController
);
  router.get(
    '/alumni',
    authenticate,
    createValidationMiddleware,
    controllers.alumniJobsController
);
  router.get(
    '/trending',
    authenticate,
    createValidationMiddleware,
    controllers.trendingJobsController
);
  router.get(
    '/new-grad',
    authenticate,
    createValidationMiddleware,
    controllers.newGradJobsController
);
  router.get(
    '/senior',
    authenticate,
    createValidationMiddleware,
    controllers.seniorJobsController
);
  router.get(
    '/contract-freelance',
    authenticate,
    createValidationMiddleware,
    controllers.contractJobsController
);
  router.get(
    '/startup',
    authenticate,
    createValidationMiddleware,
    controllers.startupJobsController
);
  router.get(
    '/fortune500',
    authenticate,
    createValidationMiddleware,
    controllers.fortune500JobsController
);
  router.get(
    '/no-experience',
    authenticate,
    createValidationMiddleware,
    controllers.noExperienceJobsController
);
  router.get(
    '/suggestions',
    authenticate,
    createValidationMiddleware,
    controllers.searchSuggestionsController
);

//   router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  export default router;