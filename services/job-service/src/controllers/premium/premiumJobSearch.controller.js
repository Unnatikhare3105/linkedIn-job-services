import { validationResult } from 'express-validator';
import { JobSearchService } from '../../services/premium/premium.service.js';
import CustomError from '../../utils/customError.js';
import { HTTP_STATUS } from '../../constants/messages.js';
import CustomSuccess from '../../utils/customSuccess.js';
import logger from '../../utils/logger.js';

  export const booleanSearchController = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const results = await JobSearchService.searchJobs(req.query, req.user.id, true);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No jobs found",
          })
        );
      }

      return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
        success: true,
        message: "boolean search successful",
        data: results.hits,
        meta: {
          total: results.total,
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
          aggregations: results.aggregations,
          took: results.took
        }
      }));
    } catch (error) {
      logger.error(`Boolean search error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during boolean search",
          error: error.message
        })
      );
    }
  };

  export const networkJobsController = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const jobs = await JobSearchService.getJobsInNetwork(req.user.id, limit);
      if(!jobs ) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No network jobs found",
          })
        );
      }

      return res.json(
        new CustomSuccess({
          success: true,
          message: "NNetwork jobs fetched successfully",
          data: jobs,
          meta: {
            total: jobs.length,
            source: 'network'
          }
        })
      );
    } catch (error) {
      logger.error(`Network jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during network jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const alumniJobsController = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const jobs = await JobSearchService.getAlumniJobs(req.user.id, limit);
      if (!jobs ) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No alumni jobs found",
          })
        );
      }

      return res.json(
        new CustomSuccess({
          success: true,
          message: "Alumni jobs fetched successfully",
          data: jobs,
          meta: {
            total: jobs.length,
            source: 'alumni'
          }
        })
      );
    } catch (error) {
      logger.error(`Alumni jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during alumni jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const trendingJobsController = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const jobs = await JobSearchService.getTrendingJobs(limit);
      if (!jobs ) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No trending jobs found",
          })
        );
      }

      return res.json(
        new CustomSuccess({
          success: true,
          message: "Trending jobs fetched successfully",
          data: jobs,
          meta: {
            total: jobs.length,
            source: 'trending',
            refreshed: new Date().toISOString()
          }
        })
      );
    } catch (error) {
     logger.error(`Trending jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during trending jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const newGradJobsController = async (req, res) => {
    try {
      const results = await JobSearchService.getFilteredJobs('newgrad', req.query, req.user.id);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No new grad jobs found",
          })
        );
      }
      return res.json({
        success: true,
        data: results.hits,
        meta: {
          total: results.total,
          filter: 'new_graduate',
          aggregations: results.aggregations
        }
      });
    } catch (error) {
      logger.error(`New grad jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during new grad jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const seniorJobsController = async (req, res) => {
    try {
      const results = await JobSearchService.getFilteredJobs('senior', req.query, req.user.id);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No senior level jobs found",
          })
        );
      }
      return res.json(
        new CustomSuccess({
          success: true,
          message: "Senior level jobs fetched successfully",
          data: results.hits,
          meta: {
            total: results.total,
            filter: 'senior_level',
            aggregations: results.aggregations
          }
        })
      )
    } catch (error) {
      logger.error(`Senior jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during senior jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const contractJobsController = async (req, res) => {
    try {
      const baseParams = { ...req.query, jobType: ['contract', 'freelance'] };
      const results = await JobSearchService.searchJobs(baseParams, req.user.id);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No contract or freelance jobs found",
          })
        );
      }
      return res.json(
        new CustomSuccess({
        success: true,
        data: results.hits,
        meta: {
          total: results.total,
          filter: 'contract_freelance',
          aggregations: results.aggregations
        }
      }));
    } catch (error) {
      logger.error(`Contract/Freelance jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during contract/freelance jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const startupJobsController = async (req, res) => {
    try {
      const results = await JobSearchService.getFilteredJobs('startup', req.query, req.user.id);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No startup jobs found",
          })
        );
      }
      return res.json(
        new CustomSuccess({
          success: true,
          data: results.hits,
          meta: {
            total: results.total,
            filter: 'startup',
            aggregations: results.aggregations
          }
        })
      );
    } catch (error) {
      logger.error(`Startup jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during startup jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const fortune500JobsController = async (req, res) => {
    try {
      const results = await JobSearchService.getFilteredJobs('fortune500', req.query, req.user.id);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No Fortune 500 jobs found",
          })
        );
      }
      return res.json(
        new CustomSuccess({
          success: true,
          message: "Fortune 500 jobs fetched successfully",
          data: results.hits,
          meta: {
            total: results.total,
            filter: 'fortune500',
            aggregations: results.aggregations
          }
        })
      );
    } catch (error) {
      logger.error(`Fortune 500 jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during Fortune 500 jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const noExperienceJobsController = async (req, res) => {
    try {
      const results = await JobSearchService.getFilteredJobs('no_experience', req.query, req.user.id);
      if (!results || results.total === 0) {
        return res.status(HTTP_STATUS.NO_CONTENT).json(
          new CustomError({
            success: false,
            message: "No jobs found for the specified criteria",
          })
        );
      }
      return res.json(
        new CustomSuccess({
          success: true,
          message: "No experience required jobs fetched successfully",
          data: results.hits,
          meta: {
            total: results.total,
            filter: 'no_experience_required',
            aggregations: results.aggregations
          }
        })
      );
    } catch (error) {
      logger.error(`No experience jobs error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during no experience jobs fetch",
          error: error.message
        })
      );
    }
  };

  export const searchSuggestionsController = async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) {
        return res.json({ success: true, data: [] });
      }

      const cacheKey = `suggestions:${q.toLowerCase()}`;
      let suggestions = await JobSearchService.cacheService.get(cacheKey);

      if (!suggestions) {
        const body = {
          suggest: {
            job_titles: {
              prefix: q,
              completion: {
                field: 'title.suggest',
                size: 10,
                fuzzy: { fuzziness: 1 }
              }
            },
            companies: {
              prefix: q,
              completion: {
                field: 'company.name.suggest',
                size: 10,
                fuzzy: { fuzziness: 1 }
              }
            },
            skills: {
              prefix: q,
              completion: {
                field: 'skills.suggest',
                size: 10,
                fuzzy: { fuzziness: 1 }
              }
            },
            locations: {
              prefix: q,
              completion: {
                field: 'location.city.suggest',
                size: 10,
                fuzzy: { fuzziness: 1 }
              }
            }
          }
        };

        const response = await JobSearchService.searchService.client.search({
          index: JobSearchService.searchService.jobsIndex,
          body
        });

        suggestions = {
          titles: response.body.suggest?.job_titles?.[0]?.options?.map(opt => opt.text) || [],
          companies: response.body.suggest?.companies?.[0]?.options?.map(opt => opt.text) || [],
          skills: response.body.suggest?.skills?.[0]?.options?.map(opt => opt.text) || [],
          locations: response.body.suggest?.locations?.[0]?.options?.map(opt => opt.text) || []
        };

        await JobSearchService.cacheService.set(cacheKey, suggestions, 3600);
      }

      return res.json(
        new CustomSuccess({
          success: true,
          message: "Search suggestions fetched successfully",
          data: suggestions
        })
      );
    } catch (error) {
      logger.error(`Search suggestions error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack,
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          message: "Internal server error during search suggestions fetch",
          error: error.message
        })
      );
    }
  };

// export const createJobSearchController = (feature = 'core') => {
//   const service = createJobSearchService(feature);
//   return new JobSearchController(service);
// };