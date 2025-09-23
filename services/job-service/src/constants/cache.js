// Cache TTL configurations
export const CACHE_TTL = {
  COMPANY_PAGE: 3600, // 1 hour
  EMPLOYEE_REVIEWS: 1800, // 30 minutes
  COMPANY_CULTURE: 7200, // 2 hours

  company_verification: 604800, // 1 week
  spam_check: 86400, // 1 day
  salary_verification: 86400, // 1 day
  duplicate_check: 3600, // 1 hour
  quality_assessment: 86400, // 1 day

  MATCH_SCORE: 300,
  RECOMMENDED_JOBS: 600,
  RECENT_JOBS: 180,
  EXPIRING_JOBS: 300,
  USER_PROFILE: 900,
  ANALYTICS: 1800,
  BATCH_RESULTS: 3600,
  INVITATION_ANALYTICS: 86400, // 24 hours for invitation analytics

  COMPANY_VERIFICATION: 604800, // 1 week
  JOB_SPAM: 86400, // 1 day
  SALARY_VERIFICATION: 86400, // 1 day
  DUPLICATE_APPLICATION: 3600, // 1 hour
  JOB_QUALITY: 86400, // 1 day

  RESUME_OPTIMIZATION: 86400, // 1 day
  JOB_MATCHES: 3600, // 1 hour
  JOB_ANALYSIS: 7200, // 2 hours
  TOP_APPLICANT_JOBS: 1800, // 30 minutes
  COMPANY_VERIFICATION: 604800, // 1 week

  //premium
  FOLLOW_UPS: 86400 * 30, // 30 days
  INTERVIEWS: 86400 * 90, // 90 days
  OFFERS: 86400 * 180, // 180 days
  NOTES: 86400 * 365, // 1 year
  TEMPLATES: 86400 * 365, // 1 year
  QUICK_APPLY: 86400 * 30, // 30 days
  SCORING: 86400 * 7, // 7 days
  REFERENCES: 86400 * 365, // 1 year
  PORTFOLIO: 86400 * 365, // 1 year
  THANK_YOU: 86400 * 30, // 30 days
  VIDEO: 86400 * 90, // 90 days

  // professional development
  SKILLS_GAP: 24 * 60 * 60,
  CAREER_PATH: 7 * 24 * 60 * 60,
  ASSESSMENT: 60 * 60,
  ASSESSMENT_RESULTS: 7 * 24 * 60 * 60,
  USER_CERTIFICATIONS: 24 * 60 * 60,
  LINKEDIN_COURSES: 24 * 60 * 60,
  MOCK_INTERVIEWS: 24 * 60 * 60,
  RESUME_REVIEWS: 24 * 60 * 60,
  REVIEW_FEEDBACK: 7 * 24 * 60 * 60,
  COACHING_PLAN: 7 * 24 * 60 * 60,
  SALARY_DATA: 30 * 24 * 60 * 60,
  NEGOTIATION_TIPS: 30 * 24 * 60 * 60,
  MARKET_REPORT: 7 * 24 * 60 * 60,
  INDUSTRY_SKILLS: 7 * 24 * 60 * 60,
  AVAILABLE_COACHES: 60 * 60,

  //notification seting
  // Smart Notification Timing
  NOTIFICATION_TIMING: 7200, // 2 hours
  OPTIMAL_TIME: 86400, // 24 hours
  TIMING_ANALYSIS: 21600, // 6 hours
  USER_ENGAGEMENT_PATTERN: 43200, // 12 hours
  
  // Do Not Disturb Mode
  DND_STATUS: 3600, // 1 hour
  DND_SCHEDULE: 86400, // 24 hours
  ACTIVE_DND_USERS: 300, // 5 minutes
  
  // VIP Company Alerts
  VIP_COMPANIES: 3600, // 1 hour
  VIP_ALERTS: 1800, // 30 minutes
  COMPANY_INFO: 21600, // 6 hours
  
  // Application Deadline Reminders
  DEADLINE_REMINDERS: 3600, // 1 hour
  UPCOMING_DEADLINES: 1800, // 30 minutes
  REMINDER_SCHEDULE: 7200, // 2 hours
  
  // Profile Visibility Controls
  VISIBILITY_SETTINGS: 7200, // 2 hours
  PROFILE_PRIVACY: 10800, // 3 hours
  RECRUITER_VISIBILITY: 3600, // 1 hour
  
  // Anonymous Browsing
  ANONYMOUS_SESSION: 1800, // 30 minutes
  ANONYMOUS_USER_MAP: 3600, // 1 hour
  ANONYMOUS_ACTIVITY: 1800, // 30 minutes
  
  // Job Alert Frequency
  ALERT_FREQUENCY: 7200, // 2 hours
  ALERT_SCHEDULE: 86400, // 24 hours
  FREQUENCY_HISTORY: 604800, // 1 week
  
  // Email Preferences
  EMAIL_PREFERENCES: 7200, // 2 hours
  EMAIL_SUBSCRIPTIONS: 14400, // 4 hours
  UNSUBSCRIBE_TOKENS: 86400, // 24 hours
  
  // Data Export
  EXPORT_REQUEST: 3600, // 1 hour
  EXPORT_STATUS: 1800, // 30 minutes
  EXPORT_QUEUE: 300, // 5 minutes
  
  // Account Security
  SECURITY_SETTINGS: 7200, // 2 hours
  TWO_FA_SETTINGS: 14400, // 4 hours
  LOGIN_ATTEMPTS: 900, // 15 minutes
  SECURITY_TOKENS: 600, // 10 minutes
  ACCOUNT_LOCKS: 1800 // 30 minutes
  
};

// Cache Keys
export const CACHE_KEYS = {
  FOLLOW_UPS: (userId) => `followups:${userId}`,
  INTERVIEWS: (userId) => `interviews:${userId}`,
  OFFERS: (userId) => `offers:${userId}`,
  NOTES: (applicationId) => `notes:${applicationId}`,
  TEMPLATES: (userId) => `templates:${userId}`,
  QUICK_APPLY: (userId) => `quickapply:${userId}`,
  SCORING: (applicationId) => `scoring:${applicationId}`,
  REFERENCES: (userId) => `references:${userId}`,
  PORTFOLIO: (userId) => `portfolio:${userId}`,
  SKILLS_GAP: (userId) => `skills_gap:${userId}`,
  CAREER_PATH: (userId) => `career_path:${userId}`,
  ASSESSMENT: (assessmentId) => `assessment:${assessmentId}`,
  ASSESSMENT_RESULTS: (userId, skillId) => `assessment_results:${userId}:${skillId}`,
  USER_CERTIFICATIONS: (userId) => `certifications:${userId}`,
  LINKEDIN_COURSES: (userId) => `linkedin_courses:${userId}`,
  MOCK_INTERVIEWS: (userId) => `mock_interviews:${userId}`,
  RESUME_REVIEWS: (userId) => `resume_reviews:${userId}`,
  REVIEW_FEEDBACK: (reviewId) => `review_feedback:${reviewId}`,
  COACHING_PLAN: (userId) => `coaching_plan:${userId}`,
  SALARY_DATA: (jobTitle, location) => `salary_data:${jobTitle}:${location}`,
  NEGOTIATION_TIPS: (level, industry) => `negotiation_tips:${level}:${industry}`,
  MARKET_REPORT: (reportId) => `market_report:${reportId}`,
  INDUSTRY_SKILLS: (industry) => `industry_skills:${industry}`,
  AVAILABLE_COACHES: 'available_coaches',

  // Smart Notification Timing
  NOTIFICATION_TIMING: (userId) => `notification_timing:${userId}`,
  OPTIMAL_TIME: (userId) => `optimal_time:${userId}`,
  TIMING_ANALYSIS: (userId) => `timing_analysis:${userId}`,
  USER_ENGAGEMENT_PATTERN: (userId) => `engagement_pattern:${userId}`,
  
  // Do Not Disturb Mode
  DND_STATUS: (userId) => `dnd_status:${userId}`,
  DND_SCHEDULE: (userId) => `dnd_schedule:${userId}`,
  ACTIVE_DND_USERS: 'active_dnd_users',
  
  // VIP Company Alerts
  VIP_COMPANIES: (userId) => `vip_companies:${userId}`,
  VIP_ALERTS: (userId) => `vip_alerts:${userId}`,
  COMPANY_INFO: (companyId) => `company_info:${companyId}`,
  
  // Application Deadline Reminders
  DEADLINE_REMINDERS: (userId) => `deadline_reminders:${userId}`,
  UPCOMING_DEADLINES: (userId) => `upcoming_deadlines:${userId}`,
  REMINDER_SCHEDULE: (userId) => `reminder_schedule:${userId}`,
  
  // Profile Visibility Controls
  VISIBILITY_SETTINGS: (userId) => `visibility_settings:${userId}`,
  PROFILE_PRIVACY: (userId) => `profile_privacy:${userId}`,
  RECRUITER_VISIBILITY: (userId) => `recruiter_visibility:${userId}`,
  
  // Anonymous Browsing
  ANONYMOUS_SESSION: (sessionId) => `anonymous_session:${sessionId}`,
  ANONYMOUS_USER_MAP: (userId) => `anonymous_map:${userId}`,
  ANONYMOUS_ACTIVITY: (sessionId) => `anonymous_activity:${sessionId}`,
  
  // Job Alert Frequency
  ALERT_FREQUENCY: (userId) => `alert_frequency:${userId}`,
  ALERT_SCHEDULE: (userId) => `alert_schedule:${userId}`,
  FREQUENCY_HISTORY: (userId) => `frequency_history:${userId}`,
  
  // Email Preferences
  EMAIL_PREFERENCES: (userId) => `email_preferences:${userId}`,
  EMAIL_SUBSCRIPTIONS: (userId) => `email_subscriptions:${userId}`,
  UNSUBSCRIBE_TOKENS: (token) => `unsubscribe_token:${token}`,
  
  // Data Export
  EXPORT_REQUEST: (userId) => `export_request:${userId}`,
  EXPORT_STATUS: (exportId) => `export_status:${exportId}`,
  EXPORT_QUEUE: 'export_queue',
  
  // Account Security
  SECURITY_SETTINGS: (userId) => `security_settings:${userId}`,
  TWO_FA_SETTINGS: (userId) => `two_fa_settings:${userId}`,
  LOGIN_ATTEMPTS: (userId) => `login_attempts:${userId}`,
  SECURITY_TOKENS: (token) => `security_token:${token}`,
  ACCOUNT_LOCKS: (userId) => `account_lock:${userId}`

};
