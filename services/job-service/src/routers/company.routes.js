import express from "express";
import * as controllers from "../controllers/company.controller.js";
import { authenticate } from "../middlewares/auth.js";
const router = express.Router();

// Public routes
router.get(
    "/:companyId",
     authenticate, 
     controllers.getCompanyPageController
    );

    router.get(
        "/:id/reviews", 
        authenticate,
        controllers.employeeReviewsController
    );

    router.get(
        "/:companyId/culture",
        authenticate,
        controllers.getCompanyCultureInfoController
    );





// router.get("/", controllers.getAllCompanies);
// router.get("/:id", controllers.getCompanyById);

export default router;
