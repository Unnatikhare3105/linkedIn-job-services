import express from "express";
const router = express.Router();
import * as jobController from "../controllers/jobs.controller.js";
import { authenticate } from "../middlewares/auth.js";

router.post("/create",
    authenticate,
    jobController.createJobController
);
router.get(
    "/:jobId",
     authenticate,
      jobController.getJobByIdController
);
router.put(
    "/update/:jobId",
    authenticate,
    jobController.updateJobController
);
router.delete(
    "/delete/:jobId",
    authenticate,
    jobController.deleteJobController
);
router.get(
    "/list",
    authenticate,
    jobController.listJobsController
);
router.get(
    "/featured",
    authenticate,
    jobController.featuredJobsController
);

router.post(
    "/saveJob",
    authenticate,
    jobController.saveJobsController
)

export default router;