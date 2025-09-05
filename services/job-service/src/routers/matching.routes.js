// GET /jobs/:id/match-score

import express from "express";
import {authenticate } from "../auth.js";
import * as controllers from "../controllers/matching.controller.js";
const router = express.Router();

router.get(
    "/:id/match-score",
    authenticate,
    controllers.calculateMatchScoreController
)

router.get(
    "/invitations/:jobId",
    authenticate,
    controllers.sendInvitationToApplyController
)

router



export default router;
