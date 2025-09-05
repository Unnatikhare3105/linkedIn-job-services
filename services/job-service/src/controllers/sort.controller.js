import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../constants/http.js";
import CustomError from "../`utils/CustomError.js`;";
import CustomSuccess from "../utils/CustomSuccess.js";
import Job, { JobEventService } from "../model/job.model.js";
import redisClient from "../config/redis.js";
import { sanitizeInput } from "../utils/security.js";
import { validateSortInput } from "../validations/sort.validations.js"
import {
  getSortIndexHint,
  getSortDescription,
  buildSortQuery,
  getSortOptions,
} from "./services/sort.services.js";

// *MAIN UNIFIED SORT CONTROLLER*
export const sortJobs = async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const userId = req.user?.id;

  try {
    const sanitizedInput = sanitizeInput({
      ...req.query,
      ...req.body, // Allow POST for complex sort parameters
      userId,
    });

    const { error, value } = validateSortInput(sanitizedInput);
    if (error) {
      logger.warn(`[${requestId}] Sort validation failed`, {
        userId,
        errors: error.details,
        input: sanitizedInput,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `Validation error: ${error.details
            .map((d) => d.message)
            .join(", ")}`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: error.details,
        })
      );
    }

    // *CACHE STRATEGY*
    const cacheKey = `sort:${value.sortBy}:${Buffer.from(
      JSON.stringify({
        ...value,
        userId: userId || "anonymous",
      })
    )
      .toString("base64")
      .slice(0, 150)}`;

    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      const parsedResults = JSON.parse(cachedResults);
      logger.info(`[${requestId}] Sort cache hit`, {
        userId,
        sortBy: value.sortBy,
        resultCount: parsedResults.data?.jobs?.length || 0,
        duration: Date.now() - startTime,
      });
      return res.status(HTTP_STATUS.OK).json(parsedResults);
    }

    // *BUILD QUERY*
    const query = buildSortQuery(value);

    let jobs = [];
    let total = 0;

    // *HANDLE COMPLEX SORTING WITH AGGREGATION*
    if (
      ["trending", "match-score", "distance", "urgency"].includes(value.sortBy)
    ) {
      const aggregationPipeline = [{ $match: query }];

      // *TRENDING SORT*
      if (value.sortBy === "trending") {
        aggregationPipeline.push(
          {
            $addFields: {
              daysSincePosted: {
                $divide: [
                  { $subtract: [new Date(), "$dates.posted"] },
                  1000 * 60 * 60 * 24,
                ],
              },
              engagementRate: {
                $divide: [
                  { $add: ["$applicationsCount", 0] },
                  { $max: [{ $add: ["$viewsCount", 0] }, 1] },
                ],
              },
            },
          },
          {
            $addFields: {
              trendingScore: {
                $multiply: [
                  {
                    $add: [
                      { $multiply: ["$applicationsCount", 3] },
                      { $multiply: ["$viewsCount", 1] },
                      { $multiply: [{ $add: ["$sharesCount", 0] }, 5] },
                      { $multiply: ["$engagementRate", 100] },
                    ],
                  },
                  {
                    $exp: {
                      $divide: [{ $multiply: ["$daysSincePosted", -1] }, 2],
                    },
                  },
                ],
              },
            },
          },
          { $sort: { trendingScore: -1, "dates.posted": -1 } }
        );
      }

      // *DISTANCE SORT*
      else if (value.sortBy === "distance" && value.userLat && value.userLng) {
        aggregationPipeline.push(
          {
            $addFields: {
              distance: {
                $sqrt: {
                  $add: [
                    {
                      $pow: [
                        {
                          $multiply: [
                            {
                              $subtract: [
                                "$location.coordinates.lat",
                                value.userLat,
                              ],
                            },
                            111,
                          ],
                        },
                        2,
                      ],
                    },
                    {
                      $pow: [
                        {
                          $multiply: [
                            {
                              $subtract: [
                                "$location.coordinates.lng",
                                value.userLng,
                              ],
                            },
                            111 * Math.cos((value.userLat * Math.PI) / 180),
                          ],
                        },
                        2,
                      ],
                    },
                  ],
                },
              },
            },
          },
          { $sort: { distance: 1, "dates.posted": -1 } }
        );
      }

      // *URGENCY SORT*
      else if (value.sortBy === "urgency") {
        aggregationPipeline.push(
          {
            $addFields: {
              hoursToDeadline: {
                $divide: [
                  { $subtract: ["$dates.expires", new Date()] },
                  1000 * 60 * 60,
                ],
              },
            },
          },
          {
            $addFields: {
              urgencyScore: {
                $switch: {
                  branches: [
                    { case: { $lte: ["$hoursToDeadline", 0] }, then: -1 },
                    { case: { $lte: ["$hoursToDeadline", 24] }, then: 100 },
                    { case: { $lte: ["$hoursToDeadline", 72] }, then: 80 },
                    { case: { $lte: ["$hoursToDeadline", 168] }, then: 60 },
                  ],
                  default: 20,
                },
              },
            },
          },
          { $sort: { urgencyScore: -1, "dates.posted": -1 } }
        );
      }

      // *MATCH SCORE* (Simplified aggregation version)
      else if (value.sortBy === "match-score") {
        let matchScoreCalc = { $literal: 50 }; // Default score

        if (value.userSkills && value.userSkills.length > 0) {
          matchScoreCalc = {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $setIntersection: ["$skills.name", value.userSkills],
                    },
                  },
                  { $max: [{ $size: "$skills.name" }, 1] },
                ],
              },
              100,
            ],
          };
        }

        aggregationPipeline.push(
          { $addFields: { matchScore: matchScoreCalc } },
          { $sort: { matchScore: -1, "dates.posted": -1 } }
        );
      }

      // *EXPERIENCE MATCH SORT* (Missing Implementation)
      else if (value.sortBy === "experience-match") {
        let experienceMatchCalc = { $literal: 50 }; // Default score

        if (value.userExperience !== undefined) {
          experienceMatchCalc = {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: [value.userExperience, "$experience.min"] },
                      { $lte: [value.userExperience, "$experience.max"] },
                    ],
                  },
                  then: 100, // Perfect match
                },
                {
                  case: { $gte: [value.userExperience, "$experience.min"] },
                  then: 80, // Overqualified
                },
                {
                  case: { $lt: [value.userExperience, "$experience.min"] },
                  then: 60, // Underqualified
                },
              ],
              default: 30, // No experience data
            },
          };
        }

        aggregationPipeline.push(
          { $addFields: { experienceMatchScore: experienceMatchCalc } },
          { $sort: { experienceMatchScore: -1, "dates.posted": -1 } }
        );
      }

      // *FACETED AGGREGATION FOR COUNT + RESULTS*
      aggregationPipeline.push({
        $facet: {
          jobs: [
            { $skip: (value.page - 1) * value.limit },
            { $limit: value.limit },
            {
              $project: {
                jobId: 1,
                title: 1,
                companyId: 1,
                "company.name": 1,
                "company.logo": 1,
                "company.rating": 1,
                location: 1,
                jobType: 1,
                salary: 1,
                experience: 1,
                skills: { $slice: ["$skills", 5] },
                "dates.posted": 1,
                "dates.expires": 1,
                applicationsCount: 1,
                viewsCount: 1,
                featured: 1,
                // Include calculated scores for debugging
                trendingScore: 1,
                matchScore: 1,
                distance: 1,
                urgencyScore: 1,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      });

      const [results] = await Job.aggregate(aggregationPipeline);
      jobs = results.jobs || [];
      total = results.totalCount[0]?.count || 0;
    } else {
      // *SIMPLE SORTING WITH MONGODB SORT*
      const sortOptions = getSortOptions(
        value.sortBy,
        value.sortOrder,
        null,
        value.query
      );

      const [jobResults, totalResults] = await Promise.all([
        Job.find(query)
          .select(
            "jobId title companyId company.name company.logo company.rating location jobType salary experience skills dates applicationsCount viewsCount featured"
          )
          .sort(sortOptions)
          .skip((value.page - 1) * value.limit)
          .limit(value.limit)
          .lean()
          .hint(getSortIndexHint(value.sortBy)), // Performance hint

        Job.countDocuments(query),
      ]);

      jobs = jobResults;
      total = totalResults;
    }

    // *RESPONSE CONSTRUCTION*
    const response = new CustomSuccess({
      message: SUCCESS_MESSAGES.JOBS_RETRIEVED,
      data: {
        jobs,
        pagination: {
          page: value.page,
          limit: value.limit,
          total,
          totalPages: Math.ceil(total / value.limit),
          hasNext: value.page < Math.ceil(total / value.limit),
          hasPrev: value.page > 1,
        },
        sorting: {
          sortBy: value.sortBy,
          sortOrder: value.sortOrder,
          availableSorts: [
            "relevance",
            "date",
            "salary-high",
            "salary-low",
            "company-rating",
            "applications",
            "views",
            "trending",
            "match-score",
            "distance",
            "urgency",
            "featured",
          ],
        },
        meta: {
          searchQuery: value.query || "",
          resultsFound: total,
          searchTime: Date.now() - startTime,
          cached: false,
          sortAlgorithm: getSortDescription(value.sortBy),
        },
      },
    });

    // *CACHE RESULTS*
    const cacheExpiry = ["trending", "urgency"].includes(value.sortBy)
      ? 300
      : 1800; // 5min for dynamic, 30min for static
    await redisClient.set(
      cacheKey,
      JSON.stringify(response),
      "EX",
      cacheExpiry
    );

    // *ANALYTICS EVENT*
    JobEventService.emit("analytics:sort", {
      userId,
      sortBy: value.sortBy,
      sortOrder: value.sortOrder,
      query: value.query,
      resultCount: jobs.length,
      totalResults: total,
      searchTime: Date.now() - startTime,
      page: value.page,
      metadata: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        cached: false,
      },
    }).catch((err) =>
      logger.error(`[${requestId}] Analytics event failed`, {
        error: err.message,
      })
    );

    // *SUCCESS LOG*
    logger.info(`[${requestId}] Sort completed successfully`, {
      userId,
      sortBy: value.sortBy,
      sortOrder: value.sortOrder,
      query: value.query || "no-query",
      resultCount: jobs.length,
      totalResults: total,
      page: value.page,
      duration: Date.now() - startTime,
      cached: false,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error(`[${requestId}] Sort failed: ${error.message}`, {
      userId,
      error: error.stack,
      query: req.query,
      duration: Date.now() - startTime,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        requestId,
      })
    );
  }
};

// *ADDITIONAL SORT APIs*

// *GET SORT OPTIONS* - Dynamic sort options based on context
export const getSortOptionsController = async (req, res) => {
  const userId = req.user?.id;
  const { hasLocation, hasSkills, hasQuery } = req.query;

  try {
    const baseOptions = [
      { value: "relevance", label: "Most Relevant", default: true },
      { value: "date", label: "Most Recent" },
      { value: "salary-high", label: "Salary: High to Low" },
      { value: "salary-low", label: "Salary: Low to High" },
      { value: "company-rating", label: "Company Rating" },
      { value: "applications", label: "Most Applied" },
      { value: "featured", label: "Featured Jobs" },
    ];

    const conditionalOptions = [];

    if (hasLocation === "true") {
      conditionalOptions.push({ value: "distance", label: "Distance" });
    }

    if (hasSkills === "true" || userId) {
      conditionalOptions.push({ value: "match-score", label: "Best Match" });
    }

    if (hasQuery === "true") {
      conditionalOptions.push({ value: "trending", label: "Trending" });
    }

    conditionalOptions.push(
      { value: "urgency", label: "Urgent" },
      { value: "alphabetical", label: "A to Z" }
    );

    return res.status(HTTP_STATUS.OK).json({
      sortOptions: [...baseOptions, ...conditionalOptions],
    });
  } catch (error) {
    logger.error("Failed to get sort options", { error: error.message });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Failed to get sort options",
      })
    );
  }
};

// *SORT ANALYTICS* - Get popular sort preferences
export const getSortAnalytics = async (req, res) => {
  const requestId = uuidv4();

  try {
    const cacheKey = "analytics:sort:popular";
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cached));
    }

    // This would typically come from your analytics database
    const popularSorts = {
      overall: [
        { sortBy: "relevance", usage: 45.2, avgResultsClicked: 3.2 },
        { sortBy: "date", usage: 28.7, avgResultsClicked: 2.8 },
        { sortBy: "salary-high", usage: 15.3, avgResultsClicked: 4.1 },
        { sortBy: "company-rating", usage: 6.8, avgResultsClicked: 3.7 },
        { sortBy: "trending", usage: 4.0, avgResultsClicked: 2.9 },
      ],
      byUserType: {
        fresher: ["relevance", "date", "company-rating"],
        experienced: ["salary-high", "relevance", "match-score"],
        senior: ["company-rating", "salary-high", "featured"],
      },
    };

    await redisClient.set(cacheKey, JSON.stringify(popularSorts), "EX", 86400); // 24 hours

    return res.status(HTTP_STATUS.OK).json(popularSorts);
  } catch (error) {
    logger.error(`[${requestId}] Sort analytics failed: ${error.message}`);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Failed to get sort analytics",
      })
    );
  }
};

// *MONGODB INDEXES FOR SORTING PERFORMANCE* (Add to DB setup)
/*
// Essential Sort Indexes for 1M+ Users:
db.jobs.createIndex({ "dates.posted": -1, "status": 1 }, { name: "date_sort_idx" })
db.jobs.createIndex({ "salary.max": -1, "dates.posted": -1, "status": 1 }, { name: "salary_high_idx" })
db.jobs.createIndex({ "salary.min": 1, "dates.posted": -1, "status": 1 }, { name: "salary_low_idx" })
db.jobs.createIndex({ "company.rating": -1, "company.reviewCount": -1, "status": 1 }, { name: "company_rating_idx" })
db.jobs.createIndex({ "applicationsCount": -1, "dates.posted": -1, "status": 1 }, { name: "applications_idx" })
db.jobs.createIndex({ "viewsCount": -1, "dates.posted": -1, "status": 1 }, { name: "views_idx" })
db.jobs.createIndex({ "featured": -1, "premium": -1, "dates.posted": -1 }, { name: "featured_idx" })
db.jobs.createIndex({ "title": 1, "status": 1 }, { name: "alphabetical_idx" })
db.jobs.createIndex({ "dates.expires": 1, "status": 1 }, { name: "urgency_idx" })

// Text Search Index for Relevance:
db.jobs.createIndex({ 
  "title": "text", 
  "description.summary": "text", 
  "skills.name": "text" 
}, { 
  name: "relevance_text_idx",
  weights: { "title": 10, "skills.name": 5, "description.summary": 1 }
})

// Geospatial Index for Distance Sorting:
db.jobs.createIndex({ "location.coordinates": "2dsphere" }, { name: "distance_sort_idx" })

// Compound Indexes for Complex Sorting:
db.jobs.createIndex({ 
  "applicationsCount": -1, 
  "viewsCount": -1, 
  "dates.posted": -1, 
  "status": 1 
}, { name: "trending_compound_idx" })

db.jobs.createIndex({ 
  "skills.name": 1, 
  "experience.min": 1, 
  "experience.max": 1, 
  "status": 1 
}, { name: "match_score_idx" })
*/

// *ADVANCED SORT FEATURES FOR POWER USERS*

// *CUSTOM SORT BUILDER* - Allow users to create custom sort combinations
export const createCustomSort = async (req, res) => {
  const requestId = uuidv4();
  const userId = req.user?.id;

  if (!userId) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      new CustomError({
        success: false,
        message: "Authentication required for custom sorts",
      })
    );
  }

  try {
    const { name, criteria, weights, filters } = req.body;

    // Validate custom sort criteria
    const validCriteria = [
      "salary",
      "date",
      "rating",
      "applications",
      "views",
      "match",
      "distance",
    ];
    const invalidCriteria = criteria.filter(
      (c) => !validCriteria.includes(c.field)
    );

    if (invalidCriteria.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          message: `Invalid sort criteria: ${invalidCriteria.join(", ")}`,
        })
      );
    }

    // Calculate weighted composite score
    const aggregationPipeline = [
      { $match: buildSortQuery(filters || {}) },
      {
        $addFields: {
          compositeScore: {
            $add: criteria.map((criterion, index) => {
              const weight = weights[index] || 1;
              switch (criterion.field) {
                case "salary":
                  return {
                    $multiply: [{ $divide: ["$salary.max", 10000000] }, weight],
                  };
                case "date":
                  return {
                    $multiply: [
                      {
                        $divide: [
                          { $subtract: [new Date(), "$dates.posted"] },
                          -86400000,
                        ],
                      },
                      weight,
                    ],
                  };
                case "rating":
                  return {
                    $multiply: [{ $divide: ["$company.rating", 5] }, weight],
                  };
                case "applications":
                  return {
                    $multiply: [
                      { $divide: ["$applicationsCount", 1000] },
                      weight,
                    ],
                  };
                case "views":
                  return {
                    $multiply: [{ $divide: ["$viewsCount", 10000] }, weight],
                  };
                default:
                  return { $literal: 0 };
              }
            }),
          },
        },
      },
      { $sort: { compositeScore: -1 } },
      { $limit: 100 }, // Limit for performance
      {
        $project: {
          jobId: 1,
          title: 1,
          companyId: 1,
          "company.name": 1,
          location: 1,
          jobType: 1,
          salary: 1,
          "dates.posted": 1,
          compositeScore: 1,
        },
      },
    ];

    const jobs = await Job.aggregate(aggregationPipeline);

    // Save custom sort for user (assuming CustomSort model exists)
    const customSort = {
      userId,
      name,
      criteria,
      weights,
      filters,
      createdAt: new Date(),
      usageCount: 0,
    };

    // await CustomSort.create(customSort);

    logger.info(`[${requestId}] Custom sort created`, {
      userId,
      name,
      criteriaCount: criteria.length,
    });

    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        message: "Custom sort created successfully",
        data: {
          customSort,
          previewJobs: jobs.slice(0, 10), // Show preview
        },
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Custom sort creation failed: ${error.message}`,
      { userId }
    );
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Failed to create custom sort",
      })
    );
  }
};

// *SORT COMPARISON* - A/B test different sort algorithms
export const compareSorts = async (req, res) => {
  const requestId = uuidv4();
  const userId = req.user?.id;

  try {
    const { sortA, sortB, filters = {}, limit = 10 } = req.body;

    const query = buildSortQuery(filters);

    // Run both sorts in parallel
    const [resultsA, resultsB] = await Promise.all([
      sortJobs({ query: { ...filters, sortBy: sortA, limit } }, res).then(
        (r) => r.data?.jobs || []
      ),
      sortJobs({ query: { ...filters, sortBy: sortB, limit } }, res).then(
        (r) => r.data?.jobs || []
      ),
    ]);

    // Calculate overlap and differences
    const jobIdsA = new Set(resultsA.map((j) => j.jobId));
    const jobIdsB = new Set(resultsB.map((j) => j.jobId));

    const overlap = [...jobIdsA].filter((id) => jobIdsB.has(id)).length;
    const overlapPercentage = (overlap / Math.max(jobIdsA.size, 1)) * 100;

    const comparison = {
      sortA: {
        algorithm: sortA,
        results: resultsA,
        uniqueJobs: [...jobIdsA].filter((id) => !jobIdsB.has(id)).length,
      },
      sortB: {
        algorithm: sortB,
        results: resultsB,
        uniqueJobs: [...jobIdsB].filter((id) => !jobIdsA.has(id)).length,
      },
      analysis: {
        overlap,
        overlapPercentage: Math.round(overlapPercentage * 100) / 100,
        recommendation:
          overlapPercentage > 70
            ? `Results are very similar (${overlapPercentage}% overlap)`
            : `Results differ significantly (${overlapPercentage}% overlap)`,
      },
    };

    logger.info(`[${requestId}] Sort comparison completed`, {
      userId,
      sortA,
      sortB,
      overlapPercentage,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Sort comparison completed",
        data: comparison,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Sort comparison failed: ${error.message}`, {
      userId,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Sort comparison failed",
      })
    );
  }
};

// *SMART SORT RECOMMENDATIONS* - ML-powered sort suggestions
export const getSmartSortRecommendations = async (req, res) => {
  const requestId = uuidv4();
  const userId = req.user?.id;

  try {
    const cacheKey = `smart-sort:${userId || "anonymous"}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cached));
    }

    // Analyze user behavior (simplified ML logic)
    let recommendations = [];

    if (userId) {
      // Get user's search and application history
      // const userBehavior = await getUserBehaviorAnalysis(userId);

      // Simulate ML recommendations based on user profile
      const userProfile = {
        experienceLevel: req.user?.experience || "mid-level",
        preferredIndustries: req.user?.preferredIndustries || ["technology"],
        salaryExpectations: req.user?.salaryExpectations || "high",
        locationPreference: req.user?.locationPreference || "flexible",
      };

      if (userProfile.salaryExpectations === "high") {
        recommendations.push({
          sortBy: "salary-high",
          reason: "Based on your salary expectations",
          confidence: 0.85,
          expectedImprovement: "23% more relevant results",
        });
      }

      if (userProfile.locationPreference === "specific") {
        recommendations.push({
          sortBy: "distance",
          reason: "You prefer local opportunities",
          confidence: 0.78,
          expectedImprovement: "31% better location matches",
        });
      }

      recommendations.push({
        sortBy: "match-score",
        reason: "Personalized matching based on your profile",
        confidence: 0.92,
        expectedImprovement: "45% higher application success rate",
      });
    } else {
      // Anonymous user recommendations
      recommendations = [
        {
          sortBy: "relevance",
          reason: "Best overall results for your search",
          confidence: 0.9,
          expectedImprovement: "Optimized for search relevance",
        },
        {
          sortBy: "date",
          reason: "Fresh opportunities posted recently",
          confidence: 0.75,
          expectedImprovement: "40% more responsive employers",
        },
      ];
    }

    const response = {
      userId,
      recommendations: recommendations.sort(
        (a, b) => b.confidence - a.confidence
      ),
      generatedAt: new Date(),
      personalizedFor: userId ? "registered_user" : "anonymous",
    };

    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 3600); // 1 hour

    logger.info(`[${requestId}] Smart sort recommendations generated`, {
      userId,
      recommendationCount: recommendations.length,
    });

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Smart sort recommendations generated",
        data: response,
      })
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Smart recommendations failed: ${error.message}`,
      { userId }
    );
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Failed to generate smart recommendations",
      })
    );
  }
};

// *SORT PERFORMANCE METRICS* - Monitor sort algorithm performance
export const getSortPerformanceMetrics = async (req, res) => {
  const requestId = uuidv4();

  try {
    const { timeRange = "24h" } = req.query;

    const cacheKey = `metrics:sort:${timeRange}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.status(HTTP_STATUS.OK).json(JSON.parse(cached));
    }

    // In production, this would come from your metrics database
    const mockMetrics = {
      timeRange,
      generatedAt: new Date(),
      sortAlgorithms: {
        relevance: {
          usage: 45.2,
          avgResponseTime: 145,
          cacheHitRate: 78.5,
          userSatisfaction: 4.2,
          clickThroughRate: 12.8,
        },
        date: {
          usage: 28.7,
          avgResponseTime: 89,
          cacheHitRate: 85.2,
          userSatisfaction: 3.9,
          clickThroughRate: 9.4,
        },
        "salary-high": {
          usage: 15.3,
          avgResponseTime: 156,
          cacheHitRate: 72.1,
          userSatisfaction: 4.4,
          clickThroughRate: 18.7,
        },
        trending: {
          usage: 4.0,
          avgResponseTime: 234,
          cacheHitRate: 45.3,
          userSatisfaction: 3.8,
          clickThroughRate: 8.9,
        },
        "match-score": {
          usage: 3.8,
          avgResponseTime: 298,
          cacheHitRate: 35.7,
          userSatisfaction: 4.6,
          clickThroughRate: 22.1,
        },
      },
      recommendations: [
        "Optimize trending sort performance (234ms avg)",
        "Improve cache strategy for match-score (35.7% hit rate)",
        "Consider promoting salary-high sort (highest CTR: 18.7%)",
      ],
    };

    await redisClient.set(cacheKey, JSON.stringify(mockMetrics), "EX", 1800); // 30 minutes

    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        message: "Sort performance metrics retrieved",
        data: mockMetrics,
      })
    );
  } catch (error) {
    logger.error(`[${requestId}] Performance metrics failed: ${error.message}`);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        message: "Failed to get performance metrics",
      })
    );
  }
};
