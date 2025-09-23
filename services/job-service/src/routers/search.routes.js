import express from 'express';
const router = express.Router();
import { authenticate } from "../middlewares/auth.js"
import * as searchRouter from "../controllers/search.controller.js";
import { searchRateLimit, autocompleteRateLimit } from "../config/rate.limiter.js"

router.get(
    '/advanced',
    authenticate,
    searchRateLimit,
    searchRouter.advancedJobSearch
);

router.get(
    '/recommendations',
    authenticate,
    searchRateLimit,
    searchRouter.getJobRecommendations
)

router.get(
    '/title',
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsByTitle
);

router.get(
    "/company",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsByCompany
);

router.get(
    '/skills',
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsBySkills
);

router.get(
    "/keyword",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsByKeyword
);

router.get(
    "/auto-complete",
    authenticate,
    autocompleteRateLimit,
    searchRouter.getAutoCompleteSuggestions
);

router.get(
    '/recent-searches',
    authenticate,
    searchRateLimit,
    searchRouter.getRecentSearches
);

router.get(
    "/location",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsByLocation
);

router.get(
    "/suggestions",
    authenticate,
    searchRateLimit,
    searchRouter.getSearchSuggestions
);

router.get(
    "/any",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsAnyField
);

router.get(
    "/trending",
    authenticate,
    searchRateLimit,
    searchRouter.getTrendingSearches
);

router.get(
    "/saved",
    authenticate,
    searchRateLimit,
    searchRouter.getSavedSearches
);

router.get(
    "/exclude",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsExcludeKeywords
);

router.get(
    "/natural",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsNaturalLanguage
);

router.get(
    "/history",
    authenticate,
    searchRateLimit,
    searchRouter.getSearchHistory
);

router.get(
    "/similar/:jobId",
    authenticate,
    searchRateLimit,
    searchRouter.searchSimilarJobs
);

router.get(
    "/exact",
    authenticate,
    searchRateLimit,
    searchRouter.searchJobsExactPhrase
);

router.get(
    "/bulk-search",
    authenticate,
    searchRateLimit,
    searchRouter.bulkSearchJobs
);

router.get(
    "/recently-viewed",
    authenticate,
    searchRateLimit,
    searchRouter.getRecentlyViewedJobs
);

router.get(
    "/offline-job",
    authenticate,
    searchRateLimit,
    searchRouter.getOfflineJobs
);

export default router;
