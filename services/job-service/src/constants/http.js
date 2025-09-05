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
};
