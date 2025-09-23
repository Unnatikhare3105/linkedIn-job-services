import logger from "../utils/logger.js";
import Job from "../model/job.model.js";
import pkg from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from "uuid";
import UserActivity from "../model/userInteraction.model.js";
import JobApplication from "../model/jobApplication.model.js";
import SearchModel from "../model/search.model.js";
import redisClient from "../config/redis.js";
import { publishJobEvent  } from "../config/kafka.js";
import { searchRequests, activeSearches, cacheHits } from "../utils/metrics.js";
import { generateSecureId } from "../utils/security.js";

dotenv.config();
const { Pinecone } = pkg;

// Helper function for similarity calculation
export function calculateSimilarityScore(referenceJob, compareJob) {
  let score = 0;
  let maxScore = 0;

  // Skills similarity (40% weight)
  if (referenceJob.skills?.length && compareJob.skills?.length) {
    const refSkills = referenceJob.skills.map((s) => s.name?.toLowerCase());
    const compSkills = compareJob.skills.map((s) => s.name?.toLowerCase());
    const intersection = refSkills.filter((skill) =>
      compSkills.includes(skill)
    );
    const union = [...new Set([...refSkills, ...compSkills])];
    score += (intersection.length / union.length) * 40;
  }
  maxScore += 40;

  // Job type match (20% weight)
  if (referenceJob.jobType === compareJob.jobType) {
    score += 20;
  }
  maxScore += 20;

  // Location match (15% weight)
  if (referenceJob.location?.city === compareJob.location?.city) {
    score += 15;
  }
  maxScore += 15;

  // Experience level match (10% weight)
  if (referenceJob.experienceLevel === compareJob.experienceLevel) {
    score += 10;
  }
  maxScore += 10;

  // Company match (10% weight)
  if (referenceJob.companyName === compareJob.companyName) {
    score += 10;
  }
  maxScore += 10;

  // Salary range similarity (5% weight)
  if (referenceJob.salary?.amount && compareJob.salary?.amount) {
    const salaryDiff = Math.abs(
      referenceJob.salary.amount - compareJob.salary.amount
    );
    const avgSalary =
      (referenceJob.salary.amount + compareJob.salary.amount) / 2;
    const similarity = Math.max(0, 1 - salaryDiff / avgSalary);
    score += similarity * 5;
  }
  maxScore += 5;

  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

export async function analyzeSearchHistory(searchHistory, userId) {
  const analysis = {
    searchPatterns: {
      mostSearchedTerms: new Map(),
      searchFrequency: new Map(),
      timePatterns: new Map(),
      skillTrends: new Map(),
      locationTrends: new Map(),
    },
    insights: [],
    recommendations: [],
    trends: [],
  };

  // Analyze search patterns
  searchHistory.forEach((search) => {
    // Track search terms
    if (search.query) {
      analysis.searchPatterns.mostSearchedTerms.set(
        search.query,
        (analysis.searchPatterns.mostSearchedTerms.get(search.query) || 0) + 1
      );
    }

    // Track search frequency by day
    const day = search.createdAt.toISOString().split("T")[0];
    analysis.searchPatterns.searchFrequency.set(
      day,
      (analysis.searchPatterns.searchFrequency.get(day) || 0) + 1
    );

    // Track time patterns (hour of day)
    const hour = search.createdAt.getHours();
    analysis.searchPatterns.timePatterns.set(
      hour,
      (analysis.searchPatterns.timePatterns.get(hour) || 0) + 1
    );

    // Extract skills and locations from metadata
    if (search.metadata?.filters?.skills) {
      search.metadata.filters.skills.forEach((skill) => {
        analysis.searchPatterns.skillTrends.set(
          skill,
          (analysis.searchPatterns.skillTrends.get(skill) || 0) + 1
        );
      });
    }

    if (search.metadata?.filters?.location) {
      search.metadata.filters.location.forEach((location) => {
        analysis.searchPatterns.locationTrends.set(
          location,
          (analysis.searchPatterns.locationTrends.get(location) || 0) + 1
        );
      });
    }
  });

  // Convert Maps to Arrays and sort
  analysis.searchPatterns.mostSearchedTerms = Array.from(
    analysis.searchPatterns.mostSearchedTerms.entries()
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  analysis.searchPatterns.skillTrends = Array.from(
    analysis.searchPatterns.skillTrends.entries()
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  analysis.searchPatterns.locationTrends = Array.from(
    analysis.searchPatterns.locationTrends.entries()
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Generate insights
  if (analysis.searchPatterns.mostSearchedTerms.length > 0) {
    analysis.insights.push({
      type: "top_search",
      message: `Your most searched term is "${analysis.searchPatterns.mostSearchedTerms[0][0]}" (${analysis.searchPatterns.mostSearchedTerms[0][1]} times)`,
      priority: "high",
    });
  }

  if (analysis.searchPatterns.skillTrends.length > 0) {
    analysis.insights.push({
      type: "skill_focus",
      message: ` You're most interested in ${analysis.searchPatterns.skillTrends[0][0]} skills`,
      priority: "medium",
    });
  }

  // Generate recommendations based on patterns
  const topSkills = analysis.searchPatterns.skillTrends
    .slice(0, 3)
    .map(([skill]) => skill);
  if (topSkills.length > 0) {
    analysis.recommendations.push({
      type: "skill_development",
      message: ` Consider taking courses in: ${topSkills.join(", ")}`,
      action: "explore_courses",
    });
  }

  // Detect trends
  const recentSearches = searchHistory.slice(0, 10);
  const oldSearches = searchHistory.slice(-10);

  if (recentSearches.length > 0 && oldSearches.length > 0) {
    // Simple trend detection - compare recent vs old search terms
    const recentTerms = new Set(
      recentSearches.map((s) => s.query).filter(Boolean)
    );
    const oldTerms = new Set(oldSearches.map((s) => s.query).filter(Boolean));

    const newTerms = [...recentTerms].filter((term) => !oldTerms.has(term));
    if (newTerms.length > 0) {
      analysis.trends.push({
        type: "emerging_interest",
        message: `New search interests: ${newTerms.slice(0, 3).join(", ")}`,
        trend: "up",
      });
    }
  }

  return analysis;
}

export async function getSkillSuggestions(query, userProfile, limit) {
  const pipeline = [
    {
      $match: {
        "skills.name": { $regex: query, $options: "i" },
        status: "active",
        isDeleted: false,
      },
    },
    { $unwind: "$skills" },
    {
      $match: {
        "skills.name": { $regex: query, $options: "i" },
      },
    },
    {
      $group: {
        _id: "$skills.name",
        count: { $sum: 1 },
        avgSalary: { $avg: "$salary.amount" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        value: "$_id",
        label: "$_id",
        count: 1,
        avgSalary: { $round: ["$avgSalary", 0] },
        score: { $multiply: ["$count", 1] },
      },
    },
  ];

  const results = await Job.aggregate(pipeline);

  // Boost user's preferred skills
  if (userProfile?.behaviorScore?.topSkills) {
    results.forEach((result) => {
      if (userProfile.behaviorScore.topSkills.includes(result.value)) {
        result.score += 50;
        result.personalized = true;
      }
    });
  }

  return results;
}

export async function generateEnhancedSuggestions(query, type, userProfile, limit) {
  const suggestions = {
    suggestions: [],
    metadata: {
      query,
      type,
      personalized: !!userProfile,
      algorithms: [],
    },
  };

  const queryLower = query.toLowerCase();

  switch (type) {
    case "skills":
      suggestions.suggestions = await getSkillSuggestions(
        queryLower,
        userProfile,
        limit
      );
      suggestions.metadata.algorithms.push("skill_matching");
      break;

    case "companies":
      suggestions.suggestions = await getCompanySuggestions(
        queryLower,
        userProfile,
        limit
      );
      suggestions.metadata.algorithms.push("company_matching");
      break;

    case "locations":
      suggestions.suggestions = await getLocationSuggestions(
        queryLower,
        userProfile,
        limit
      );
      suggestions.metadata.algorithms.push("location_matching");
      break;

    case "mixed":
    default:
      const [skills, companies, locations, jobTitles] = await Promise.all([
        getSkillSuggestions(queryLower, userProfile, Math.ceil(limit * 0.3)),
        getCompanySuggestions(queryLower, userProfile, Math.ceil(limit * 0.25)),
        getLocationSuggestions(queryLower, userProfile, Math.ceil(limit * 0.2)),
        getJobTitleSuggestions(
          queryLower,
          userProfile,
          Math.ceil(limit * 0.25)
        ),
      ]);

      suggestions.suggestions = [
        ...skills.map((s) => ({ ...s, category: "skill" })),
        ...companies.map((s) => ({ ...s, category: "company" })),
        ...locations.map((s) => ({ ...s, category: "location" })),
        ...jobTitles.map((s) => ({ ...s, category: "title" })),
      ].slice(0, limit);

      suggestions.metadata.algorithms.push("mixed_intelligent");
      break;
  }

  // Sort by relevance score
  suggestions.suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));

  return suggestions;
}

// Helper function to build optimized query for recently viewed (can be expanded)
export const buildRecentlyViewedQuery = (value, userProfile) => {
  let query = { userId: value.userId, type: "view", entityType: "job" };
  if (userProfile?.preferences?.jobTypes) {
    // Personalize by preferred job types if applicable
    query["job.jobType"] = { $in: userProfile.preferences.jobTypes };
  }
  return query;
};

// Helper for sort options (similar to unified search)
export const getSortOptions = (sortBy = "createdAt", sortOrder = "desc") => ({
  [sortBy]: sortOrder === "asc" ? 1 : -1,
});


//////////////////////////////////////////////////////////////
export class AdvancedSearchEngine {
  
  static async buildElasticsearchQuery(query, filters, userProfile = null) {
    const esQuery = {
      bool: {
        must: [
          {
            multi_match: {
              query: query,
              fields: [
                'title^3',
                'description^1.5', 
                'skills.name^2',
                'companyName^2',
                'requirements'
              ],
              fuzziness: 'AUTO',
              operator: 'and'
            }
          }
        ],
        filter: [
          { term: { status: 'active' }},
          { term: { isDeleted: false }},
          { range: { 'dates.expires': { gt: new Date().toISOString() }}}
        ],
        should: []
      }
    };

    // Apply filters
    if (filters.location?.length) {
      esQuery.bool.filter.push({
        terms: { 'location.city.keyword': filters.location }
      });
 }

    if (filters.skills?.length) {
      esQuery.bool.filter.push({
        terms: { 'skills.name.keyword': filters.skills }
      });
    }

    if (filters.experience?.length) {
      esQuery.bool.filter.push({
        terms: { 'experienceLevel.keyword': filters.experience }
      });
    }

    if (filters.jobType?.length) {
      esQuery.bool.filter.push({
        terms: { 'jobType.keyword': filters.jobType }
      });
    }

    if (filters.salary) {
      const salaryRange = {};
      if (filters.salary.min) salaryRange.gte = filters.salary.min;
      if (filters.salary.max) salaryRange.lte = filters.salary.max;
      esQuery.bool.filter.push({
        range: { 'salary.amount': salaryRange }
 });
    }

    if (filters.remote === true) {
      esQuery.bool.filter.push({
        term: { 'remote': true }
      });
    }

    if (filters.companySize?.length) {
      esQuery.bool.filter.push({
        terms: { 'companySize.keyword': filters.companySize }
      });
    }

    if (filters.postedDate) {
      const dateMap = {
        '24h': 1,
        '3d': 3,
        '7d': 7,
        '14d': 14,
        '30d': 30
      };
      const daysAgo = dateMap[filters.postedDate];
      const dateThreshold = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      esQuery.bool.filter.push({
        range: { 'dates.posted': { gte: dateThreshold.toISOString() }}
      });
    }

    // Personalization boosts
    if (userProfile?.behaviorScore) {
      // Boost preferred skills
      if (userProfile.behaviorScore.topSkills?.length) {
        esQuery.bool.should.push({
          terms: {
            'skills.name.keyword': userProfile.behaviorScore.topSkills,
            boost: 2.0
          }
        });
      }

      // Boost preferred locations
      if (userProfile.behaviorScore.topLocations?.length) {
        esQuery.bool.should.push({
          terms: {
            'location.city.keyword': userProfile.behaviorScore.topLocations,
            boost: 1.5
          }
        });
      }
    }

    return esQuery;
  }

  static async searchElasticsearch(query, filters, page, limit, sort, userProfile) {
    const esQuery = await this.buildElasticsearchQuery(query, filters, userProfile);
    
    const sortOptions = {
      relevance: [{ _score: { order: 'desc' }}],
      date: [{ 'dates.posted': { order: 'desc' }}],
      salary: [{ 'salary.amount': { order: 'desc' }}],
      company: [{ 'companyName.keyword': { order: 'asc' }}]
    };

    const searchParams = {
      index: 'jobs',
      body: {
        query: esQuery,
        sort: sortOptions[sort],
        from: (page - 1) * limit,
        size: limit,
        _source: [
          'jobId', 'title', 'companyName', 'location', 
          'salary', 'jobType', 'skills', 'dates.posted', 
          'remote', 'experienceLevel', 'description'
        ],
        highlight: {
          fields: {
            title: {},
            description: {},
            'skills.name': {}
          }
        }
      }
    };

    const response = await esClient.search(searchParams);
    
    return {
      hits: response.body.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight,
        personalizationScore: userProfile 
          ? PersonalizationEngine.calculatePersonalizationScore(hit._source, userProfile)
          : 50
      })),
      total: response.body.hits.total.value
    };
  }

  static async searchMongoDB(query, filters, page, limit, sort, userProfile) {
    const mongoQuery = {
      $text: { $search: query },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() }
    };

    // Apply filters to MongoDB query
    if (filters.location?.length) {
      mongoQuery['location.city'] = { $in: filters.location };
    }

    if (filters.skills?.length) {
      mongoQuery['skills.name'] = { $in: filters.skills.map(s => new RegExp(s, 'i')) };
    }

    if (filters.experience?.length) {
      mongoQuery.experienceLevel = { $in: filters.experience };
    }

    if (filters.jobType?.length) {
      mongoQuery.jobType = { $in: filters.jobType };
    }

    if (filters.salary) {
      const salaryQuery = {};
      if (filters.salary.min) salaryQuery.$gte = filters.salary.min;
      if (filters.salary.max) salaryQuery.$lte = filters.salary.max;
      mongoQuery['salary.amount'] = salaryQuery;
    }

    if (filters.remote === true) {
      mongoQuery.remote = true;
    }

    if (filters.companySize?.length) {
      mongoQuery.companySize = { $in: filters.companySize };
    }

    if (filters.postedDate) {
      const dateMap = { '24h': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30 };
      const daysAgo = dateMap[filters.postedDate];
      const dateThreshold = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      mongoQuery['dates.posted'] = { $gte: dateThreshold };
    }

    const sortOptions = {
      relevance: { score: { $meta: 'textScore' }},
      date: { 'dates.posted': -1 },
      salary: { 'salary.amount': -1 },
      company: { companyName: 1 }
    };

    const [jobs, total] = await Promise.all([
      Job.find(mongoQuery)
        .select('jobId title companyName location salary jobType skills dates.posted remote experienceLevel description')
        .sort(sortOptions[sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Job.countDocuments(mongoQuery)
    ]);

    return {
      hits: jobs.map(job => ({
        ...job,
        personalizationScore: userProfile 
          ? PersonalizationEngine.calculatePersonalizationScore(job, userProfile)
          : 50
      })),
      total
    };
  }
}

///////////////////////////////////////////////////////////////
// export class AnalyticsProcessor {
//   static analyticsBuffer = [];
// //   static readonly BUFFER_SIZE = 100;
// //   static readonly FLUSH_INTERVAL = 10000; // 10 seconds
//   static  BUFFER_SIZE = 100;
//   static FLUSH_INTERVAL = 10000; // 10 seconds

//   static init() {
//     setInterval(() => this.flushAnalytics(), this.FLUSH_INTERVAL);
//   }

//   static addEvent(event) {
//     this.analyticsBuffer.push({
//       ...event,
//       timestamp: new Date(),
//       id: generateSecureId()
//     });

//     if (this.analyticsBuffer.length >= this.BUFFER_SIZE) {
//       setImmediate(() => this.flushAnalytics());
//     }
//   }

//   static async flushAnalytics() {
//     if (this.analyticsBuffer.length === 0) return;

//     const events = this.analyticsBuffer.splice(0);
    
//     try {
//       // Batch insert to analytics database
//       await SearchModel.insertMany(events.map(event => ({
//         userId: event.userId,
//         query: event.query,
//         searchType: event.type,
//         resultCount: event.resultCount,
// metadata: event.metadata,
//         createdAt: event.timestamp
//       })));

//       // Send to Kafka for real-time analytics
//       JobEventService.emit('bulk:analytics', events)
//         .catch(err => logger.error('Kafka bulk event failed', err));

//     } catch (error) {
//       logger.error('Analytics flush failed', error);
//       // Re-add events to buffer for retry
//       this.analyticsBuffer.unshift(...events);
//     }
//   }
// }


export class AnalyticsProcessor {
  static analyticsBuffer = [];
  static BUFFER_SIZE = 100;
  static FLUSH_INTERVAL = 10000;

  static init() {
    setInterval(() => this.flushAnalytics(), this.FLUSH_INTERVAL);
  }

  static addEvent(event) {
    this.analyticsBuffer.push({
      ...event,
      timestamp: new Date(),
      id: generateSecureId()
    });

    if (this.analyticsBuffer.length >= this.BUFFER_SIZE) {
      setImmediate(() => this.flushAnalytics());
    }
  }

  static async flushAnalytics() {
    if (this.analyticsBuffer.length === 0) return;

    const events = this.analyticsBuffer.splice(0);
    
    try {
      await SearchModel.insertMany(events.map(event => ({
        userId: event.userId,
        query: event.query,
        searchType: event.type,
        resultCount: event.resultCount,
        metadata: event.metadata,
        createdAt: event.timestamp
      })));

      await publishJobEvent('feature-usage-analytics', { events });
    } catch (error) {
      logger.error('Analytics flush failed', error);
      this.analyticsBuffer.unshift(...events);
    }
  }
}

// Initialize analytics processor
AnalyticsProcessor.init();

///////////////////////////////////////////////////////
// export class RecommendationEngine {
//   static async generateRecommendations(userId, userProfile, type, limit) {
//     const recommendations = {
//       jobs: [],
//       metadata: {
//         type,
//         generatedAt: new Date(),
//         algorithms: []
//       }
//     };

//     switch (type) {
//       case 'skills':
//         recommendations.jobs = await this.getSkillBasedRecommendations(userProfile, limit);
//         recommendations.metadata.algorithms.push('content_based_skills');
//         break;
        
//       case 'collaborative':
//         recommendations.jobs = await this.getCollaborativeRecommendations(userId, userProfile, limit);
//         recommendations.metadata.algorithms.push('collaborative_filtering');
//         break;
        
//       case 'trending':
//         recommendations.jobs = await this.getTrendingRecommendations(userProfile, limit);
//         recommendations.metadata.algorithms.push('trending_analysis');
//         break;
        
//       case 'mixed':
//       default:
//         const [skillBased, collaborative, trending] = await Promise.all([
//           this.getSkillBasedRecommendations(userProfile, Math.ceil(limit * 0.5)),
//           this.getCollaborativeRecommendations(userId, userProfile, Math.ceil(limit * 0.3)),
//           this.getTrendingRecommendations(userProfile, Math.ceil(limit * 0.2))
//         ]);
        
//         recommendations.jobs = this.mergeAndDedupe([...skillBased, ...collaborative, ...trending], limit);
//         recommendations.metadata.algorithms.push('hybrid_mixed');
//         break;
//     }

//     // Add recommendation scores
//     recommendations.jobs = recommendations.jobs.map(job => ({
//       ...job,
//       recommendationScore: this.calculateRecommendationScore(job, userProfile, type),
//       recommendationReason: this.generateRecommendationReason(job, userProfile)
//     }));

//     // Sort by recommendation score
//     recommendations.jobs.sort((a, b) => b.recommendationScore - a.recommendationScore);

//     return recommendations;
//   }

//   static async getSkillBasedRecommendations(userProfile, limit) {
//     const skills = userProfile.behaviorScore?.topSkills || userProfile.skills || [];
//     if (!skills.length) return [];

//     const jobs = await Job.find({
//       'skills.name': { $in: skills.map(s => new RegExp(s, 'i')) },
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() }
//     })
//       .select('jobId title companyName location salary jobType skills dates.posted remote')
//       .sort({ 'dates.posted': -1 })
//       .limit(limit * 2) // Get more to allow for filtering
//       .lean();

//     return jobs.slice(0, limit);
//   }

//   static async getCollaborativeRecommendations(userId, userProfile, limit) {
//     // Find users with similar behavior patterns
//     const similarUsers = await this.findSimilarUsers(userId, userProfile);
//     if (!similarUsers.length) return [];

//     // Get jobs that similar users have applied to or viewed
//     const similarUserIds = similarUsers.map(u => u.userId);
//     const applications = await JobApplication.find({
//       userId: { $in: similarUserIds },
// createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
//     }).populate('jobId').lean();

//     const jobIds = [...new Set(applications.map(app => app.jobId?._id).filter(Boolean))];
    
//     // Exclude jobs user has already applied to
//     const userApplications = await JobApplication.find({ userId }).select('jobId').lean();
//     const userJobIds = userApplications.map(app => app.jobId.toString());
    
//     const recommendedJobIds = jobIds.filter(jobId => !userJobIds.includes(jobId.toString()));

//     const jobs = await Job.find({
//       _id: { $in: recommendedJobIds },
//       status: 'active',
//       isDeleted: false,
//       'dates.expires': { $gt: new Date() }
//     })
//       .select('jobId title companyName location salary jobType skills dates.posted remote')
//       .limit(limit)
//       .lean();

//     return jobs;
//   }

//   static async getTrendingRecommendations(userProfile, limit) {
//     // Get trending jobs based on application volume and recency
//     const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
//     const trendingJobs = await Job.aggregate([
//       {
//         $match: {
//           status: 'active',
//           isDeleted: false,
//           'dates.expires': { $gt: new Date() },
//           'dates.posted': { $gte: thirtyDaysAgo }
//         }
//       },
//       {
//         $lookup: {
//           from: 'jobapplications',
//           localField: '_id',
//           foreignField: 'jobId',
//           as: 'applications'
//         }
//       },
//       {
//         $addFields: {
//           applicationCount: { $size: '$applications' },
//           trendScore: {
//             $add: [
//               { $multiply: [{ $size: '$applications' }, 0.7] }, // Application weight
//               { $multiply: [
//                 { $divide: [
//                   { $subtract: [new Date(), '$dates.posted'] },
//                   86400000 // Convert to days
//                 ]}, -0.3
//               ]} // Recency weight (negative because newer = higher score)
//             ]
//           }
//         }
//       },
//       { $sort: { trendScore: -1 } },
//       { $limit: limit },
//  {
//         $project: {
//           jobId: 1,
//           title: 1,
//           companyName: 1,
//           location: 1,
//           salary: 1,
//           jobType: 1,
//           skills: 1,
//           'dates.posted': 1,
//           remote: 1,
//           trendScore: 1,
//           applicationCount: 1
//         }
//       }
//     ]);

//     return trendingJobs;
//   }
// }

export class RecommendationEngine {
  static async generateRecommendations(userId, userProfile, type, limit) {
    const recommendations = {
      jobs: [],
      metadata: {
        type,
        generatedAt: new Date(),
        algorithms: []
      }
    };

    switch (type) {
      case 'skills':
        recommendations.jobs = await this.getSkillBasedRecommendations(userProfile, limit);
        recommendations.metadata.algorithms.push('content_based_skills');
        break;
        
      case 'collaborative':
        recommendations.jobs = await this.getCollaborativeRecommendations(userId, userProfile, limit);
        recommendations.metadata.algorithms.push('collaborative_filtering');
        break;
        
      case 'trending':
        recommendations.jobs = await this.getTrendingRecommendations(userProfile, limit);
        recommendations.metadata.algorithms.push('trending_analysis');
        break;
        
      case 'mixed':
      default:
        const [skillBased, collaborative, trending] = await Promise.all([
          this.getSkillBasedRecommendations(userProfile, Math.ceil(limit * 0.5)),
          this.getCollaborativeRecommendations(userId, userProfile, Math.ceil(limit * 0.3)),
          this.getTrendingRecommendations(userProfile, Math.ceil(limit * 0.2))
        ]);
        
        recommendations.jobs = this.mergeAndDedupe([...skillBased, ...collaborative, ...trending], limit);
        recommendations.metadata.algorithms.push('hybrid_mixed');
        break;
    }

    recommendations.jobs = recommendations.jobs.map(job => ({
      ...job,
      recommendationScore: this.calculateRecommendationScore(job, userProfile, type),
      recommendationReason: this.generateRecommendationReason(job, userProfile)
    }));

    recommendations.jobs.sort((a, b) => b.recommendationScore - a.recommendationScore);

    return recommendations;
  }

  static async getSkillBasedRecommendations(userProfile, limit) {
    const skills = userProfile.behaviorScore?.topSkills || userProfile.skills || [];
    if (!skills.length) return [];

    const jobs = await Job.find({
      'skills.name': { $in: skills.map(s => new RegExp(s, 'i')) },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() }
    })
      .select('jobId title companyName location salary jobType skills dates.posted remote')
      .sort({ 'dates.posted': -1 })
      .limit(limit * 2)
      .lean();

    return jobs.slice(0, limit);
  }

  static async getCollaborativeRecommendations(userId, userProfile, limit) {
    const similarUsers = await this.findSimilarUsers(userId, userProfile);
    if (!similarUsers.length) return [];

    const similarUserIds = similarUsers.map(u => u.userId);
    const applications = await JobApplication.find({
      userId: { $in: similarUserIds },
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    }).populate('jobId').lean();

    const jobIds = [...new Set(applications.map(app => app.jobId?._id).filter(Boolean))];
    
    const userApplications = await JobApplication.find({ userId }).select('jobId').lean();
    const userJobIds = userApplications.map(app => app.jobId.toString());
    
    const recommendedJobIds = jobIds.filter(jobId => !userJobIds.includes(jobId.toString()));

    const jobs = await Job.find({
      _id: { $in: recommendedJobIds },
      status: 'active',
      isDeleted: false,
      'dates.expires': { $gt: new Date() }
    })
      .select('jobId title companyName location salary jobType skills dates.posted remote')
      .limit(limit)
      .lean();

    return jobs;
  }

  static async getTrendingRecommendations(userProfile, limit) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const trendingJobs = await Job.aggregate([
      {
        $match: {
          status: 'active',
          isDeleted: false,
          'dates.expires': { $gt: new Date() },
          'dates.posted': { $gte: thirtyDaysAgo }
        }
      },
      {
        $lookup: {
          from: 'jobapplications',
          localField: '_id',
          foreignField: 'jobId',
          as: 'applications'
        }
      },
      {
        $addFields: {
          applicationCount: { $size: '$applications' },
          trendScore: {
            $add: [
              { $multiply: [{ $size: '$applications' }, 0.7] },
              { $multiply: [
                { $divide: [
                  { $subtract: [new Date(), '$dates.posted'] },
                  86400000
                ]}, -0.3
              ]}
            ]
          }
        }
      },
      { $sort: { trendScore: -1 } },
      { $limit: limit },
      {
        $project: {
          jobId: 1,
          title: 1,
          companyName: 1,
          location: 1,
          salary: 1,
          jobType: 1,
          skills: 1,
          'dates.posted': 1,
          remote: 1,
          trendScore: 1,
          applicationCount: 1
        }
      }
    ]);

    return trendingJobs;
  }

  static mergeAndDedupe(jobs, limit) {
    const seen = new Set();
    const deduped = jobs.filter(job => {
      if (seen.has(job.jobId)) return false;
      seen.add(job.jobId);
      return true;
    });
    return deduped.slice(0, limit);
  }

  static calculateRecommendationScore(job, userProfile, type) {
    // Placeholder scoring logic
    return 0.5;
  }

  static generateRecommendationReason(job, userProfile) {
    // Placeholder reason logic
    return 'Based on your profile and preferences';
  }

  static async findSimilarUsers(userId, userProfile) {
    // Placeholder: Integrate with user service
    return [];
  }
}


export class RecommendationUtils {
  static async findSimilarUsers(userId, userProfile) {
    // Simple similarity based on skills and application patterns
    const userSkills = userProfile.behaviorScore?.topSkills || [];
    if (!userSkills.length) return [];

    const similarUsers = await User.aggregate([
      {
        $match: {
          _id: { $ne: new ObjectId(userId) },
          'skills.name': { $in: userSkills }
        }
      },
      {
        $addFields: {
          skillMatchCount: {
            $size: {
              $setIntersection: ['$skills.name', userSkills]
            }
          }
        }
      },
      { $match: { skillMatchCount: { $gte: Math.ceil(userSkills.length * 0.3) } } },
      { $sort: { skillMatchCount: -1 } },
      { $limit: 20 },
      { $project: { userId: '$_id', skillMatchCount: 1 } }
    ]);

    return similarUsers;
  }

  static mergeAndDedupe(jobs, limit) {
    const seen = new Set();
    const unique = [];
    
    for (const job of jobs) {
      const key = job._id || job.jobId;
      if (!seen.has(key.toString())) {
        seen.add(key.toString());
        unique.push(job);
        if (unique.length >= limit) break;
      }
    }
    
    return unique;
  }

  static calculateRecommendationScore(job, userProfile, type) {
    let score = 50; // Base score
    
    // Skills match
    if (job.skills && userProfile.behaviorScore?.topSkills) {
      const skillMatches = job.skills.filter(skill => 
        userProfile.behaviorScore.topSkills.some(userSkill => 
          skill.name?.toLowerCase().includes(userSkill.toLowerCase())
        )
      ).length;
      score += (skillMatches / userProfile.behaviorScore.topSkills.length) * 30;
    }
    
    // Location preference
    if (userProfile.behaviorScore?.topLocations?.includes(job.location?.city)) {
      score += 15;
    }
    
    // Job type preference
    if (userProfile.applicationPattern?.topJobTypes?.includes(job.jobType)) {
      score += 10;
    }
    
    // Recency boost
    const daysOld = (Date.now() - new Date(job.dates?.posted)) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) score += 10;
    else if (daysOld < 30) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  static generateRecommendationReason(job, userProfile) {
    const reasons = [];
    
    if (job.skills && userProfile.behaviorScore?.topSkills) {
      const matchingSkills = job.skills.filter(skill => 
        userProfile.behaviorScore.topSkills.some(userSkill => 
          skill.name?.toLowerCase().includes(userSkill.toLowerCase())
        )
      );
      if (matchingSkills.length > 0) {
        reasons.push(`Matches your skills: ${matchingSkills.slice(0, 2).map(s => s.name).join(', ')}`);
      }
    }
    
    if (userProfile.behaviorScore?.topLocations?.includes(job.location?.city)) {
      reasons.push(`In your preferred location: ${job.location.city}`);
    }
    
    if (userProfile.applicationPattern?.topJobTypes?.includes(job.jobType)) {
      reasons.push(`(Matches your job type preference: ${job.jobType})`);
    }
    
    const daysOld = (Date.now() - new Date(job.dates?.posted)) / (1000 * 60 * 60 * 24);
    if (daysOld < 3) {
      reasons.push(`Recently posted`);
    }
    
    return reasons.length > 0 ? reasons.join(' • ') : 'Recommended based on your profile';
  }
}



export class SearchStatsService {
  static async getUserSearchStats(userId, timeFrame = "30d") {
    try {
      const timeMap = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
      const days = timeMap[timeFrame] || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await SearchModel.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalSearches: { $sum: 1 },
            totalClicks: { $sum: "$stats.clickCount" },
            totalResults: { $sum: "$stats.resultCount" },
            avgExecutionTime: { $avg: "$stats.executionTime" },
            avgResultCount: { $avg: "$stats.resultCount" },
            avgClickCount: { $avg: "$stats.clickCount" },
            topSearchTypes: { $push: "$metadata.type" },
          },
        },
      ]);

      return stats[0] || {};
    } catch (error) {
      logger.error("Failed to get user search stats:", error);
      throw new Error(`Failed to retrieve user search stats: ${error.message}`);
    }
  }

  static async getGlobalSearchStats(timeFrame = "30d") {
    const cacheKey = `global_search_stats:${timeFrame}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn("Redis cache miss for global stats:", error);
    }

    try {
      const timeMap = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
      const days = timeMap[timeFrame] || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await SearchHistory.aggregate([
        { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
        {
          $group: {
            _id: null,
            totalSearches: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
            totalClicks: { $sum: "$stats.clickCount" },
            avgExecutionTime: { $avg: "$stats.executionTime" },
            searchTypes: { $push: "$metadata.type" },
          },
        },
        {
          $project: {
            totalSearches: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
            totalClicks: 1,
            avgExecutionTime: 1,
            searchTypes: 1,
          },
        },
      ]);

      const result = stats[0] || {};
      await redisClient.setex(cacheKey, 300, JSON.stringify(result));
      return result;
    } catch (error) {
      logger.error("Failed to get global search stats:", error);
      throw new Error(`Failed to retrieve global search stats: ${error.message}`);
    }
  }

  static async getTrendingSearches(limit = 10, timeFrame = "24h") {
    try {
      const hours = timeFrame === "24h" ? 24 : 168;
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await SearchHistory.aggregate([
        { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
        { $unwind: "$searchKeywords" },
        {
          $group: {
            _id: "$searchKeywords",
            count: { $sum: 1 },
            avgResults: { $avg: "$stats.resultCount" },
            avgClicks: { $avg: "$stats.clickCount" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);
    } catch (error) {
      logger.error("Failed to get trending searches:", error);
      throw new Error(`Failed to retrieve trending searches: ${error.message}`);
    }
  }
}

// export class SearchStatsService {
//   static async getUserSearchStats(userId, timeFrame = "30d") {
//     try {
//       const timeMap = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
//       const days = timeMap[timeFrame] || 30;
//       const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

//       const stats = await SearchHistory.aggregate([
//         {
//           $match: {
//             userId,
//             createdAt: { $gte: startDate },
//             isDeleted: false,
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalSearches: { $sum: 1 },
//             totalClicks: { $sum: "$stats.clickCount" },
//             totalResults: { $sum: "$stats.resultCount" },
//             avgExecutionTime: { $avg: "$stats.executionTime" },
//             avgResultCount: { $avg: "$stats.resultCount" },
//             avgClickCount: { $avg: "$stats.clickCount" },
//             topSearchTypes: { $push: "$metadata.type" },
//           },
//         },
//       ]);

//       return stats[0] || {};
//     } catch (error) {
//       logger.error("Failed to get user search stats:", error);
//       throw new Error(`Failed to retrieve user search stats: ${error.message}`);
//     }
//   }

//   static async getGlobalSearchStats(timeFrame = "30d") {
//     const cacheKey = `global_search_stats:${timeFrame}`;
//     try {
//       const cached = await redisClient.get(cacheKey);
//       if (cached) {
//         cacheHits.inc({ cache_type: "global_stats" });
//         return JSON.parse(cached);
//       }
//     } catch (error) {
//       logger.warn("Redis cache miss for global stats:", error);
//     }

//     try {
//       const timeMap = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
//       const days = timeMap[timeFrame] || 30;
//       const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

//       const stats = await SearchHistory.aggregate([
//         { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
//         {
//           $group: {
//             _id: null,
//             totalSearches: { $sum: 1 },
//             uniqueUsers: { $addToSet: "$userId" },
//             totalClicks: { $sum: "$stats.clickCount" },
//             avgExecutionTime: { $avg: "$stats.executionTime" },
//             searchTypes: { $push: "$metadata.type" },
//           },
//         },
//         {
//           $project: {
//             totalSearches: 1,
//             uniqueUsers: { $size: "$uniqueUsers" },
//             totalClicks: 1,
//             avgExecutionTime: 1,
//             searchTypes: 1,
//           },
//         },
//       ]);

//       const result = stats[0] || {};
//       await redisClient.setex(cacheKey, 300, JSON.stringify(result));
//       return result;
//     } catch (error) {
//       logger.error("Failed to get global search stats:", error);
//       throw new Error(`Failed to retrieve global search stats: ${error.message}`);
//     }
//   }

//   static async getTrendingSearches(limit = 10, timeFrame = "24h") {
//     try {
//       const hours = timeFrame === "24h" ? 24 : 168;
//       const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

//       return await SearchHistory.aggregate([
//         { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
//         { $unwind: "$searchKeywords" },
//         {
//           $group: {
//             _id: "$searchKeywords",
//             count: { $sum: 1 },
//             avgResults: { $avg: "$stats.resultCount" },
//             avgClicks: { $avg: "$stats.clickCount" },
//           },
//         },
//         { $sort: { count: -1 } },
//         { $limit: limit },
//       ]);
//     } catch (error) {
//       logger.error("Failed to get trending searches:", error);
//       throw new Error(`Failed to retrieve trending searches: ${error.message}`);
//     }
//   }
// }

// Search Event Service
export class SearchEventService {
  static async emit(eventType, data) {
    try {
      logger.info(`Search Event: ${eventType}`, data);
      const eventKey = `search_event:${eventType}:${Date.now()}`;
      await redisClient.setex(eventKey, 3600, JSON.stringify(data));

      if (eventType === "analytics:search_created") {
        await this.handleSearchCreated(data);
      } else if (eventType === "analytics:search_clicked") {
        await this.handleSearchClicked(data);
      }
    } catch (error) {
      logger.error("Search event emission failed:", error);
      throw new Error(`Failed to emit search event: ${error.message}`);
    }
  }

  static async handleSearchCreated(data) {
    try {
      await UserActivity.create({
        userId: data.userId,
        activityType: "search",
        metadata: {
          searchId: data.searchId,
          query: data.query,
          type: data.type,
        },
      });
    } catch (error) {
      logger.error("Failed to handle search created event:", error);
      throw new Error(`Failed to handle search created event: ${error.message}`);
    }
  }

  static async handleSearchClicked(data) {
    try {
      await SearchHistory.updateOne(
        { searchId: data.searchId },
        {
          $inc: { "stats.clickCount": 1 },
          $set: { "stats.lastClickedAt": new Date() },
        }
      );
    } catch (error) {
      logger.error("Failed to handle search clicked event:", error);
      throw new Error(`Failed to handle search clicked event: ${error.message}`);
    }
  }
}

// Search Vector Service for semantic search
export class SearchVectorService {
  static pinecone = null;
  static index = null;

  static async initialize() {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      throw new Error("Missing Pinecone configuration: PINECONE_API_KEY or PINECONE_INDEX_NAME");
    }
    if (!this.pinecone) {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
      this.index = this.pinecone.index(process.env.PINECONE_INDEX_NAME);
      logger.info("Pinecone initialized successfully");
    }
  }

  static async generateSearchEmbedding(searchDoc) {
    try {
      await this.initialize();

      const textContent = [
        searchDoc.query,
        ...searchDoc.searchKeywords,
        searchDoc.metadata.type,
      ].join(" ");

      const embedding = await this.generateEmbedding(textContent);

      await this.index.upsert([
        {
          id: searchDoc.searchId,
          values: embedding,
          metadata: {
            userId: searchDoc.userId,
            query: searchDoc.query,
            type: searchDoc.metadata.type,
            createdAt: searchDoc.createdAt,
          },
        },
      ]);

      searchDoc.embedding = embedding;
    } catch (error) {
      logger.error("Failed to generate search embedding:", error);
      throw new Error(`Failed to generate search embedding: ${error.message}`);
    }
  }

  static async generateEmbedding(text) {
    try {
      const model = genAI.getGenerativeModel({ model: "embedding-001" });
      const response = await model.embedContent(text);
      return response.embedding.values;
    } catch (error) {
      logger.error("Failed to generate embedding:", error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  static async findSimilarSearches(query, userId, limit = 10) {
    try {
      await this.initialize();
      const queryEmbedding = await this.generateEmbedding(query);

      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK: limit,
        filter: { userId },
        includeMetadata: true,
      });

      return searchResponse.matches || [];
    } catch (error) {
      logger.error("Failed to find similar searches:", error);
      throw new Error(`Failed to find similar searches: ${error.message}`);
    }
  }
}

// Search Index Monitoring Service
export class SearchIndexMonitoringService {
  static async checkIndexHealth() {
    try {
      const stats = await SearchHistory.collection.stats();
      const indexStats = await SearchHistory.collection.getIndexes();

      const health = {
        collectionSize: stats.size,
        documentCount: stats.count,
        avgDocumentSize: stats.avgObjSize,
        indexCount: indexStats.length,
        indexes: indexStats.map((idx) => ({
          name: idx.name,
          keys: idx.key,
          size: idx.size || 0,
        })),
        timestamp: new Date(),
      };

      await redisClient.setex("search_index_health", 300, JSON.stringify(health));
      return health;
    } catch (error) {
      logger.error("Index health check failed:", error);
      throw new Error(`Failed to check index health: ${error.message}`);
    }
  }

  static async optimizeIndexes() {
    try {
      await SearchHistory.collection.reIndex();
      logger.info("Search indexes optimized successfully");
      return true;
    } catch (error) {
      logger.error("Index optimization failed:", error);
      throw new Error(`Failed to optimize indexes: ${error.message}`);
    }
  }
}

// Search Maintenance Service
export class SearchMaintenanceService {
  static async cleanupOldSearches() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const result = await SearchHistory.deleteMany({
        createdAt: { $lt: cutoffDate },
        isDeleted: true,
      });

      logger.info(`Cleaned up ${result.deletedCount} old search records`);
      return result.deletedCount;
    } catch (error) {
      logger.error("Search cleanup failed:", error);
      throw new Error(`Failed to clean up old searches: ${error.message}`);
    }
  }

  static async archiveInactiveSearches() {
    try {
      const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const result = await SearchHistory.updateMany(
        {
          createdAt: { $lt: cutoffDate },
          "stats.clickCount": 0,
          isDeleted: false,
        },
        {
          $set: { isDeleted: true, archivedAt: new Date() },
        }
      );

      logger.info(`Archived ${result.modifiedCount} inactive searches`);
      return result.modifiedCount;
    } catch (error) {
      logger.error("Search archival failed:", error);
      throw new Error(`Failed to archive inactive searches: ${error.message}`);
    }
  }

  static async deduplicateSearches() {
    try {
      const duplicates = await SearchHistory.aggregate([
        {
          $group: {
            _id: { userId: "$userId", queryHash: "$queryHash" },
            count: { $sum: 1 },
            docs: { $push: "$_id" },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ]);

      let removedCount = 0;
      for (const duplicate of duplicates) {
        const [keep, ...remove] = duplicate.docs;
        await SearchHistory.deleteMany({ _id: { $in: remove } });
        removedCount += remove.length;
      }

      logger.info(`Removed ${removedCount} duplicate searches`);
      return removedCount;
    } catch (error) {
      logger.error("Search deduplication failed:", error);
      throw new Error(`Failed to deduplicate searches: ${error.message}`);
    }
  }
}

