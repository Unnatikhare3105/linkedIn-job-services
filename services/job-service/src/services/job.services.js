import { v4 as uuidv4 } from 'uuid';
import Job,{ JobEventService, JobVectorService, StatsService } from '../model/job.model.js';
import logger from '../utils/logger.js';
import CustomError from '../utils/CustomError.js';
import { sanitizeInput, sanitizeUserId } from '../utils/security.js';
import { validateCreateJobInput, validateUpdateJobInput, validateListJobsFilters } from '../utils/validators.js';

// Constants for HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
};

// Constants for error messages
const ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid input data',
  JOB_NOT_FOUND: 'Job not found',
  FORBIDDEN: 'User not authorized',
  JOB_CREATION_FAILED: 'Failed to create job',
  JOB_UPDATE_FAILED: 'Failed to update job',
  JOB_DELETE_FAILED: 'Failed to delete job',
  JOB_LIST_FAILED: 'Failed to list jobs',
  FEATURED_JOBS_FAILED: 'Failed to fetch featured jobs',
};

export const createJob = async ({userId, requestId, sanitizedInput}) => {
  try {

    if(!sanitizedInput){
      throw new Error("Job data is required");
    }

    const { error, value } = validateCreateJobInput(sanitizeInput(sanitizedInput));
    // Generate job ID and prepare job data
    const jobId = uuidv4();
    const createdBy = sanitizeUserId(userId);
    const jobData = {
      jobId,
      ...value,
      createdBy,
      updatedBy: createdBy,
      stats: {
        views: 0,
        applications: 0,
        saves: 0,
        shares: 0,
        clickThroughRate: 0,
        conversionRate: 0,
      },
    };

    // Create job in MongoDB
    const job = await Job.create(jobData);
    if (!job) {
      throw new Error('Failed to create job');
    }

    // Emit job creation event to Kafka
    await JobEventService.emit('job:created', {
      jobId: job.jobId,
      companyId: job.companyId,
      title: job.title,
      skills: job.skills.map((s) => s.name),
      location: job.location,
      requestId,
    });
    
    // Generate and store job embedding in vector DB
    await JobVectorService.generateJobEmbedding(createJob);

    // Initialize stats in Redis
    await StatsService.incrementJobStats(createJob.jobId, 'views', 0);

    return job;

  } catch (error) {
    logger.error(`[${requestId}] Failed to create job: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      input: req.body,
      duration: Date.now() - startTime,
    });
  };
};

export const getJobById = async ({jobId, requestId}) => {
  try {
      const job = await Job.findOne({ jobId, isDeleted: false }).lean();
      if (!job) {
        logger.warn(`[${requestId}] Job not found`, { jobId, userId: req.user?.id });
        return res.status(HTTP_STATUS.NOT_FOUND).json(
          new CustomError({
            message: ERROR_MESSAGES.JOB_NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          })
        );
      }
  
      // Increment view count in Redis
      await StatsService.incrementJobStats(jobId, 'views');
  
      // Emit job viewed event
      await JobEventService.emit('analytics:job_viewed', {
        jobId,
        userId: req.user?.id || 'anonymous',
        timestamp: new Date().toISOString(),
        requestId,
      });

      return job;
    } catch (error) {
      logger.error(`[${requestId}] Failed to fetch job: ${error.message}`, {
        jobId,
        userId: req.user?.id,
        error: error.stack,
        duration: Date.now() - startTime,
      });
      throw new CustomError({
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
      });
    }
  }


export const updateJob = async ({jobId, userId, requestId, updates}) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      throw new CustomError('Invalid job ID format', 400);
    }
    const updatedBy = sanitizeUserId(userId);
    const { error, value } = validateUpdateJobInput(sanitizeInput(updates));

    const job = await Job.findOneAndUpdate(
      { jobId, isDeleted: false },
      { $set: { ...value, updatedBy, 'dates.lastUpdated': new Date() }, $inc: { version: 1 } },
      { new: true, runValidators: true }
    ).lean();

    if (!job) {
      logger.warn(`[${requestId}] Job not found for update`, { jobId, userId: req.user?.id });
      throw new CustomError(ERROR_MESSAGES.JOB_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    // Emit job updated event
    await JobEventService.emit('job:updated', {
      jobId,
      changes: Object.keys(value),
      requestId,
    });

    // Update vector DB if relevant fields changed
    if (value.title || value.description || value.skills || value.requirements) {
      await JobVectorService.generateJobEmbedding(job);
    }
    return job;

}catch (error) {
    logger.error(`[${requestId}] Failed to update job: ${error.message}`, {
      jobId,
      userId: req.user?.id,
      error: error.stack,
      input: updates,
      duration: Date.now() - startTime,
    });
    return error;
};
};

export const listJobs = async ({filters, requestId}) => {
  const { page = 1, limit = 20, ...queryFilters } = filters;
  const query = { isDeleted: false };

  const validation = validateListJobsFilters(queryFilters);
  if (validation.error) {
    throw new CustomError({
      message: ERROR_MESSAGES.INVALID_INPUT,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details: validation.error.details,
    });
  }

  if (queryFilters.title) query.title = new RegExp(queryFilters.title, 'i');
  if (queryFilters.companyId) query.companyId = queryFilters.companyId;
  if (queryFilters.jobType) query.jobType = queryFilters.jobType;
  if (queryFilters.location) {
    if (queryFilters.location.city) query['location.city'] = new RegExp(queryFilters.location.city, 'i');
    if (queryFilters.location.state) query['location.state'] = new RegExp(queryFilters.location.state, 'i');
    if (queryFilters.location.country) query['location.country'] = new RegExp(queryFilters.location.country, 'i');
    if (queryFilters.location.isRemote) query['location.isRemote'] = queryFilters.location.isRemote;
  }
  if (queryFilters.experience?.level) query['experience.level'] = queryFilters.experience.level;
  if (queryFilters.skills) query['skills.name'] = { $in: queryFilters.skills.map(s => s.toLowerCase()) };
  if (queryFilters.industry) query.industry = queryFilters.industry;
  if (queryFilters.isFeatured) query.isFeatured = queryFilters.isFeatured;
  if (queryFilters.isUrgent) query.isUrgent = queryFilters.isUrgent;
  if (queryFilters.diversityTags) query.diversityTags = { $in: queryFilters.diversityTags };

  const jobs = await Job.find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ 'dates.posted': -1 })
    .lean();

  for (const job of jobs) {
    await StatsService.incrementJobStats(job.jobId, 'views');
    await JobEventService.emit('analytics:job_viewed', {
      jobId: job.jobId,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  return jobs;
};

export const getFeaturedJobs = async ({requestId}) => {
  try{
  const jobs = await Job.find({ isFeatured: true, isDeleted: false })
    .limit(10)
    .sort({ 'dates.posted': -1 })
    .lean();

    // Increment views for each featured job
    for (const job of jobs) {
      await StatsService.incrementJobStats(job.jobId, 'views');
      await JobEventService.emit('analytics:job_viewed', {
        jobId: job.jobId,
        userId: req.user?.id || 'anonymous',
        timestamp: new Date().toISOString(),
        requestId,
      });
    }
    return jobs;
  }catch (error) {
    logger.error(`[${requestId}] Failed to fetch featured jobs: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack,
      duration: Date.now() - startTime,
    });
    throw new CustomError({
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
    });
  }
};