import express, { Router } from "express";
const router = express.Router();
import {authenticate } from "../auth.js";
import * as sortController from "../controllers/sort.controller.js";
import { sortRateLimit } from "../config/rate.limiter.js";

router.get(
    "/sort",
    authenticate,
    sortRateLimit,
    sortController.sortJobs
);

router.get(
    "/sortOptions",
    authenticate,
    sortRateLimit,
    sortController.getSortOptionsController
);

router.get(
    "/analytics",
    authenticate,
    sortRateLimit,
    sortController.getSortAnalytics
);

router.get(
    "/createCustom",
    authenticate,
    sortRateLimit,
    sortController.createCustomSort
);

router.get(
    "/compare",
    authenticate,
    sortRateLimit,
    sortController.compareSorts
);

router.get(
    "/sort-recommendations",
    authenticate,
    sortRateLimit,
    sortController.getSmartSortRecommendations
);

router.get(
    "/sort-performance",
    authenticate,
    sortRateLimit,
    sortController.getSortPerformance
);



export default router;