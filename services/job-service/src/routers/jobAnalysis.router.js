import express from "express";
import { authenticate } from "../auth.js";
import  * as controllers from "../controllers/jobAnalysis.controller.js";
const router = express.Router();

router.use(authenticate);


router.post("/:jobId/view", authenticate, controllers.incrementView);

router.post("/:jobId/save", authenticate, controllers.incrementSave);

router.post("/:jobId/analytics", authenticate, controllers.getJobAnalytics);

router.post("/jobs/search/similar", authenticate, controllers.searchSimilarJobs);

export default router;
