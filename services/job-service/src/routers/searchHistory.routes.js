// src/routes/searchHistory.js
import express from 'express';
import * as controllers from '../controllers/searchHistory.controller.js';
import { authenticate } from '../middlewares/auth.js'; // Adjust path as needed

const router = express.Router();

router.post(
    '/create',
     authenticate,
      controllers.createSearchHistory
    );
router.get(
    '/:searchId',
     authenticate,
      controllers.getSearchHistoryById
);
router.get(
    '/',
     authenticate,
     controllers.getUserSearchHistory
);
router.put(
    '/:searchId',
    authenticate,
    controllers.updateSearchHistory
);
router.delete(
    '/:searchId/soft',
    authenticate,
    controllers.softDeleteSearchHistory
);
router.delete(
    '/:searchId/hard',
    authenticate,
    controllers.hardDeleteSearchHistory
); // Add admin middleware if needed

export default router;