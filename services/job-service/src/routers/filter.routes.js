import express from "express";
const router = express.Router();
import {authenticate} from "../middlewares/auth.js"
import * as controllers from "../controllers/filter.controllers.js";
import { filterRateLimit } from "../config/rate.limiter.js";

router.get(
    "/filters",
    authenticate,
    filterRateLimit,
    controllers.searchAndFilterJobs
);
router.get(
    "/suggestions",
    authenticate,
    filterRateLimit,
    controllers.getFilterSuggestions
);
router.get(
    "/popular",
    authenticate,
    filterRateLimit,
    controllers.getPopularFilters
);
router.get(
    "/filter-count",
    authenticate,
    filterRateLimit,
    controllers.getFilterCounts
);
router.get(
    '/save',
    authenticate,
    filterRateLimit,
    controllers.saveSearchQuery
);
router.get(
    '/advancedBoolean',
    authenticate,
    filterRateLimit,
    controllers.advancedBooleanSearch
);


export default router;