import Joi from 'joi';
import { validate as uuidValidate } from 'uuid';

const uuid = () => Joi.string().custom((value, helpers) => {
  if (!uuidValidate(value)) {
    return helpers.error('string.uuid');
  }
  return value;
}, 'UUID validation');

export const schemas = {
  followUpReminder: Joi.object({
    applicationId: uuid().required(),
    userId: uuid().required(),
    reminderDate: Joi.date().min('now').required(),
    message: Joi.string().max(500).required(),
    type: Joi.string().valid('email', 'call', 'linkedin').required(),
  }),

  interview: Joi.object({
    id: uuid(),
    applicationId: uuid().required(),
    userId: uuid().required(),
    companyName: Joi.string().max(100).required(),
    position: Joi.string().max(100).required(),
    interviewDate: Joi.date().min('now').required(),
    type: Joi.string().valid('phone', 'video', 'in-person', 'technical').required(),
    interviewerName: Joi.string().max(100),
    notes: Joi.string().max(2000),
    status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'rescheduled').default('scheduled'),
  }),

  offer: Joi.object({
    id: uuid(),
    applicationId: uuid().required(),
    userId: uuid().required(),
    companyName: Joi.string().max(100).required(),
    position: Joi.string().max(100).required(),
    salary: Joi.number().positive().max(10000000),
    equity: Joi.number().min(0).max(100),
    benefits: Joi.array().items(Joi.string().max(100)),
    deadline: Joi.date().min('now'),
    status: Joi.string().valid('pending', 'accepted', 'declined', 'negotiating').default('pending'),
    notes: Joi.string().max(1000),
  }),

  applicationNote: Joi.object({
    id: uuid(),
    applicationId: uuid().required(),
    userId: uuid().required(),
    content: Joi.string().max(5000).required(),
    tags: Joi.array().items(Joi.string().max(50)).max(20),
    isPrivate: Joi.boolean().default(true),
  }),

  batchApplication: Joi.object({
    userId: uuid().required(),
    jobIds: Joi.array().items(uuid()).min(1).max(50).required(),
    templateId: uuid().required(),
    customizations: Joi.object().pattern(uuid(), Joi.string().max(1000))
  }),

  applicationTemplate: Joi.object({
    id: uuid(),
    userId: uuid().required(),
    name: Joi.string().max(100).required(),
    coverLetter: Joi.string().max(5000).required(),
    customFields: Joi.object(),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
  }),

  quickApplySettings: Joi.object({
    resumeId: uuid(),
    defaultCoverLetter: Joi.string().max(5000),
    templates: Joi.array().items(uuid()).max(10),
    autoApplyFilters: Joi.object({
      location: Joi.array().items(Joi.string().max(100)),
      salaryMin: Joi.number().positive(),
      jobType: Joi.array().items(Joi.string().valid('full-time', 'part-time', 'contract', 'remote')),
    }),
  }),

  videoIntro: Joi.object({
    id: uuid(),
    userId: uuid().required(),
    title: Joi.string().max(100).required(),
    duration: Joi.number().positive().max(300),
    fileSize: Joi.number().positive().max(100000000),
    transcription: Joi.string().max(10000),
    tags: Joi.array().items(Joi.string().max(50)).max(20),
  }),

  reference: Joi.object({
    id: uuid(),
    userId: uuid().required(),
    name: Joi.string().max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/),
    company: Joi.string().max(100),
    position: Joi.string().max(100),
    relationship: Joi.string().max(100),
    notes: Joi.string().max(1000),
  }),

  portfolio: Joi.object({
    id: uuid(),
    userId: uuid().required(),
    title: Joi.string().max(100).required(),
    description: Joi.string().max(1000),
    fileUrl: Joi.string().uri().required(),
    fileType: Joi.string().valid('pdf', 'image', 'video', 'document').required(),
    fileSize: Joi.number().positive().max(50000000),
    categories: Joi.array().items(Joi.string().max(50)).max(10),
    createdAt: Joi.date(),
  })
};

export const searchValidationSchema = Joi.object({
  q: Joi.string().max(200).optional(),
  location: Joi.string().max(100).optional(),
  company: Joi.string().max(100).optional(),
  title: Joi.string().max(100).optional(),
  skills: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  industries: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  experienceLevel: Joi.string().valid('entry', 'mid', 'senior', 'executive').optional(),
  salaryMin: Joi.number().min(0).max(1000000).optional(),
  salaryMax: Joi.number().min(0).max(2000000).optional(),
  jobType: Joi.string().valid('full-time', 'part-time', 'contract', 'freelance', 'internship').optional(),
  companySize: Joi.string().valid('startup', 'small', 'medium', 'large', 'fortune500').optional(),
  remote: Joi.boolean().optional(),
  noExperienceRequired: Joi.boolean().optional(),
  page: Joi.number().min(1).max(1000).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().valid('relevance', 'date', 'salary', 'trending').default('relevance')
});


export const VALIDATION_SCHEMAS = {
  skillsGapAnalysis: Joi.object({
    userId: Joi.string().uuid().required(),
    currentSkills: Joi.array().items(
      Joi.object({
        skillId: Joi.string().required(),
        skillName: Joi.string().max(100).required(),
        proficiencyLevel: Joi.number().min(0).max(5).required()
      })
    ).min(1).max(100).required(),
    targetRole: Joi.string().max(100).required(),
    targetIndustry: Joi.string().max(50).optional(),
    careerLevel: Joi.string().valid('entry', 'junior', 'mid', 'senior', 'lead', 'executive').required()
  }),

  careerPathRequest: Joi.object({
    userId: Joi.string().uuid().required(),
    currentRole: Joi.string().max(100).required(),
    currentLevel: Joi.string().valid('entry', 'junior', 'mid', 'senior', 'lead', 'executive').required(),
    industry: Joi.string().max(50).required(),
    careerGoals: Joi.array().items(Joi.string().max(100)).min(1).max(10).required()
  }),

  skillAssessment: Joi.object({
    userId: Joi.string().uuid().required(),
    skillId: Joi.string().required(),
    assessmentType: Joi.string().valid('multiple_choice', 'coding', 'practical', 'portfolio').required(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').required(),
    timeLimit: Joi.number().min(300).max(7200).optional().default(1800)
  }),

  certification: Joi.object({
    userId: Joi.string().uuid().required(),
    certificationName: Joi.string().max(200).required(),
    issuingOrganization: Joi.string().max(100).required(),
    issueDate: Joi.date().iso().required(),
    expiryDate: Joi.date().iso().optional(),
    credentialId: Joi.string().max(50).optional(),
    credentialUrl: Joi.string().uri().optional()
  }),

  linkedinLearning: Joi.object({
    userId: Joi.string().uuid().required(),
    accessToken: Joi.string().required(),
    syncPreferences: Joi.object({
      autoSync: Joi.boolean().optional(),
      syncFrequency: Joi.string().valid('daily', 'weekly', 'monthly').optional(),
      courseCategories: Joi.array().items(Joi.string().max(50)).optional()
    }).optional()
  }),

  mockInterview: Joi.object({
    userId: Joi.string().uuid().required(),
    interviewType: Joi.string().valid('behavioral', 'technical', 'case_study', 'system_design', 'general').required(),
    jobRole: Joi.string().max(100).required(),
    experienceLevel: Joi.string().valid('entry', 'junior', 'mid', 'senior', 'lead', 'executive').required(),
    scheduledAt: Joi.date().iso().required(),
    duration: Joi.number().min(15).max(120).required(),
    coachPreferences: Joi.object({
      specializations: Joi.array().items(Joi.string().max(50)).optional(),
      industry: Joi.string().max(50).optional(),
      minRating: Joi.number().min(0).max(5).optional()
    }).optional()
  }),

  resumeReview: Joi.object({
    userId: Joi.string().uuid().required(),
    targetRole: Joi.string().max(100).required(),
    reviewType: Joi.string().valid('basic', 'detailed', 'ats_optimization', 'executive').optional(),
    urgency: Joi.string().valid('standard', 'rush', 'same_day').optional()
  }),

  coachingSession: Joi.object({
    userId: Joi.string().uuid().required(),
    sessionType: Joi.string().valid('career_planning', 'interview_prep', 'salary_negotiation', 'skill_development', 'leadership_coaching', 'career_transition').required(),
    scheduledAt: Joi.date().iso().required(),
    duration: Joi.number().min(30).max(120).required(),
    sessionMode: Joi.string().valid('video', 'phone', 'in_person').optional().default('video'),
    goals: Joi.array().items(Joi.string().max(200)).min(1).max(5).required(),
    coachPreferences: Joi.object({
      specializations: Joi.array().items(Joi.string().max(50)).optional(),
      industry: Joi.string().max(50).optional(),
      minRating: Joi.number().min(0).max(5).optional()
    }).optional()
  }),

  salaryNegotiation: Joi.object({
    userId: Joi.string().uuid().required(),
    jobTitle: Joi.string().max(100).required(),
    location: Joi.string().max(100).required(),
    industry: Joi.string().max(50).required(),
    experienceYears: Joi.number().min(0).max(50).required(),
    currentSalary: Joi.number().min(0).optional(),
    offerSalary: Joi.number().min(0).optional()
  }),

  marketReport: Joi.object({
    userId: Joi.string().uuid().required(),
    reportType: Joi.string().valid('industry_overview', 'skill_demand', 'salary_trends', 'hiring_trends', 'competitive_analysis', 'custom').required(),
    filters: Joi.object({
      industry: Joi.string().max(50).optional(),
      location: Joi.string().max(100).optional(),
      jobLevel: Joi.string().valid('entry', 'junior', 'mid', 'senior', 'lead', 'executive').optional(),
      timeRange: Joi.string().valid('last_6_months', 'last_year', 'last_2_years').optional()
    }).optional()
  })
};

export const NOTIFICATION_VALIDATION_SCHEMAS = {
  // Smart Notification Timing
  notificationTiming: Joi.object({
    userId: Joi.string().uuid().required(),
    timezone: Joi.string().required(),
    preferredTimes: Joi.object({
      morning: Joi.object({
        enabled: Joi.boolean().default(true),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      }),
      afternoon: Joi.object({
        enabled: Joi.boolean().default(true),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      }),
      evening: Joi.object({
        enabled: Joi.boolean().default(true),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
      })
    }).required(),
    weekdayPreferences: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).required(),
    smartOptimization: Joi.boolean().default(true),
    maxNotificationsPerHour: Joi.number().min(1).max(10).default(3),
    respectLocalHolidays: Joi.boolean().default(true)
  }),

  // Do Not Disturb Mode
  dndSettings: Joi.object({
    userId: Joi.string().uuid().required(),
    enabled: Joi.boolean().required(),
    schedules: Joi.array().items(
      Joi.object({
        name: Joi.string().max(50),
        days: Joi.array().items(
          Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        ).min(1).required(),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        enabled: Joi.boolean().default(true)
      })
    ).max(5),
    allowEmergencyNotifications: Joi.boolean().default(false),
    emergencyKeywords: Joi.array().items(Joi.string().max(50)).max(10),
    vipBypass: Joi.boolean().default(false)
  }),

  // VIP Company Alerts
  vipCompany: Joi.object({
    userId: Joi.string().uuid().required(),
    companyId: Joi.string().required(),
    companyName: Joi.string().max(200).required(),
    alertTypes: Joi.array().items(
      Joi.string().valid('new_jobs', 'company_news', 'hiring_events', 'salary_updates', 'culture_updates')
    ).min(1).required(),
    priority: Joi.string().valid('high', 'medium', 'low').default('high'),
    instantNotifications: Joi.boolean().default(true),
    jobRoleFilters: Joi.array().items(Joi.string().max(100)).max(20),
    locationFilters: Joi.array().items(Joi.string().max(100)).max(10)
  }),

  // Application Deadline Reminders
  deadlineReminder: Joi.object({
    userId: Joi.string().uuid().required(),
    jobId: Joi.string().required(),
    jobTitle: Joi.string().max(200).required(),
    companyName: Joi.string().max(200).required(),
    applicationDeadline: Joi.date().greater('now').required(),
    reminderSettings: Joi.object({
      firstReminder: Joi.number().valid(1, 2, 3, 7, 14).default(7), // days before deadline
      secondReminder: Joi.number().valid(1, 2, 3).default(2), // days before deadline
      finalReminder: Joi.number().valid(1, 6, 12, 24).default(24), // hours before deadline
      customMessage: Joi.string().max(500)
    }),
    priority: Joi.string().valid('high', 'medium', 'low').default('medium'),
    notificationChannels: Joi.array().items(
      Joi.string().valid('push', 'email', 'sms')
    ).min(1).required()
  }),

  // Profile Visibility Controls
  visibilitySettings: Joi.object({
    userId: Joi.string().uuid().required(),
    profileVisibility: Joi.string().valid('public', 'private', 'network_only', 'recruiters_only').default('public'),
    searchableByRecruiters: Joi.boolean().default(true),
    showInCompanySearch: Joi.boolean().default(true),
    allowDirectMessages: Joi.boolean().default(true),
    showActivityStatus: Joi.boolean().default(false),
    hideFromCurrentEmployer: Joi.boolean().default(false),
    currentEmployerDomains: Joi.array().items(Joi.string().domain()).max(10),
    blockedCompanies: Joi.array().items(Joi.string()).max(50),
    visibleFields: Joi.object({
      email: Joi.boolean().default(false),
      phone: Joi.boolean().default(false),
      currentSalary: Joi.boolean().default(false),
      workHistory: Joi.boolean().default(true),
      education: Joi.boolean().default(true),
      skills: Joi.boolean().default(true),
      certifications: Joi.boolean().default(true),
      portfolio: Joi.boolean().default(true)
    })
  }),

  // Anonymous Browsing
  anonymousSession: Joi.object({
    userId: Joi.string().uuid().required(),
    enabled: Joi.boolean().required(),
    sessionDuration: Joi.number().min(15).max(480).default(60), // minutes
    trackingPreferences: Joi.object({
      saveSearchHistory: Joi.boolean().default(false),
      saveViewHistory: Joi.boolean().default(false),
      allowAnalytics: Joi.boolean().default(false)
    }),
    autoExpire: Joi.boolean().default(true)
  }),

  // Job Alert Frequency
  alertFrequency: Joi.object({
    userId: Joi.string().uuid().required(),
    globalFrequency: Joi.string().valid('instant', 'hourly', 'daily', 'weekly', 'monthly', 'disabled').default('daily'),
    categoryFrequencies: Joi.object({
      newJobs: Joi.string().valid('instant', 'hourly', 'daily', 'weekly', 'disabled').default('daily'),
      jobRecommendations: Joi.string().valid('daily', 'weekly', 'monthly', 'disabled').default('weekly'),
      applicationUpdates: Joi.string().valid('instant', 'daily', 'weekly', 'disabled').default('instant'),
      companyUpdates: Joi.string().valid('daily', 'weekly', 'monthly', 'disabled').default('weekly'),
      networkActivity: Joi.string().valid('daily', 'weekly', 'disabled').default('weekly'),
      marketInsights: Joi.string().valid('weekly', 'monthly', 'disabled').default('monthly'),
      learningOpportunities: Joi.string().valid('weekly', 'monthly', 'disabled').default('monthly')
    }),
    quietHours: Joi.object({
      enabled: Joi.boolean().default(true),
      startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('22:00'),
      endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('08:00')
    }),
    weekendDelivery: Joi.boolean().default(false),
    maxAlertsPerDay: Joi.number().min(1).max(50).default(10)
  }),

  // Email Preferences
  emailPreferences: Joi.object({
    userId: Joi.string().uuid().required(),
    emailAddress: Joi.string().email().required(),
    globalEmailEnabled: Joi.boolean().default(true),
    subscriptions: Joi.object({
      jobAlerts: Joi.boolean().default(true),
      applicationUpdates: Joi.boolean().default(true),
      companyNews: Joi.boolean().default(true),
      weeklyDigest: Joi.boolean().default(true),
      monthlyReport: Joi.boolean().default(true),
      marketingEmails: Joi.boolean().default(false),
      partnerOffers: Joi.boolean().default(false),
      surveyInvitations: Joi.boolean().default(false),
      productUpdates: Joi.boolean().default(true),
      securityAlerts: Joi.boolean().default(true)
    }),
    emailFormat: Joi.string().valid('html', 'text', 'both').default('html'),
    frequency: Joi.object({
      immediate: Joi.array().items(Joi.string()),
      daily: Joi.array().items(Joi.string()),
      weekly: Joi.array().items(Joi.string()),
      monthly: Joi.array().items(Joi.string())
    }),
    unsubscribeAll: Joi.boolean().default(false)
  }),

  // Data Export
  dataExport: Joi.object({
    userId: Joi.string().uuid().required(),
    exportType: Joi.string().valid('full', 'profile', 'applications', 'search_history', 'preferences', 'analytics').default('full'),
    format: Joi.string().valid('json', 'csv', 'xml', 'pdf').default('json'),
    dateRange: Joi.object({
      startDate: Joi.date(),
      endTime: Joi.date().greater(Joi.ref('startDate'))
    }),
    includeDeleted: Joi.boolean().default(false),
    anonymize: Joi.boolean().default(false),
    compressionEnabled: Joi.boolean().default(true),
    deliveryMethod: Joi.string().valid('download', 'email', 'secure_link').default('download')
  }),

  // Account Security
  securitySettings: Joi.object({
    userId: Joi.string().uuid().required(),
    currentPassword: Joi.string().when('newPassword', {
      is: Joi.exist(),
      then: Joi.required()
    }),
    newPassword: Joi.string().min(8).max(128).pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    ),
    twoFactorAuth: Joi.object({
      enabled: Joi.boolean().required(),
      method: Joi.string().valid('sms', 'email', 'authenticator').when('enabled', {
        is: true,
        then: Joi.required()
      }),
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).when('method', {
        is: 'sms',
        then: Joi.required()
      }),
      backupCodes: Joi.array().items(Joi.string()).length(10)
    }),
    loginNotifications: Joi.boolean().default(true),
    sessionTimeout: Joi.number().min(15).max(1440).default(480), // minutes
    allowMultipleSessions: Joi.boolean().default(true),
    ipWhitelist: Joi.array().items(Joi.string().ip()).max(10),
    deviceTrust: Joi.boolean().default(true)
  }),

  // Security Token Verification
  tokenVerification: Joi.object({
    token: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    userId: Joi.string().uuid().required(),
    action: Joi.string().valid('enable_2fa', 'disable_2fa', 'password_reset', 'email_change').required()
  })
};


