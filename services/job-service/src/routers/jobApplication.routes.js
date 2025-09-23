import * as Controllers from "../controllers/jobApplication.controller.js";
import express from "express";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.post(
    "/:jobId/apply", 
    authenticate,
     Controllers.applyToJob
    );
router.get(
    "/:jobId/applications",
    authenticate,
    Controllers.getApplicationsByJob
);
router.patch(
    "/:applicationId/status",
    authenticate,
    Controllers.updateApplicationStatus
);
router.delete(
    "/:applicationId",
    authenticate,
    Controllers.deleteApplication
);

router.get(
    "/:applicationId/resume",
    authenticate,
    Controllers.selectResumeForApplication
)

router.get(
    "/:applicationId/cover-letter",
    authenticate,
    Controllers.attachCoverLetter
);

export default router;
