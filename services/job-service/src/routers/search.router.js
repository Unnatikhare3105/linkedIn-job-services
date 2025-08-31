import express from 'express';
const router = express.Router();
import { authenticate } from "../auth.js"
import * as searchRouter from "../controllers/search.controller.js";

router.get(
    '/title',
    authenticate,
    searchRouter.searchJobsByTitle
);

router.get(
    "/company",
    authenticate,
    searchRouter.searchJobsByCompany
);

router.get(
    '/skills',
    authenticate,
    searchRouter.searchJobsBySkills
);

router.get(
    "/keyword",
    authenticate,
    searchRouter.searchJobsByKeyword
);

router.get(
    "/auto-complete",
    authenticate,
    searchRouter.getAutoCompleteSuggestions
);

router.get(
    '/recent-searches',
    authenticate,
    searchRouter.getRecentSearches
);

router.get(
    "/location",
    authenticate,
    searchRouter.searchJobsByLocation
);

router.get(
    "/suggestions",
    authenticate,
    searchRouter.getSearchSuggestions
);

router.get(
    "/any",
    authenticate,
    searchRouter.searchJobsAnyField
);

router.get(
    "/trending",
    authenticate,
    searchRouter.getTrendingSearches
);

router.get(
    "/saved",
    authenticate,
    searchRouter.getSavedSearches
);

router.get(
    "/exclude",
    authenticate,
    searchRouter.searchJobsExcludeKeywords
);

router.get(
    "/natural",
    authenticate,
    searchRouter.searchJobsNaturalLanguage
);

router.get(
    "/history",
    authenticate,
    searchRouter.getSearchHistory
);

router.get(
    "/similar",
    authenticate,
    searchRouter.searchSimilarJobs
);

router.get(
    "/exact",
    authenticate,
    searchRouter.searchJobsExactPhrase
);

export default router;
