export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TOO_MANY_REQUESTS: 429,
  GONE: 410,
};

export const ERROR_MESSAGES = {
  INVALID_INPUT: "Invalid input data",
  JOB_NOT_FOUND: "Job not found",
  FORBIDDEN_JOB: "User not authorized",
  JOB_CREATION_FAILED: "Failed to create job",
  JOB_UPDATE_FAILED: "Failed to update job",
  JOB_DELETE_FAILED: "Failed to delete job",
  JOB_LIST_FAILED: "Failed to list jobs",
  FEATURED_JOBS_FAILED: "Failed to fetch featured jobs",

  VALIDATION_ERROR: "Validation error",

  FORBIDDEN_APPLICATION: "You do not have permission to perform this action",
  INTERNAL_SERVER_ERROR:
    "An unexpected error occurred. Please try again later.",
  INVALID_INPUT: "Invalid input provided",
  JOB_NOT_FOUND: "Job not found",
  APPLICATION_NOT_FOUND: "Application not found",
  ALREADY_APPLIED: "You have already applied to this job",

  JOB_VIEW_INCREMENT_FAILED: "Failed to increment job view",
  JOB_SAVE_INCREMENT_FAILED: "Failed to increment job save",
  ANALYTICS_RETRIEVAL_FAILED: "Failed to retrieve job analytics",
  FORBIDDEN_ANALYTICS: "You do not have permission to access analytics",

  JOBS_NOT_FOUND: "No jobs found",
  AUTOCOMPLETE_NOT_FOUND: "No autocomplete suggestions found",
  RECENT_SEARCHES_NOT_FOUND: "No recent searches found",
  SUGGESTIONS_NOT_FOUND: "No suggestions found",
  TRENDING_NOT_FOUND: "No trending searches found",
  SAVED_NOT_FOUND: "No saved searches found",
  HISTORY_NOT_FOUND: "No search history found",

    VALIDATION_FAILED: 'Invalid input data',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  SKILLS_ANALYSIS_FAILED: 'Failed to analyze skills gap',
  RESOURCE_NOT_FOUND: 'Requested resource not found',
  CAREER_PATH_GENERATION_FAILED: 'Failed to generate career path',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',
  ASSESSMENT_EXPIRED: 'Assessment time limit exceeded',
  ASSESSMENT_ALREADY_COMPLETED: 'Assessment already completed',
  INVALID_CERTIFICATION_DATA: 'Invalid certification data',
  LINKEDIN_NOT_CONNECTED: 'LinkedIn account not connected',
  COURSE_SYNC_FAILED: 'Failed to sync LinkedIn courses',
  INTERVIEW_SCHEDULING_FAILED: 'Failed to schedule mock interview',
  FEEDBACK_GENERATION_FAILED: 'Failed to generate interview feedback',
  INVALID_RESUME_FORMAT: 'Invalid resume file format',
  RESUME_UPLOAD_REQUIRED: 'Resume file is required',
  SESSION_BOOKING_FAILED: 'Failed to book coaching session',
  NO_COACHES_AVAILABLE: 'No coaches available for the requested time',
  BENCHMARK_CALCULATION_FAILED: 'Failed to calculate salary benchmark',
  SALARY_DATA_UNAVAILABLE: 'Salary data unavailable for this role',
  REPORT_GENERATION_FAILED: 'Failed to generate market report',
  ASSESSMENT_NOT_FOUND: 'Assessment not found',

  // General
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHORIZED_ACCESS: 'Unauthorized access',
  RESOURCE_NOT_FOUND: 'Resource not found',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  
  // Smart Notification Timing
  INVALID_TIMEZONE: 'Invalid timezone provided',
  INVALID_TIME_RANGE: 'Invalid time range specified',
  TIMING_ANALYSIS_FAILED: 'Notification timing analysis failed',
  INSUFFICIENT_DATA: 'Insufficient data for timing optimization',
  
  // Do Not Disturb Mode
  INVALID_DND_SCHEDULE: 'Invalid Do Not Disturb schedule',
  DND_CONFLICT: 'Do Not Disturb schedule conflict detected',
  INVALID_TIME_FORMAT: 'Invalid time format provided',
  
  // VIP Company Alerts
  COMPANY_NOT_FOUND: 'Company not found',
  VIP_COMPANY_EXISTS: 'Company already in VIP list',
  VIP_LIST_LIMIT_EXCEEDED: 'VIP company list limit exceeded (max 50)',
  INVALID_COMPANY_ID: 'Invalid company ID provided',
  
  // Application Deadline Reminders
  INVALID_DEADLINE_DATE: 'Invalid deadline date provided',
  DEADLINE_IN_PAST: 'Cannot set reminder for past deadline',
  REMINDER_LIMIT_EXCEEDED: 'Maximum reminder limit exceeded',
  DEADLINE_NOT_FOUND: 'Deadline reminder not found',
  
  // Profile Visibility Controls
  INVALID_VISIBILITY_SETTING: 'Invalid visibility setting',
  PROFILE_ACCESS_DENIED: 'Profile access denied',
  VISIBILITY_CONFLICT: 'Visibility setting conflict',
  
  // Anonymous Browsing
  ANONYMOUS_SESSION_EXPIRED: 'Anonymous session expired',
  ANONYMOUS_MODE_UNAVAILABLE: 'Anonymous browsing unavailable',
  SESSION_CONFLICT: 'Cannot enable anonymous mode during active session',
  
  // Job Alert Frequency
  INVALID_FREQUENCY_SETTING: 'Invalid frequency setting',
  ALERT_SCHEDULE_CONFLICT: 'Alert schedule conflict detected',
  FREQUENCY_LIMIT_EXCEEDED: 'Too many frequency changes in short period',
  
  // Email Preferences
  INVALID_EMAIL_PREFERENCE: 'Invalid email preference setting',
  EMAIL_REQUIRED: 'Email address is required',
  UNSUBSCRIBE_FAILED: 'Unsubscribe operation failed',
  EMAIL_VERIFICATION_REQUIRED: 'Email verification required',
  
  // Data Export
  EXPORT_REQUEST_EXISTS: 'Export request already in progress',
  EXPORT_FAILED: 'Data export failed',
  EXPORT_FILE_NOT_FOUND: 'Export file not found or expired',
  EXPORT_SIZE_LIMIT_EXCEEDED: 'Export data size limit exceeded',
  INVALID_EXPORT_FORMAT: 'Invalid export format specified',
  
  // Account Security
  INVALID_CURRENT_PASSWORD: 'Invalid current password',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  TWO_FA_ALREADY_ENABLED: 'Two-factor authentication already enabled',
  TWO_FA_NOT_ENABLED: 'Two-factor authentication not enabled',
  INVALID_2FA_TOKEN: 'Invalid two-factor authentication token',
  SECURITY_VERIFICATION_FAILED: 'Security verification failed',
  ACCOUNT_LOCKED: 'Account temporarily locked due to security reasons'
};

export const SUCCESS_MESSAGES = {
  JOB_CREATED: "Job created successfully",
  JOB_UPDATED: "Job updated successfully",
  JOB_DELETED: "Job deleted successfully",
  JOB_FOUND: "Job retrieved successfully",
  JOBS_LISTED: "Jobs retrieved successfully",
  FEATURED_JOBS: "Featured jobs retrieved successfully",

  JOB_APPLIED: "Job application submitted successfully",
  APPLICATIONS_RETRIEVED: "Job applications retrieved successfully",
  APPLICATION_STATUS_UPDATED: "Application status updated successfully",
  APPLICATION_DELETED: "Application deleted successfully",
  JOB_CREATED: "Job created successfully",
  JOBS_RETRIEVED: "Jobs retrieved successfully",

  JOB_VIEW_INCREMENTED: "Job view incremented successfully",
  JOB_SAVE_INCREMENTED: "Job save incremented successfully",
  ANALYTICS_RETRIEVED: "Job analytics retrieved successfully",
  SIMILAR_JOBS_RETRIEVED: "Similar jobs retrieved successfully",

  AUTOCOMPLETE_RETRIEVED: "Autocomplete suggestions retrieved successfully",
  RECENT_SEARCHES_RETRIEVED: "Recent searches retrieved successfully",
  SUGGESTIONS_RETRIEVED: "Search suggestions retrieved successfully",
  TRENDING_RETRIEVED: "Trending searches retrieved successfully",
  SAVED_RETRIEVED: "Saved searches retrieved successfully",
  HISTORY_RETRIEVED: "Search history retrieved successfully",

  SKILLS_GAP_ANALYZED: 'Skills gap analysis completed successfully',
  SKILLS_GAP_RETRIEVED: 'Skills gap analysis retrieved successfully',
  CAREER_PATH_GENERATED: 'Career path generated successfully',
  CAREER_PATH_RETRIEVED: 'Career path suggestions retrieved successfully',
  ASSESSMENT_CREATED: 'Skill assessment created successfully',
  ASSESSMENT_COMPLETED: 'Assessment completed successfully',
  CERTIFICATION_ADDED: 'Certification added successfully',
  CERTIFICATIONS_RETRIEVED: 'Certifications retrieved successfully',
  LINKEDIN_CONNECTED: 'LinkedIn Learning connected successfully',
  COURSES_SYNCED: 'LinkedIn courses synced successfully',
  MOCK_INTERVIEW_SCHEDULED: 'Mock interview scheduled successfully',
  INTERVIEW_COMPLETED: 'Mock interview completed successfully',
  RESUME_SUBMITTED: 'Resume submitted for review successfully',
  FEEDBACK_RETRIEVED: 'Resume review feedback retrieved successfully',
  SESSION_SCHEDULED: 'Coaching session scheduled successfully',
  COACHING_PLAN_CREATED: 'Coaching plan created successfully',
  SALARY_BENCHMARKED: 'Salary benchmark analyzed successfully',
  NEGOTIATION_TIPS_RETRIEVED: 'Negotiation tips retrieved successfully',
  REPORT_GENERATED: 'Market report generated successfully',
  REPORT_RETRIEVED: 'Market report retrieved successfully',

  // Smart Notification Timing
  TIMING_PREFERENCES_UPDATED: 'Smart notification timing preferences updated successfully',
  OPTIMAL_TIME_CALCULATED: 'Optimal notification time calculated successfully',
  TIMING_ANALYSIS_RETRIEVED: 'Notification timing analysis retrieved successfully',
  TIMING_SETTINGS_RETRIEVED: 'Notification timing settings retrieved successfully',
  ENGAGEMENT_ANALYSIS_RETRIEVED: 'Engagement analysis retrieved successfully',
  
  // Do Not Disturb Mode
  DND_MODE_ENABLED: 'Do Not Disturb mode enabled successfully',
  DND_MODE_DISABLED: 'Do Not Disturb mode disabled successfully',
  DND_SCHEDULE_UPDATED: 'Do Not Disturb schedule updated successfully',
  DND_STATUS_RETRIEVED: 'Do Not Disturb status retrieved successfully',
  DND_SETTINGS_RETRIEVED: 'Do Not Disturb settings retrieved successfully',
  
  // VIP Company Alerts
  VIP_COMPANY_ADDED: 'VIP company added successfully',
  VIP_COMPANY_REMOVED: 'VIP company removed successfully',
  VIP_COMPANIES_RETRIEVED: 'VIP companies retrieved successfully',
  VIP_ALERT_SENT: 'VIP company alert sent successfully',
  VIP_COMPANY_UPDATED: 'VIP company updated successfully',
  VIP_COMPANY_ALERTS_RETRIEVED: 'VIP company alerts retrieved successfully',
  
  // Application Deadline Reminders
  DEADLINE_REMINDER_CREATED: 'Application deadline reminder created successfully',
  DEADLINE_REMINDER_UPDATED: 'Deadline reminder updated successfully',
  DEADLINE_REMINDERS_RETRIEVED: 'Deadline reminders retrieved successfully',
  REMINDER_SENT: 'Deadline reminder sent successfully',
  UPCOMING_DEADLINES_RETRIEVED: 'Upcoming deadlines retrieved successfully',
  DEADLINE_REMINDER_DELETED: 'Deadline reminder deleted successfully',
  
  // Profile Visibility Controls
  VISIBILITY_SETTINGS_UPDATED: 'Profile visibility settings updated successfully',
  PRIVACY_SETTINGS_RETRIEVED: 'Privacy settings retrieved successfully',
  RECRUITER_VISIBILITY_UPDATED: 'Recruiter visibility updated successfully',
  
  // Anonymous Browsing
  ANONYMOUS_MODE_ENABLED: 'Anonymous browsing enabled successfully',
  ANONYMOUS_MODE_DISABLED: 'Anonymous browsing disabled successfully',
  ANONYMOUS_SESSION_CREATED: 'Anonymous browsing session created successfully',
  ANONYMOUS_STATUS_RETRIEVED: 'Anonymous browsing status retrieved successfully',
  ANONYMOUS_SESSION_EXTENDED: 'Anonymous session extended successfully',
  ANONYMOUS_HISTORY_RETRIEVED: 'Anonymous session history retrieved successfully',
  
  // Job Alert Frequency
  ALERT_FREQUENCY_UPDATED: 'Job alert frequency updated successfully',
  ALERT_SCHEDULE_RETRIEVED: 'Alert schedule retrieved successfully',
  FREQUENCY_PREFERENCES_SAVED: 'Frequency preferences saved successfully',
  CATEGORY_FREQUENCY_UPDATED: 'Category frequency updated successfully',
  ALERT_FREQUENCY_RESET: 'Alert frequency reset to default successfully',
  ALERT_FREQUENCY_SETTINGS_RETRIEVED: 'Alert frequency settings retrieved successfully',
  
  // Email Preferences
  EMAIL_PREFERENCES_UPDATED: 'Email preferences updated successfully',
  EMAIL_SETTINGS_RETRIEVED: 'Email settings retrieved successfully',
  UNSUBSCRIBE_SUCCESSFUL: 'Unsubscribed successfully',
  SUBSCRIPTION_UPDATED: 'Email subscription updated successfully',
  EMAIL_VERIFIED: 'Email verified successfully',
  EMAIL_SUBSCRIPTION_STATUS_RETRIEVED: 'Email subscription status retrieved successfully',
  
  // Data Export
  EXPORT_REQUEST_SUBMITTED: 'Data export request submitted successfully',
  EXPORT_COMPLETED: 'Data export completed successfully',
  EXPORT_DOWNLOADED: 'Export file downloaded successfully',
  EXPORT_STATUS_RETRIEVED: 'Export status retrieved successfully',
  EXPORT_HISTORY_RETRIEVED: 'Export history retrieved successfully',
  EXPORT_CANCELLED: 'Export cancelled successfully',
  
  // Account Security
  TWO_FA_ENABLED: 'Two-factor authentication enabled successfully',
  TWO_FA_DISABLED: 'Two-factor authentication disabled successfully',
  PASSWORD_UPDATED: 'Password updated successfully',
  SECURITY_SETTINGS_UPDATED: 'Security settings updated successfully',
  LOGIN_ACTIVITY_RETRIEVED: 'Login activity retrieved successfully',
  SECURITY_AUDIT_COMPLETED: 'Security audit completed successfully',
  BACKUP_CODES_GENERATED: 'Backup codes generated successfully',
  TRUSTED_DEVICES_RETRIEVED: 'Trusted devices retrieved successfully',
  TRUSTED_DEVICE_REVOKED: 'Trusted device revoked successfully',
  ACCOUNT_LOCKED: 'Account locked successfully',
  ACCOUNT_UNLOCKED: 'Account unlocked successfully',
  SECURITY_SETTINGS_RETRIEVED: 'Security settings retrieved successfully',
  SECURITY_AUDIT_RETRIEVED: 'Security audit retrieved successfully'
};
