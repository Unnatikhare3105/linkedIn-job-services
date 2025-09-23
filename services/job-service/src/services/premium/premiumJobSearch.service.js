import { createSearchService } from '../config/elasticSearch.client.js';
import { createCacheService } from '../services/premium/analyticsService.js';
import { sanitizeInput } from '../utils/security.js';
import { JobSearchService } from "../services/premium/premium.service.js";


export class JobSearchService {
  constructor(searchService, cacheService) {
    this.searchService = searchService;
    this.cacheService = cacheService;
  }

  async initialize() {
    await this.cacheService.getClient().ping();
    await initKafka();
  }

  async searchJobs(params, userId, useScroll = false) {
    const { error, value: validatedParams } = searchValidationSchema.validate(params);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    const sanitizedParams = sanitizeInput(validatedParams);
    
    const paramHash = require('crypto').createHash('md5').update(JSON.stringify(sanitizedParams)).digest('hex');
    const cacheKey = `search:${paramHash}:${userId.slice(-8)}`;
    
    let results = await this.cacheService.get(cacheKey);
    
    if (!results) {
      results = await this.searchService.searchJobs(sanitizedParams, useScroll);
      if (results.took < 1000 || results.total < 100) {
        await this.cacheService.set(cacheKey, results, 300);
      }
    }

    this.trackSearchEvent(userId, sanitizedParams, results).catch(console.error);
    
    return results;
  }

  async getTrendingJobs(limit = 50) {
    const cacheKey = `trending_jobs:${limit}`;
    let trendingJobs = await this.cacheService.get(cacheKey);
    
    if (!trendingJobs) {
      trendingJobs = await this.searchService.getTrendingJobs(limit);
      await this.cacheService.set(cacheKey, trendingJobs, 600);
    }
    
    return trendingJobs;
  }

  async getJobsInNetwork(userId, limit = 20) {
    const cacheKey = `network_jobs:${userId}`;
    let networkJobs = await this.cacheService.get(cacheKey);
    
    if (!networkJobs) {
      const userConnections = await this.getUserConnections(userId);
      networkJobs = await this.searchService.getJobsInNetwork(userId, userConnections, limit);
      await this.cacheService.set(cacheKey, networkJobs, 1800);
    }
    
    return networkJobs;
  }

  async getAlumniJobs(userId, limit = 20) {
    const cacheKey = `alumni_jobs:${userId}`;
    let alumniJobs = await this.cacheService.get(cacheKey);
    
    if (!alumniJobs) {
      const userEducation = await this.getUserEducation(userId);
      alumniJobs = await this.searchService.getAlumniJobs(userId, userEducation, limit);
      await this.cacheService.set(cacheKey, alumniJobs, 1800);
    }
    
    return alumniJobs;
  }

  async getFilteredJobs(filterType, params, userId) {
    const baseParams = { ...params };
    
    switch (filterType) {
      case 'newgrad':
        baseParams.experienceLevel = 'entry';
        baseParams.noExperienceRequired = true;
        break;
      case 'senior':
        baseParams.experienceLevel = 'senior';
        break;
      case 'executive':
        baseParams.experienceLevel = 'executive';
        break;
      case 'contract':
        baseParams.jobType = 'contract';
        break;
      case 'freelance':
        baseParams.jobType = 'freelance';
        break;
      case 'startup':
        baseParams.companySize = 'startup';
        break;
      case 'fortune500':
        baseParams.companySize = 'fortune500';
        break;
      case 'no_experience':
        baseParams.noExperienceRequired = true;
        break;
    }
    
    return await this.searchJobs(baseParams, userId);
  }

  async trackSearchEvent(userId, params, results) {
    const event = {
      type: 'job_search',
      userId,
      timestamp: new Date().toISOString(),
      searchParams: { ...params, sensitive: undefined },
      resultCount: results.total,
      took: results.took
    };

    await publishJobEvent('job-search-events', event);
  }

  async getUserConnections(userId) {
    return [];
  }

  async getUserEducation(userId) {
    return [];
  }

  async disconnect() {
    await this.cacheService.disconnect();
    await this.searchService.disconnect();
  }
}

export const createJobSearchService = (feature = 'core') => {
  const search = createSearchService(feature);
  const cache = createCacheService(feature);
  const service = new JobSearchService(search, cache);
  service.initialize().catch(console.error);
  return service;
};