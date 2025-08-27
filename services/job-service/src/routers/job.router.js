import express from "express";
const router = express.Router();
import * as jobController from "../controllers/jobs.controller.js";

router.post("/jobs", jobController.createJobController);
router.get("/jobs/:jobId", jobController.getJobByIdController);
router.put("/jobs/:jobId", jobController.updateJobController);
router.delete("/jobs/:jobId", jobController.deleteJobController);
router.get("/jobs", jobController.listJobsController);
router.get("/jobs/featured", jobController.featuredJobsController);

export default router;