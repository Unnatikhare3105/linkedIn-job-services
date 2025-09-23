import * as services from "../../services/premium/premium.service.js";
import logger from '../../utils/logger.js';
import CustomError from '../../utils/CustomError.js';
import CustomSuccess from '../../utils/CustomSuccess.js';
import { HTTP_STATUS } from '../../constants/messages.js'; // From your setup

// Check premium access
export const checkPremiumAccessController = async (req, res) => {
  try {
    const hasPremium = await services.hasPremiumAccess(req.user.id);
    if (!hasPremium) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
          new CustomError({
              success: false,
              message: 'Premium access required',
              status: HTTP_STATUS.FORBIDDEN
          })
      );
    }
    returnres.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
            success: true,
            message: 'Premium access verified',
        })
    );
  } catch (err) {
    logger.error(`checkPremiumAccess failed: ${err.message}`, { userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

// Get premium features
export const getFeaturesController = async (req, res) => {
  try {
    const features = await services.getPremiumFeatures(req.user.id);
    if (!features) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'Features not found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: features })
    );
  } catch (err) {
    logger.error(`getFeatures failed: ${err.message}`, { userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

// Applicant Insights
export const getApplicantInsightsController = async (req, res) => {
  try {
    const { jobId } = req.params;
    const insights = await services.getJobApplicantInsights(jobId, req.user.id);
    if (!insights) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'Insights not found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: insights })
    );
  } catch (err) {
    logger.error(
        `getApplicantInsights failed: ${err.message}`, 
        { jobId: req.params.jobId, userId: req.user.id }
    );
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.BAD_REQUEST
        })
    );
  }
};

export const getCompetitionController = async (req, res) => {
  try {
    const { jobId } = req.params;
    const level = await services.getCompetitionLevel(jobId);
    if (!level) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'Competition level not found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: { level } })
    );
  } catch (err) {
    logger.error(`getCompetition failed: ${err.message}`, { jobId: req.params.jobId });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

// Competitive Analysis
export const analyzeCompetitionController = async (req, res) => {
  try {
    const { jobId } = req.params;
    const analysis = await services.analyzeJobCompetition(jobId, req.user.id);
    if (!analysis) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'Analysis not found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: analysis })
    );
  } catch (err) {
    logger.error(`analyzeCompetition failed: ${err.message}`, { jobId: req.params.jobId, userId: req.user.id });
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.BAD_REQUEST
        })
    );
  }
};

export const getBenchmarkController = async (req, res) => {
  try {
    const { title, location, experience } = req.query;
    if (!title || !location || !experience) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
          new CustomError({
              success: false,
              message: 'Missing required query parameters',
              status: HTTP_STATUS.BAD_REQUEST
          })
      );
    }
    const benchmark = await services.getSalaryBenchmark(title, location, experience);
    if (!benchmark) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'Benchmark not found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: benchmark })
    );
  } catch (err) {
    logger.error(`getBenchmark failed: ${err.message}`, { title, location });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

// InMail Credits
export const getCreditsController = async (req, res) => {
  try {
    const credits = await services.getInmailCredits(req.user.id);
    if (credits === null || credits === undefined) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'Credits not found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: credits })
    );
  } catch (err) {
    logger.error(`getCredits failed: ${err.message}`, { userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

export const sendInmailController = async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
          new CustomError({
              success: false,
              message: 'recipientId is required',
              status: HTTP_STATUS.BAD_REQUEST
          })
      );
    }
    const result = await services.useInmailCredit(req.user.id, recipientId);
    if (!result) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
          new CustomError({
              success: false,
              message: result.message,
              status: HTTP_STATUS.BAD_REQUEST
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: result })
    );
  } catch (err) {
    logger.error(`sendInmail failed: ${err.message}`, { userId: req.user.id, recipientId: req.body.recipientId });
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.BAD_REQUEST
        })
    );
  }
};

export const checkInmailController = async (req, res) => {
  try {
    const canSend = await services.canSendInmail(req.user.id);
    if (!canSend) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
          new CustomError({
              success: false,
              message: 'User cannot send InMail',
              status: HTTP_STATUS.FORBIDDEN
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: { canSend } })
    );
  } catch (err) {
    logger.error(`checkInmail failed: ${err.message}`, { userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

export const refillCreditsController = async (req, res) => {
  try {
    const result = await services.refillMonthlyCredits(req.user.id);
    if (!result) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
          new CustomError({
              success: false,
              message: 'Failed to refill credits',
              status: HTTP_STATUS.BAD_REQUEST
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: result })
    );
  } catch (err) {
    logger.error(`refillCredits failed: ${err.message}`, { userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR
        })
    );
  }
};

// Interview Preparation
export const getQuestionsController = async (req, res) => {
  try {
    const { jobId } = req.params;
    const questions = await services.getInterviewQuestions(jobId, req.user.id);
    if (!questions) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
              success: false,
              message: 'No interview questions found',
              status: HTTP_STATUS.NOT_FOUND
          })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true, data: questions })
    );
  } catch (err) {
    logger.error(`getQuestions failed: ${err.message}`, { jobId: req.params.jobId, userId: req.user.id });
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            message: err.message,
            status: HTTP_STATUS.BAD_REQUEST
        })
    );
  }
};

export const generatePrepController = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userProfile = req.user; // From authenticate
    if (!jobId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({ 
            success: false,
            error: 'jobId is required' })
      );
    }
    if (!userProfile) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        new CustomError({ 
            success: false,
            error: 'User not authenticated' })
      );
    }
    const prep = await services.generateInterviewPrep(jobId, userProfile);
    if (!prep) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({ 
            success: false,
            error: 'Interview preparation not found' })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ 
            success: true,
            message: 'Interview preparation generated successfully',
            data: prep
        })
    );
  } catch (err) {
    logger.error(`generatePrep failed: ${err.message}`, { jobId: req.params.jobId, userId: req.user.id });
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({ 
          success: false,
          error: err.message })
    );
  }
};

export const updateProgressController = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { completedItems } = req.body;

    if (!jobId || !Array.isArray(completedItems)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({ 
            success: false,
            error: 'jobId and completedItems array are required' })
      );
    }
    if(!completedItems.every(item => typeof item === 'string')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            error: 'completedItems must be an array of strings'
        })
      );
    }

    const progress = await services.updatePrepProgress(req.user.id, jobId, completedItems);
    if (!progress) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
            success: false,
            error: 'Progress not found'
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({ 
        success: true,
        message: 'Progress updated successfully',
        data: progress
      })
    );
  } catch (err) {
    logger.error(`updateProgress failed: ${err.message}`, { jobId: req.params.jobId, userId: req.user.id });
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({ success: false, error: err.message })
    );
  }
};

export const getTipsController = async (req, res) => {
  try {
    const { companyId, roleType } = req.query;
    if (!companyId || !roleType) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({ 
            success: false,
            error: 'companyId and roleType are required' })
      );
    }
    const tips = await services.getInterviewTips(companyId, roleType);
    if (!tips) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          error: 'Interview tips not found'
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({ success: true,
            message: 'Interview tips retrieved successfully',
            data: tips })
    );
  } catch (err) {
    logger.error(`getTips failed: ${err.message}`, { companyId, roleType });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({ success: false, error: err.message })
    );
  }
};

// Utility
export const checkLimitController = async (req, res) => {
  try {
    const { feature } = req.params;
    const limit = await services.checkFeatureLimit(req.user.id, feature);
    if (!feature) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({ success: false, error: 'Feature parameter is required' })
      );
    }
    if (limit === null) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({ success: false, error: 'Feature limit not found' })
      );
    }

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({ 
        success: true,
        message: 'Feature limit retrieved successfully',
        data: limit
      })
    );
  } catch (err) {
    logger.error(`checkLimit failed: ${err.message}`, { feature: req.params.feature, userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({ success: false, error: err.message })
    );
  }
};

export const getAnalyticsController = async (req, res) => {
  try {
    const analytics = await services.getPremiumAnalytics({ userId: req.user.id });
    if (!analytics) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({ success: false, error: 'Analytics not found' })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({ 
        success: true,
        message: 'Analytics retrieved successfully',
        data: analytics
      })
    );
  } catch (err) {
    logger.error(`getAnalytics failed: ${err.message}`, { userId: req.user.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({ success: false, error: err.message })
    );
  }
};