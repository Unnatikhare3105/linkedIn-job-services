import { Client } from '@elastic/elasticsearch';
import logger from '../utils/logger.js';

export const esClient = new Client({
  nodes: [
    process.env.ELASTICSEARCH_NODE_1 || 'http://localhost:9200',
    process.env.ELASTICSEARCH_NODE_2,
    process.env.ELASTICSEARCH_NODE_3
  ].filter(Boolean),
  maxRetries: 3,
  requestTimeout: 5000,
  sniffOnStart: true,
  sniffInterval: 60000
});

export class SearchService {
  constructor(options = {}) {
    this.client = esClient;
    this.jobsIndex = 'jobs_v2';
    this.companiesIndex = 'companies_v2';
  }

  async healthCheck() {
    const { body } = await this.client.cluster.health();
    return body.status === 'green' || body.status === 'yellow';
  }

  buildSearchQuery(params) {
    const { q, location, company, title, skills, industries, experienceLevel, 
            salaryMin, salaryMax, jobType, companySize, remote, noExperienceRequired } = params;

    const must = [];
    const filter = [];
    const should = [];

    if (q) {
      const booleanQuery = this.parseBooleanQuery(q);
      must.push(booleanQuery);
    }

    if (title) {
      must.push({
        multi_match: {
          query: title,
          fields: ['title^3', 'title.keyword^2'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    if (location) {
      should.push(
        { match: { 'location.city': { query: location, boost: 3, fuzziness: 'AUTO' } } },
        { match: { 'location.state': { query: location, boost: 2, fuzziness: 'AUTO' } } },
        { match: { 'location.country': { query: location, boost: 1, fuzziness: 'AUTO' } } }
      );
    }

    if (company) {
      must.push({
        multi_match: {
          query: company,
          fields: ['company.name^2', 'company.name.keyword'],
          fuzziness: 'AUTO'
        }
      });
    }

    if (skills?.length) {
      filter.push({ terms: { 'skills.keyword': skills } });
    }

    if (industries?.length) {
      filter.push({ terms: { 'industry.keyword': industries } });
    }

    if (experienceLevel) {
      filter.push({ term: { 'experienceLevel.keyword': experienceLevel } });
    }

    if (salaryMin || salaryMax) {
      const salaryRange = {};
      if (salaryMin) salaryRange.gte = salaryMin;
      if (salaryMax) salaryRange.lte = salaryMax;
      filter.push({ range: { salaryMin: salaryRange } });
    }

    if (jobType) {
      filter.push({ term: { 'jobType.keyword': jobType } });
    }

    if (companySize) {
      filter.push({ term: { 'company.size.keyword': companySize } });
    }

    if (remote !== undefined) {
      filter.push({ term: { remote } });
    }

    if (noExperienceRequired) {
      filter.push({ term: { noExperienceRequired: true } });
    }

    filter.push({ term: { 'status.keyword': 'active' } });
    filter.push({ range: { expiresAt: { gte: 'now' } } });

    return {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
        should: should.length > 0 ? should : undefined,
        minimum_should_match: should.length > 0 ? 1 : 0
      }
    };
  }

  parseBooleanQuery(query) {
    const operators = /(AND|OR|NOT)\s+/gi;
    const terms = query.split(operators).filter(term => term.trim());
    const opMatches = [...query.matchAll(operators)];
    
    const must = [];
    const mustNot = [];
    let currentOp = 'AND';

    terms.forEach((term, index) => {
      const op = opMatches[index]?.[1]?.toUpperCase() || currentOp;
      currentOp = op;

      let searchTerm = term.trim();
      let isPhrase = false;

      if (searchTerm.startsWith('"') && searchTerm.endsWith('"')) {
        searchTerm = searchTerm.slice(1, -1);
        isPhrase = true;
      }

      const queryClause = isPhrase ? 
        { match_phrase: { _all: searchTerm } } :
        { multi_match: {
            query: searchTerm,
            fields: ['title^3', 'description^2', 'skills', 'company.name'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        };

      if (currentOp === 'NOT') {
        mustNot.push(queryClause);
      } else if (currentOp === 'OR') {
        should = should || [];
        should.push(queryClause);
      } else {
        must.push(queryClause);
      }
    });

    const boolQuery = { bool: { must, must_not: mustNot } };
    if (should) boolQuery.bool.should = should;
    return boolQuery;
  }

  async searchJobs(params, useScroll = false) {
    const { page = 1, limit = 20, sortBy = 'relevance' } = params;
    const from = (page - 1) * limit;

    const sort = this.buildSortClause(sortBy);
    const query = this.buildSearchQuery(params);

    const body = {
      query,
      sort,
      from,
      size: limit,
      _source: {
        excludes: ['description_full', 'internal_notes']
      },
      highlight: {
        fields: {
          title: { fragment_size: 150 },
          description: { fragment_size: 150, number_of_fragments: 3 }
        },
        require_field_match: false
      },
      aggs: {
        locations: { terms: { field: 'location.city.keyword', size: 20 } },
        companies: { terms: { field: 'company.name.keyword', size: 20 } },
        skills: { terms: { field: 'skills.keyword', size: 30 } },
        experience_levels: { terms: { field: 'experienceLevel.keyword', size: 4 } },
        job_types: { terms: { field: 'jobType.keyword', size: 5 } },
        salary_ranges: {
          range: {
            field: 'salaryMin',
            ranges: [
              { to: 50000 },
              { from: 50000, to: 100000 },
              { from: 100000, to: 150000 },
              { from: 150000 }
            ]
          }
        }
      },
      track_total_hits: true
    };

    let response;
    if (useScroll && page > 10) {
      const scrollResponse = await this.client.search({
        index: this.jobsIndex,
        body,
        scroll: '1m'
      });
      response = scrollResponse;
    } else {
      response = await this.client.search({
        index: this.jobsIndex,
        body
      });
    }
    
    return {
      hits: response.body.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        highlight: hit.highlight
      })),
      total: response.body.hits.total.value,
      aggregations: response.body.aggregations,
      took: response.body.took
    };
  }

  buildSortClause(sortBy) {
    const commonSort = [{ createdAt: { order: 'desc', format: 'strict_date_optional_time' } }];
    switch (sortBy) {
      case 'date':
        return commonSort;
      case 'salary':
        return [{ salaryMax: { order: 'desc', missing: '_last' } }, { salaryMin: { order: 'desc', missing: '_last' } }];
      case 'trending':
        return [
          { 'analytics.trendingScore': { order: 'desc', missing: 0 } },
          { 'analytics.viewCount': { order: 'desc', missing: 0 } },
          { _score: { order: 'desc' } }
        ];
      case 'relevance':
      default:
        return [{ _score: { order: 'desc' } }];
    }
  }

  async getTrendingJobs(limit = 50) {
    const query = {
      bool: {
        filter: [
          { term: { status: 'active' } },
          { range: { createdAt: { gte: 'now-7d/d' } } },
          { range: { 'analytics.viewCount': { gte: 100 } } }
        ]
      }
    };

    const response = await this.client.search({
      index: this.jobsIndex,
      body: {
        query,
        sort: [
          { 'analytics.trendingScore': { order: 'desc', missing: 0 } },
          { 'analytics.viewCount': { order: 'desc', missing: 0 } },
          ...this.buildSortClause('date')
        ],
        size: limit,
        _source: ['id', 'title', 'company', 'location', 'salaryMin', 'salaryMax', 'createdAt']
      }
    });

    return response.body.hits.hits.map(hit => ({ ...hit._source, id: hit._id }));
  }

  async getJobsInNetwork(userId, userConnections, limit = 20) {
    const companyIds = await this.getCompanyIdsFromConnections(userConnections) || [];
    if (companyIds.length === 0) return [];
    
    const query = {
      bool: {
        filter: [
          { term: { status: 'active' } },
          { terms: { 'company.id': companyIds } }
        ]
      }
    };

    const response = await this.client.search({
      index: this.jobsIndex,
      body: {
        query,
        sort: this.buildSortClause('date'),
        size: limit,
        _source: true
      }
    });

    return response.body.hits.hits.map(hit => ({ ...hit._source, id: hit._id }));
  }

  async getAlumniJobs(userId, userEducation, limit = 20) {
    const schoolIds = userEducation.map(edu => edu.schoolId).filter(Boolean);
    if (schoolIds.length === 0) return [];
    
    const query = {
      bool: {
        should: [
          { terms: { 'company.topSchools': schoolIds } },
          { terms: { 'postedBy.education.schoolId': schoolIds } }
        ],
        filter: [
          { term: { status: 'active' } }
        ],
        minimum_should_match: 1
      }
    };

    const response = await this.client.search({
      index: this.jobsIndex,
      body: {
        query,
        sort: this.buildSortClause('date'),
        size: limit,
        _source: true
      }
    });

    return response.body.hits.hits.map(hit => ({ ...hit._source, id: hit._id }));
  }

  async getCompanyIdsFromConnections(connections) {
    return [];
  }

  async disconnect() {
    await this.client.close();
  }
}

export const createSearchService = (feature = 'jobs') => {
  const opts = {
    ...(feature === 'companies' && { jobsIndex: 'companies_v2' })
  };
  return new SearchService(opts);
};