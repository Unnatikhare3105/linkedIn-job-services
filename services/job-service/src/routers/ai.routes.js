import express from "express";
import * as controllers from "../controllers/ai.controller.js";
import { authenticate } from "../auth.js";

const router = express.Router();

router.post(
  "/resume/optimize",
   authenticate,
   controllers.optimizeResumeController
  );

router.get(
  "/jobs/matches", 
  authenticate,
   controllers.getJobMatchesController
  );

router.post(
  "/jobs/analyze", 
  authenticate,
   controllers.analyzeJobDescriptionController
  );

router.post(
  "/open-to-work", 
  authenticate,
   controllers.updateOpenToWorkController
  );

router.post(
  "/applicants/featured", 
  authenticate,
   controllers.setFeaturedApplicantController
  );

router.post(
  "/messages/direct", 
  authenticate,
   controllers.sendDirectMessageController
  );

router.get(
  "/applicants/top-jobs", 
  authenticate,
   controllers.getTopApplicantJobsController
  );

router.post(
  "/company/verify", 
  authenticate,
   controllers.verifyCompanyController
  );

router.post(
  "/jobs/salary/verify", 
  authenticate,
   controllers.verifySalaryController
  );

router.post(
  "/applications/duplicate", 
  authenticate,
   controllers.detectDuplicateApplicationController
  );

router.post(
  "/jobs/quality", 
  authenticate,
   controllers.calculateJobQualityScoreController
  );

router.post(
  "/jobs/spam", 
  authenticate,
   controllers.detectSpamJobController
  );


export default router;