// // controllers/sortController.js
// // Production-ready sort controllers for job platform
// // Optimized for scalability with 10M users:
// // - Uses MongoDB indexes for efficient sorting
// // - Redis caching for frequently accessed sort results
// // - Kafka events for sort analytics
// // - Input sanitization and validation for security
// // - Pagination for large result sets
// // - Recommendations: Redis rate limiting, monitor with Prometheus, scale with PM2

// import { v4 as uuidv4 } from 'uuid';
// import logger from '../utils/logger.js';
// import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/http.js';
// import { CustomError, CustomSuccess } from '../utils/customResponses.js';
// import Job, {JobEventService} from "../model/job.model.js";
// import redisClient from '../config/redis.js';
// import { sanitizeInput, validateSortInput } from '../utils/validation.js'; // From previous code

// const HTTP_STATUS = {
//   OK: 200,
//   CREATED: 201,
//   BAD_REQUEST: 400,
//   UNAUTHORIZED: 401,
//   FORBIDDEN: 403,
//   NOT_FOUND: 404,
//   CONFLICT: 409,
//   INTERNAL_SERVER_ERROR: 500,
// };

// const ERROR_MESSAGES = {
//   INTERNAL_SERVER_ERROR: "Internal server error",
//   JOB_NOT_FOUND: "Job not found",
//   VALIDATION_ERROR: "Validation error",
// };

// const SUCCESS_MESSAGES = {
//   JOBS_RETRIEVED: "Jobs retrieved successfully",
// };

// // GET /jobs/sort/relevance - Sort by relevance (text search score)
// Controller: Sorts jobs by relevance
// export const sortByRelevance = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { query, page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ query, page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const matchQuery = {
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//     };
//     if (value.query) matchQuery.$text = { $search: value.query };

//     const cacheKey = `sort:relevance:${value.query || 'no-query'}:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Relevance sort results from cache`, {
//         userId,
//         query: value.query,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     const jobs = await Job.find(matchQuery)
//       .select('jobId title companyId location jobType createdAt')
//       .sort(value.query ? { score: { $meta: 'textScore' } } : { 'dates.posted': -1 })
//       .skip((parseInt(value.page) - 1) * parseInt(value.limit))
//       .limit(parseInt(value.limit))
//       .lean();

//     const total = await Job.countDocuments(matchQuery);

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800); // Cache for 30 minutes

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'relevance',
//       query: value.query,
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Relevance sort completed`, {
//       userId,
//       query: value.query,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by relevance: ${error.message}`, {
//       userId,
//       query,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };

// // GET /jobs/sort/date-posted - Sort by date posted (newest first)
// Controller: Sorts jobs by date posted
// export const sortByDatePosted = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const cacheKey = `sort:datePosted:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Date posted sort results from cache`, {
//         userId,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     const jobs = await Job.find({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//     })
//       .select('jobId title companyId location jobType createdAt')
//       .sort({ 'dates.posted': -1 })
//       .skip((parseInt(value.page) - 1) * parseInt(value.limit))
//       .limit(parseInt(value.limit))
//       .lean();

//     const total = await Job.countDocuments({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//     });

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'datePosted',
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Date posted sort completed`, {
//       userId,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by date posted: ${error.message}`, {
//       userId,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };

// // GET /jobs/sort/salary-high-to-low - Sort by salary descending
// Controller: Sorts jobs by salary (high to low)
// export const sortBySalaryHighToLow = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const cacheKey = `sort:salaryHighToLow:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Salary high-to-low sort results from cache`, {
//         userId,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     const jobs = await Job.find({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       'salary.max': { $exists: true },
//     })
//       .select('jobId title companyId location jobType salary createdAt')
//       .sort({ 'salary.max': -1, 'dates.posted': -1 })
//       .skip((parseInt(value.page) - 1) * parseInt(value.limit))
//       .limit(parseInt(value.limit))
//       .lean();

//     const total = await Job.countDocuments({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       'salary.max': { $exists: true },
//     });

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'salaryHighToLow',
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Salary high-to-low sort completed`, {
//       userId,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by salary high-to-low: ${error.message}`, {
//       userId,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };

// // GET /jobs/sort/salary-low-to-high - Sort by salary ascending
// Controller: Sorts jobs by salary (low to high)
// export const sortBySalaryLowToHigh = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const cacheKey = `sort:salaryLowToHigh:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Salary low-to-high sort results from cache`, {
//         userId,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     const jobs = await Job.find({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       'salary.min': { $exists: true },
//     })
//       .select('jobId title companyId location jobType salary createdAt')
//       .sort({ 'salary.min': 1, 'dates.posted': -1 })
//       .skip((parseInt(value.page) - 1) * parseInt(value.limit))
//       .limit(parseInt(value.limit))
//       .lean();

//     const total = await Job.countDocuments({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       'salary.min': { $exists: true },
//     });

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'salaryLowToHigh',
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Salary low-to-high sort completed`, {
//       userId,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by salary low-to-high: ${error.message}`, {
//       userId,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };

// // GET /jobs/sort/company-rating - Sort by company rating (highest first)
// Controller: Sorts jobs by company rating
// export const sortByCompanyRating = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const cacheKey = `sort:companyRating:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Company rating sort results from cache`, {
//         userId,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     const jobs = await Job.find({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       'company.rating': { $exists: true },
//     })
//       .select('jobId title companyId location jobType company.rating createdAt')
//       .sort({ 'company.rating': -1, 'dates.posted': -1 })
//       .skip((parseInt(value.page) - 1) * parseInt(value.limit))
//       .limit(parseInt(value.limit))
//       .lean();

//     const total = await Job.countDocuments({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       'company.rating': { $exists: true },
//     });

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'companyRating',
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Company rating sort completed`, {
//       userId,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by company rating: ${error.message}`, {
//       userId,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };

// // GET /jobs/sort/most-applied - Sort by number of applications
// export const sortByMostApplied = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const cacheKey = `sort:mostApplied:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Most applied sort results from cache`, {
//         userId,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     const jobs = await Job.find({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       applicationCount: { $exists: true },
//     })
//       .select('jobId title companyId location jobType applicationCount createdAt')
//       .sort({ applicationCount: -1, 'dates.posted': -1 })
//       .skip((parseInt(value.page) - 1) * parseInt(value.limit))
//       .limit(parseInt(value.limit))
//       .lean();

//     const total = await Job.countDocuments({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       applicationCount: { $exists: true },
//     });

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'mostApplied',
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Most applied sort completed`, {
//       userId,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by most applied: ${error.message}`, {
//       userId,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };

// // GET /jobs/sort/trending - Sort trending jobs (based on application rate and recency)
// export const sortByTrending = async (req, res) => {
//   const requestId = uuidv4();
//   const startTime = Date.now();
//   const userId = req.user?.id;
//   const { page = 1, limit = 20 } = req.query;

//   try {
//     const sanitizedInput = sanitizeInput({ page, limit });
//     const { error, value } = validateSortInput(sanitizedInput);
//     if (error) {
//       return res.status(HTTP_STATUS.BAD_REQUEST).json(new CustomError({
//         success: false,
//         message: `Validation error: ${error.message}`,
//         statusCode: HTTP_STATUS.BAD_REQUEST,
//         details: error,
//       }));
//     }

//     const cacheKey = `sort:trending:${value.page}:${value.limit}`;
//     const cachedResults = await redisClient.get(cacheKey);
//     if (cachedResults) {
//       logger.info(`[${requestId}] Trending sort results from cache`, {
//         userId,
//         duration: Date.now() - startTime,
//       });
//       return res.status(HTTP_STATUS.OK).json(JSON.parse(cachedResults));
//     }

//     // Define trending as a weighted score: applicationCount / days since posted
//     const jobs = await Job.aggregate([
//       {
//         $match: {
//           status: 'active',
//           isDeleted: false,
//           'dates.expires': { $gt: new Date() },
//           applicationCount: { $exists: true },
//           'dates.posted': { $exists: true },
//         },
//       },
//       {
//         $addFields: {
//           daysSincePosted: {
//             $divide: [
//               { $subtract: [new Date(), '$dates.posted'] },
//               1000 * 60 * 60 * 24, // Convert ms to days
//             ],
//           },
//         },
//       },
//       {
//         $addFields: {
//           trendScore: {
//             $divide: ['$applicationCount', { $max: ['$daysSincePosted', 1] }], // Avoid division by zero
//           },
//         },
//       },
//       {
//         $sort: { trendScore: -1, 'dates.posted': -1 },
//       },
//       {
//         $skip: (parseInt(value.page) - 1) * parseInt(value.limit),
//       },
//       {
//         $limit: parseInt(value.limit),
//       },
//       {
//         $project: {
//           jobId: 1,
//           title: 1,
//           companyId: 1,
//           location: 1,
//           jobType: 1,
//           applicationCount: 1,
//           createdAt: 1,
//           trendScore: 1,
//         },
//       },
//     ]);

//     const total = await Job.countDocuments({
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() },
//       applicationCount: { $exists: true },
//     });

//     const response = new CustomSuccess({
//       message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
//       data: {
//         jobs,
//         pagination: {
//           page: parseInt(value.page),
//           limit: parseInt(value.limit),
//           total,
//           totalPages: Math.ceil(total / parseInt(value.limit)),
//         },
//       },
//     });

//     await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 1800);

//     JobEventService.emit('analytics:sort', {
//       userId,
//       type: 'trending',
//       resultCount: jobs.length,
//       metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
//     }).catch(err => logger.error(`[${requestId}] Async event failed`, { err }));

//     logger.info(`[${requestId}] Trending sort completed`, {
//       userId,
//       count: jobs.length,
//       page: value.page,
//       limit: value.limit,
//       duration: Date.now() - startTime,
//     });

//     return res.status(HTTP_STATUS.OK).json(response);
//   } catch (error) {
//     logger.error(`[${requestId}] Failed to sort jobs by trending: ${error.message}`, {
//       userId,
//       error: error.stack,
//       duration: Date.now() - startTime,
//     });
//     return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(new CustomError({
//       success: false,
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message,
//     }));
//   }
// };