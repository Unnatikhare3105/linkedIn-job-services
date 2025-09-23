// routers/notificationsSettings.router.js
import express from 'express';
import { body, param, query } from 'express-validator';
import NotificationsSettingsController from '../controllers/notificationsSettings.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { createRateLimit } from '../middlewares/rateLimit.middleware.js';
import { ERROR_MESSAGES } from '../constants/errorMessages.js';

const router = express.Router();

const controller = new NotificationsSettingsController();
controller.initialize().catch(error => logger.error('Controller init error:', error));

const generalLimit = createRateLimit(15 * 60 * 1000, 100, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
const securityLimit = createRateLimit(60 * 60 * 1000, 10, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
const exportLimit = createRateLimit(60 * 60 * 1000, 3, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
const vipLimit = createRateLimit(60 * 60 * 1000, 20, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
const notificationLimit = createRateLimit(60 * 60 * 1000, 50, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);

const validateUUID = param('id').isUUID().withMessage('Invalid ID format');
const validateTimezone = body('timezone').isString().isLength({ min: 3, max: 50 });
const validateEmail = body('emailAddress').isEmail().withMessage('Invalid email address');
const validatePassword = body('newPassword').isStrongPassword({
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1
}).withMessage('Password must be at least 8 characters with uppercase, lowercase, number and symbol');

const validateTimeFormat = body('*.startTime').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid time format (HH:MM)');
const validate2FAToken = body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Invalid 2FA token');
const validateCompanyId = body('companyId').isString().isLength({ min: 1, max: 100 }).withMessage('Invalid company ID');

router.use(authenticate);

// SMART NOTIFICATION TIMING ROUTES (101)
router.put('/notifications/timing', notificationLimit, [
  validateTimezone,
  body('preferredTimes').isObject(),
  body('weekdayPreferences').isArray({ min: 1, max: 7 }),
  body('maxNotificationsPerHour').isInt({ min: 1, max: 10 })
], controller.updateNotificationTiming);

router.get('/notifications/timing', generalLimit, controller.getNotificationTimingSettings);

router.get('/notifications/optimal-time', generalLimit, controller.getOptimalNotificationTime);

router.get('/notifications/engagement-analysis', generalLimit, controller.getEngagementAnalysis);

// DO NOT DISTURB MODE ROUTES (102)
router.put('/notifications/dnd', generalLimit, [
  body('enabled').isBoolean(),
  body('schedules').optional().isArray({ max: 5 }),
  body('schedules.*.days').isArray({ min: 1, max: 7 }),
  validateTimeFormat,
  body('allowEmergencyNotifications').optional().isBoolean(),
  body('emergencyKeywords').optional().isArray({ max: 10 })
], controller.updateDNDSettings);

router.get('/notifications/dnd', generalLimit, controller.getDNDSettings);

router.get('/notifications/dnd/status', generalLimit, controller.getDNDStatus);

// VIP COMPANY ALERTS ROUTES (103)
router.post('/notifications/vip-companies', vipLimit, [
  validateCompanyId,
  body('companyName').isString().isLength({ min: 1, max: 200 }),
  body('alertTypes').isArray({ min: 1 }),
  body('priority').optional().isIn(['high', 'medium', 'low']),
  body('jobRoleFilters').optional().isArray({ max: 20 }),
  body('locationFilters').optional().isArray({ max: 10 })
], controller.addVIPCompany);

router.get('/notifications/vip-companies', generalLimit, controller.getVIPCompanies);

router.put('/notifications/vip-companies/:companyId', generalLimit, [
  param('companyId').isString().isLength({ min: 1, max: 100 }),
  body('alertTypes').optional().isArray({ min: 1 }),
  body('priority').optional().isIn(['high', 'medium', 'low'])
], controller.updateVIPCompany);

router.delete('/notifications/vip-companies/:companyId', generalLimit, [
  param('companyId').isString().isLength({ min: 1, max: 100 })
], controller.removeVIPCompany);

router.get('/notifications/vip-companies/:companyId/alerts', generalLimit, [
  param('companyId').isString()
], controller.getVIPCompanyAlerts);

// APPLICATION DEADLINE REMINDERS ROUTES (104)
router.post('/notifications/deadline-reminders', generalLimit, [
  body('jobId').isString().notEmpty(),
  body('jobTitle').isString().isLength({ min: 1, max: 200 }),
  body('companyName').isString().isLength({ min: 1, max: 200 }),
  body('applicationDeadline').isISO8601().toDate(),
  body('reminderSettings.firstReminder').isIn([1, 2, 3, 7, 14]),
  body('reminderSettings.secondReminder').isIn([1, 2, 3]),
  body('reminderSettings.finalReminder').isIn([1, 6, 12, 24]),
  body('notificationChannels').isArray({ min: 1 }),
  body('priority').optional().isIn(['high', 'medium', 'low'])
], controller.createDeadlineReminder);

router.get('/notifications/deadline-reminders', generalLimit, controller.getDeadlineReminders);

router.get('/notifications/deadline-reminders/upcoming', generalLimit, [
  query('days').optional().isInt({ min: 1, max: 30 })
], controller.getUpcomingDeadlines);

router.put('/notifications/deadline-reminders/:reminderId', generalLimit, [
  param('reminderId').isUUID(),
  body('reminderSettings').optional().isObject(),
  body('priority').optional().isIn(['high', 'medium', 'low']),
  body('notificationChannels').optional().isArray({ min: 1 })
], controller.updateDeadlineReminder);

router.delete('/notifications/deadline-reminders/:reminderId', generalLimit, [
  param('reminderId').isUUID()
], controller.deleteDeadlineReminder);

// PROFILE VISIBILITY CONTROLS ROUTES (105)
router.put('/profile/visibility', generalLimit, [
  body('profileVisibility').isIn(['public', 'private', 'network_only', 'recruiters_only']),
  body('searchableByRecruiters').optional().isBoolean(),
  body('showInCompanySearch').optional().isBoolean(),
  body('allowDirectMessages').optional().isBoolean(),
  body('hideFromCurrentEmployer').optional().isBoolean(),
  body('currentEmployerDomains').optional().isArray({ max: 10 }),
  body('blockedCompanies').optional().isArray({ max: 50 }),
  body('visibleFields').optional().isObject()
], controller.updateProfileVisibility);

router.get('/profile/visibility', generalLimit, controller.getProfileVisibility);

// ANONYMOUS BROWSING ROUTES (106)
router.post('/profile/anonymous/enable', generalLimit, [
  body('enabled').isBoolean(),
  body('sessionDuration').isInt({ min: 15, max: 480 }),
  body('trackingPreferences').optional().isObject(),
  body('autoExpire').optional().isBoolean()
], controller.enableAnonymousBrowsing);

router.post('/profile/anonymous/disable', generalLimit, controller.disableAnonymousBrowsing);

router.get('/profile/anonymous/status', generalLimit, controller.getAnonymousBrowsingStatus);

router.put('/profile/anonymous/session/:sessionId/extend', generalLimit, [
  param('sessionId').isUUID(),
  body('duration').isInt({ min: 15, max: 480 })
], controller.extendAnonymousSession);

router.get('/profile/anonymous/history', generalLimit, [
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('offset').optional().isInt({ min: 0 })
], controller.getAnonymousSessionHistory);

// JOB ALERT FREQUENCY ROUTES (107)
router.put('/notifications/alert-frequency', generalLimit, [
  body('globalFrequency').isIn(['instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled']),
  body('categoryFrequencies').optional().isObject(),
  body('quietHours').optional().isObject(),
  body('weekendDelivery').optional().isBoolean(),
  body('maxAlertsPerDay').optional().isInt({ min: 1, max: 50 })
], controller.updateAlertFrequency);

router.get('/notifications/alert-frequency', generalLimit, controller.getAlertFrequencySettings);

router.put('/notifications/alert-frequency/category/:category', generalLimit, [
  param('category').isIn(['newJobs', 'jobRecommendations', 'applicationUpdates', 'companyUpdates', 'networkActivity', 'marketInsights', 'learningOpportunities']),
  body('frequency').isIn(['instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled'])
], controller.updateCategoryFrequency);

router.post('/notifications/alert-frequency/reset', generalLimit, controller.resetAlertFrequency);

// EMAIL PREFERENCES ROUTES (108)
router.put('/notifications/email-preferences', generalLimit, [
  body('emailAddress').isEmail(),
  body('globalEmailEnabled').optional().isBoolean(),
  body('subscriptions').optional().isObject(),
  body('emailFormat').optional().isIn(['html', 'text', 'both']),
  body('frequency').optional().isObject()
], controller.updateEmailPreferences);

router.get('/notifications/email-preferences', generalLimit, controller.getEmailPreferences);

router.put('/notifications/email-preferences/subscription/:category', generalLimit, [
  param('category').isIn(['jobAlerts', 'applicationUpdates', 'companyNews', 'weeklyDigest', 'monthlyReport', 'marketingEmails', 'partnerOffers', 'surveyInvitations', 'productUpdates', 'securityAlerts']),
  body('enabled').isBoolean()
], controller.updateEmailSubscription);

router.get('/notifications/email-preferences/status', generalLimit, controller.getEmailSubscriptionStatus);

router.get('/unsubscribe/:token', controller.unsubscribeEmail);

router.get('/verify-email/:token', controller.verifyEmail);

// DATA EXPORT ROUTES (109)
router.post('/data/export', exportLimit, [
  body('exportType').isIn(['full', 'profile', 'applications', 'search_history', 'preferences', 'analytics']),
  body('format').isIn(['json', 'csv', 'xml', 'pdf']),
  body('dateRange').optional().isObject(),
  body('dateRange.startDate').optional().isISO8601().toDate(),
  body('dateRange.endDate').optional().isISO8601().toDate(),
  body('includeDeleted').optional().isBoolean(),
  body('anonymize').optional().isBoolean(),
  body('deliveryMethod').optional().isIn(['download', 'email', 'secure_link'])
], controller.requestDataExport);

router.get('/data/export', generalLimit, [
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('offset').optional().isInt({ min: 0 })
], controller.getExportHistory);

router.get('/data/export/:exportId/status', generalLimit, [
  param('exportId').isUUID()
], controller.getExportStatus);

router.get('/data/export/:exportId/download', generalLimit, [
  param('exportId').isUUID()
], controller.downloadExport);

router.delete('/data/export/:exportId', generalLimit, [
  param('exportId').isUUID()
], controller.cancelExport);

// ACCOUNT SECURITY ROUTES (110)
router.get('/account/security', generalLimit, controller.getSecuritySettings);

router.put('/account/security', securityLimit, [
  body('currentPassword').optional().isString().notEmpty(),
  body('newPassword').optional().isStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  }),
  body('twoFactorAuth').optional().isObject(),
  body('loginNotifications').optional().isBoolean(),
  body('sessionTimeout').optional().isInt({ min: 15, max: 1440 }),
  body('allowMultipleSessions').optional().isBoolean(),
  body('ipWhitelist').optional().isArray({ max: 10 }),
  body('deviceTrust').optional().isBoolean()
], controller.updateSecuritySettings);

router.post('/account/password/change', securityLimit, [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  })
], controller.changePassword);

router.post('/account/2fa/enable', securityLimit, [
  body('method').isIn(['sms', 'email', 'authenticator']),
  body('phoneNumber').optional().isMobilePhone()
], controller.enable2FA);

router.post('/account/2fa/verify', securityLimit, [
  body('token').isLength({ min: 6, max: 6 }).isNumeric(),
  body('secret').optional().isString().isLength({ min: 16, max: 32 })
], controller.verify2FASetup);

router.post('/account/2fa/disable', securityLimit, [
  body('currentPassword').isString().notEmpty()
], controller.disable2FA);

router.post('/account/2fa/backup-codes/generate', securityLimit, [
  body('currentPassword').isString().notEmpty()
], controller.generateBackupCodes);

router.get('/account/security/activity', generalLimit, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], controller.getLoginActivity);

router.get('/account/security/devices', generalLimit, controller.getTrustedDevices);

router.delete('/account/security/devices/:deviceId', securityLimit, [
  param('deviceId').isString().notEmpty()
], controller.revokeTrustedDevice);

router.post('/account/security/lock', securityLimit, [
  body('reason').isString().isLength({ min: 1, max: 200 }),
  body('duration').optional().isInt({ min: 300, max: 86400 })
], controller.lockAccount);

router.post('/account/security/unlock', securityLimit, [
  body('currentPassword').isString().notEmpty()
], controller.unlockAccount);

router.get('/account/security/audit', generalLimit, controller.getSecurityAudit);

// Health Check
router.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Notifications & Settings service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

router.get('/ready', async (req, res) => {
  try {
    const redisStatus = await redisClient.ping() === 'PONG';
    const mongoStatus = mongoose.connection.readyState === 1;
    
    if (redisStatus && mongoStatus) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Service is ready',
        dependencies: {
          redis: redisStatus,
          mongodb: mongoStatus
        }
      });
    } else {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Service dependencies not ready',
        dependencies: {
          redis: redisStatus,
          mongodb: mongoStatus
        }
      });
    }
  } catch (error) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      success: false,
      message: 'Service not ready',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Unhandled route error:', error);
  
  if (error.type === 'validation') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: ERROR_MESSAGES.VALIDATION_FAILED,
      errors: error.details
    });
  }
  
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: ERROR_MESSAGES.RESOURCE_NOT_FOUND
  });
});

export default router;