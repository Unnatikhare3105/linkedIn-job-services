// controllers/notificationsSettings.controller.js
import {NotificationsSettingsService} from '../../services/premium/notification.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../../constants/messages.js';
import CustomError from '../../utils/customError.js';
import CustomSuccess from '../../utils/customSuccess.js';
import { sanitizeInput, validId } from '../../utils/security.js';
import logger from '../../utils/logger.js';

  export const updateNotificationTimingController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: "Request body cannot be empty",
            data: {},
            statusCode: HTTP_STATUS.BAD_REQUEST
          }));
        }

        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.updateNotificationTiming({
        ...sanitizedBody,
        userId: req.user.id
      });
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: "Notification timing settings not found",
            data: {},
          statusCode: HTTP_STATUS.NOT_FOUND
        }));
      }

      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.NOTIFICATION_TIMING_UPDATED,
        data: result
      }));
    } catch (error) {
      logger.error('Update notification timing error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        data: {},
        statusCode: HTTP_STATUS.BAD_REQUEST
      }));
    }
  };

  export const getNotificationTimingSettingsController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getNotificationTimingSettings(req.user.id);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.NOTIFICATION_TIMING_SETTINGS_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.NOTIFICATION_TIMING_SETTINGS_RETRIEVED,
        data: result
      }));
    } catch (error) {
      logger.error('Get timing settings error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        data: {}
      }));
    }
  };

  export const getOptimalNotificationTimeController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getOptimalNotificationTime(req.user.id);
      if(!result){
          return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.OPTIMAL_NOTIFICATION_TIME_NOT_FOUND,
            data: {}
          }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.OPTIMAL_NOTIFICATION_TIME_RETRIEVED,
        data: result
      }));
    } catch (error) {
      logger.error('Get optimal time error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR

      }));
    }
  };

  export const getEngagementAnalysisController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getEngagementAnalysis(req.user.id);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.ENGAGEMENT_ANALYSIS_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.ENGAGEMENT_ANALYSIS_RETRIEVED,
        data: result
      }));
    } catch (error) {
      logger.error('Get engagement analysis error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const updateDoNotDisturbSettingsController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.updateDoNotDisturbSettings({
        ...sanitizedBody,
        userId: req.user.id
      });
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.DND_SETTINGS_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DND_SETTINGS_UPDATED,
        data: result
      }));
    } catch (error) {
      logger.error('Update DND settings error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getDNDSettingsController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getDNDSettings(req.user.id);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.DND_SETTINGS_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DND_SETTINGS_RETRIEVED,
        data: result
      }));
    } catch (error) {
      logger.error('Get DND settings error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getDNDStatusController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getDNDStatus(req.user.id);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.DND_STATUS_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DND_STATUS_RETRIEVED,
        data: result
      }));
    } catch (error) {
      logger.error('Get DND status error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const addVIPCompanyController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.addVIPCompany({
        ...sanitizedBody,
        userId: req.user.id
      });
        if(!result){
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
              success: false,
              message: ERROR_MESSAGES.VIP_COMPANY_NOT_ADDED,
              data: {}
            }));
        }
      return res.status(HTTP_STATUS.CREATED).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_ADDED,
        data: result
      }));
    } catch (error) {
      logger.error('Add VIP company error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const updateVIPCompanyController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        if(!validId(req.params.companyId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_COMPANY_ID,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.updateVIPCompany(req.user.id, req.params.companyId, sanitizedBody);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.VIP_COMPANY_NOT_FOUND,
            data: {}
          }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_UPDATED,
        data: result
      }));
    } catch (error) {
      logger.error('Update VIP company error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const removeVIPCompanyController = async (req, res) => {
    try {
        if(!validId(req.params.companyId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_COMPANY_ID,
            data: {}
          }));
        }
      const result = await NotificationsSettingsService.removeVIPCompany(req.user.id, req.params.companyId);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.VIP_COMPANY_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_REMOVED,
        data: {}
      }));
    } catch (error) {
      logger.error('Remove VIP company error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getVIPCompanies = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getVIPCompanies(req.user.id);
      if(!result || result.length === 0){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.NO_VIP_COMPANIES_FOUND,
            data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
          message: SUCCESS_MESSAGES.VIP_COMPANIES_FETCHED,
          data: result
        }));
    } catch (error) {
      logger.error('Get VIP companies error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getVIPCompanyAlertsController = async (req, res) => {
    try {
        if(!validId(req.params.companyId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_COMPANY_ID,
            data: {}
          }));
        }
      const result = await NotificationsSettingsService.getVIPCompanyAlerts(req.user.id, req.params.companyId);
      if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.VIP_COMPANY_ALERTS_NOT_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.VIP_COMPANY_ALERTS_FETCHED,
        data: result
      }));
      
    } catch (error) {
      logger.error('Get VIP company alerts error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const createDeadlineReminderController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.createDeadlineReminder({
        ...sanitizedBody,
        userId: req.user.id
      });
      if(!result){
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.CREATED).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_CREATED,
        data: result
      }));
    } catch (error) {
      logger.error('Create deadline reminder error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const updateDeadlineReminderController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        if(!validId(req.params.reminderId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REMINDER_ID,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.updateDeadlineReminder(req.user.id, req.params.reminderId, sanitizedBody);
      if(!result){
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_UPDATED,
        data: result
      }));
    } catch (error) {
      logger.error('Update deadline reminder error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const deleteDeadlineReminderController = async (req, res) => {
    try {
      if(!validId(req.params.reminderId)){
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.INVALID_REMINDER_ID,
          data: {}
        }));
      }
      const result = await NotificationsSettingsService.deleteDeadlineReminder(req.user.id, req.params.reminderId);
      if(!result){
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
          data: {}
        }));
      }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDER_DELETED,
        data: {}
      }));
    } catch (error) {
      logger.error('Delete deadline reminder error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getDeadlineRemindersController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getDeadlineReminders(req.user.id);
      if(!result || result.length === 0){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.NO_DEADLINE_REMINDERS_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.DEADLINE_REMINDERS_FETCHED,
        data: result
      }));
    } catch (error) {
      logger.error('Get deadline reminders error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getUpcomingDeadlinesController = async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = await NotificationsSettingsService.getUpcomingDeadlines(req.user.id, days);
      if(!result || result.length === 0){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.NO_UPCOMING_DEADLINES_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.UPCOMING_DEADLINES_FETCHED,
        data: result
      }));
    } catch (error) {
      logger.error('Get upcoming deadlines error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const updateProfileVisibilityController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.updateProfileVisibility({
        ...sanitizedBody,
        userId: req.user.id
      });
      if(!result){
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.PROFILE_VISIBILITY_UPDATED,
        data: result
      }));
    } catch (error) {
      logger.error('Update profile visibility error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const getProfileVisibilityController = async (req, res) => {
    try {
      const result = await NotificationsSettingsService.getProfileVisibility(req.user.id);
        if(!result){
        return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
          success: false,
          message: ERROR_MESSAGES.NO_PROFILE_VISIBILITY_FOUND,
          data: {}
        }));
      }
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: SUCCESS_MESSAGES.PROFILE_VISIBILITY_FETCHED,
        data: result
      }));
    } catch (error) {
      logger.error('Get profile visibility error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

  export const enableAnonymousBrowsingController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
      const result = await NotificationsSettingsService.enableAnonymousBrowsing({
        ...sanitizedBody,
        userId: req.user.id
      });
      return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
        success: true,
        message: "Anonymous browsing enabled",
        data: result
      }));
    } catch (error) {
      logger.error('Enable anonymous browsing error:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR
      }));
    }
  };

export const disableAnonymousBrowsingController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.disableAnonymousBrowsing(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Anonymous browsing disabled",
            data: result
        }));
    } catch (error) {
        logger.error('Disable anonymous browsing error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getAnonymousBrowsingStatusController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getAnonymousBrowsingStatus(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Anonymous browsing status fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get anonymous browsing status error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const extendAnonymousSessionController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
          }));
        }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.extendAnonymousSession(req.user.id, req.params.sessionId, sanitizedBody);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Anonymous session extended",
            data: result
        }));
    } catch (error) {
        logger.error('Extend anonymous session error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getAnonymousSessionHistoryController = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const result = await NotificationsSettingsService.getAnonymousSessionHistory(req.user.id, limit, offset);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Anonymous session history fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get anonymous session history error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const updateAlertFrequencyController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.updateAlertFrequency({
            ...sanitizedBody,
            userId: req.user.id
        });
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Alert frequency updated",
            data: result
        }));
    } catch (error) {
        logger.error('Update alert frequency error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getAlertFrequencySettingsController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getAlertFrequencySettings(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Alert frequency settings fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get alert frequency settings error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const updateCategoryFrequencyController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.updateCategoryFrequency(req.user.id, req.params.category, sanitizedBody.frequency);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Category frequency updated",
            data: result
        }));
    } catch (error) {
        logger.error('Update category frequency error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const resetAlertFrequencyController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.resetAlertFrequency(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Alert frequency reset",
            data: result
        }));
    } catch (error) {
        logger.error('Reset alert frequency error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const updateEmailPreferencesController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.updateEmailPreferences({
            ...sanitizedBody,
            userId: req.user.id
        });
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Email preferences updated",
            data: result
        }));
    } catch (error) {
        logger.error('Update email preferences error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getEmailPreferencesController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getEmailPreferences(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Email preferences fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get email preferences error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const updateEmailSubscriptionController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.updateEmailSubscription(req.user.id, req.params.category, sanitizedBody.enabled);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Email subscription updated",
            data: result
        }));
    } catch (error) {
        logger.error('Update email subscription error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const verifyEmailControllerController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.verifyEmail(req.params.token);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Email verified",
            data: result
        }));
    } catch (error) {
        logger.error('Verify email error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const unsubscribeEmailController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.unsubscribeEmail(req.params.token);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Email unsubscribed",
            data: result
        }));
    } catch (error) {
        logger.error('Unsubscribe email error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getEmailSubscriptionStatusController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getEmailSubscriptionStatus(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Email subscription status fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get email subscription status error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const requestDataExportController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.requestDataExport({
            ...sanitizedBody,
            userId: req.user.id
        });
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.CREATED).json(new CustomSuccess({
            success: true,
            message: "Data export requested",
            data: result
        }));
    } catch (error) {
        logger.error('Request data export error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getExportHistoryController = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const result = await NotificationsSettingsService.getExportHistory(req.user.id, limit, offset);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Export history fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get export history error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getExportStatusController = async (req, res) => {
    try {
        if(!validId(req.params.exportId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const result = await NotificationsSettingsService.getExportStatus(req.params.exportId, req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Export status fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get export status error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const downloadExportController = async (req, res) => {
    try {
        if(!validId(req.params.exportId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const result = await NotificationsSettingsService.downloadExport(req.params.exportId, req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Export downloaded",
            data: result
        }));
    } catch (error) {
        logger.error('Download export error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const cancelExportController = async (req, res) => {
    try {
        if(!validId(req.params.exportId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const result = await NotificationsSettingsService.cancelExport(req.params.exportId, req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Export cancelled",
            data: result
        }));
    } catch (error) {
        logger.error('Cancel export error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getSecuritySettingsController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getSecuritySettings(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Security settings fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get security settings error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const updateSecuritySettingsController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.updateSecuritySettings({
            ...sanitizedBody,
            userId: req.user.id
        });
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Security settings updated",
            data: result
        }));
    } catch (error) {
        logger.error('Update security settings error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const changePasswordController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.changePassword({
            ...sanitizedBody,
            userId: req.user.id
        });
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Password changed",
            data: result
        }));
    } catch (error) {
        logger.error('Change password error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const enable2FAController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const { method, phoneNumber } = sanitizedBody;
        const result = await NotificationsSettingsService.enable2FA(req.user.id, method, phoneNumber);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "2FA enabled",
            data: result
        }));
    } catch (error) {
        logger.error('Enable 2FA error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const verify2FASetupController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const { token, secret } = sanitizedBody;
        const result = await NotificationsSettingsService.verify2FASetup(req.user.id, token, secret);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "2FA setup verified",
            data: result
        }));
    } catch (error) {
        logger.error('Verify 2FA setup error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const disable2FAController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.disable2FA(req.user.id, sanitizedBody.currentPassword);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "2FA disabled",
            data: result
        }));
    } catch (error) {
        logger.error('Disable 2FA error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const generateBackupCodesController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.generateBackupCodes(req.user.id, sanitizedBody.currentPassword);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Backup codes generated",
            data: result
        }));
    } catch (error) {
        logger.error('Generate backup codes error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getLoginActivityController = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const result = await NotificationsSettingsService.getLoginActivity(req.user.id, limit, offset);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Login activity fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get login activity error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getTrustedDevicesController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getTrustedDevices(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Trusted devices fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get trusted devices error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const revokeTrustedDeviceController = async (req, res) => {
    try {
        if(!validId(req.params.deviceId)){
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: ERROR_MESSAGES.INVALID_DEVICE_ID,
            data: {}
        }));
    }
        const result = await NotificationsSettingsService.revokeTrustedDevice(req.user.id, req.params.deviceId);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Trusted device revoked",
            data: result
        }));
    } catch (error) {
        logger.error('Revoke trusted device error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const lockAccountController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const { reason, duration } = sanitizedBody;
        const result = await NotificationsSettingsService.lockAccount(req.user.id, reason, duration);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Account locked",
            data: result
        }));
    } catch (error) {
        logger.error('Lock account error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const unlockAccountController = async (req, res) => {
    try {
        if(!req.body || Object.keys(req.body).length === 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false, 
            message: ERROR_MESSAGES.INVALID_REQUEST_BODY,
            data: {}
        }));
    }
        const sanitizedBody = sanitizeInput(req.body);
        const result = await NotificationsSettingsService.unlockAccount(req.user.id, sanitizedBody.currentPassword);
        if (!result) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Account unlocked",
            data: result
        }));
    } catch (error) {
        logger.error('Unlock account error:', error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};

export const getSecurityAuditController = async (req, res) => {
    try {
        const result = await NotificationsSettingsService.getSecurityAudit(req.user.id);
        if (!result) {
            return res.status(HTTP_STATUS.NOT_FOUND).json(new CustomError({
                success: false,
                message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
                data: {}
            }));
        }
        return res.status(HTTP_STATUS.OK).json(new CustomSuccess({
            success: true,
            message: "Security audit fetched",
            data: result
        }));
    } catch (error) {
        logger.error('Get security audit error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
            success: false,
            message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            data: {}
        }));
    }
};


