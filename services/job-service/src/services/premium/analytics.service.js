import Redis from 'ioredis';
import { publishJobEvent, initKafka, consumer } from '../../config/kafka.js';
import logger from '../../utils/logger.js';

export class AnalyticsService {
  constructor() {
    this.cacheService = createCacheService('analytics');
  }

  async initialize() {
    await initKafka();
    await this.cacheService.getClient().ping();
    
    // await this.consumeEvents(
    //   ['job-search-events', 'job-view-events', 'job-application-events'],
    //   this.processAnalyticsEvent.bind(this)
    // );
  }

  async consumeEvents(topics, callback) {
    // const { consumer } = await import('./kafkaService.js');
    // await consumer.subscribe({ 
    //   topics: Array.isArray(topics) ? topics : [topics],
    //   fromBeginning: false
    // });
    await consumer.run({
      autoCommit: true,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          await callback(topic, event);
        } catch (parseError) {
          logger.error('Event parse error:', parseError);
        }
      }
    });
  }

  async processAnalyticsEvent(topic, event) {
    try {
      switch (topic) {
        case 'job-search-events':
          await this.processSearchEvent(event);
          break;
        case 'job-view-events':
          await this.processJobViewEvent(event);
          break;
        case 'job-application-events':
          await this.processApplicationEvent(event);
          break;
      }
    } catch (error) {
      logger.error('Analytics processing error:', error);
    }
  }

  async processSearchEvent(event) {
    const { userId, searchParams, resultCount } = event;
    
    const operations = [];
    if (searchParams.q) {
      operations.push({ method: 'incrby', args: [`popular_searches:${searchParams.q.toLowerCase()}`, 1] });
    }
    if (searchParams.location) {
      operations.push({ method: 'incrby', args: [`location_searches:${searchParams.location.toLowerCase()}`, 1] });
    }
    operations.push({ method: 'incrby', args: [`user_searches:${userId}`, 1] });
    
    await this.cacheService.pipeline(operations);
    
    await this.updateTrendingMetrics(searchParams);
  }

  async processJobViewEvent(event) {
    const { jobId, userId, timestamp } = event;
    const dateKey = new Date(timestamp || Date.now()).toISOString().split('T')[0];
    
    const operations = [
      { method: 'incrby', args: [`job_views:${jobId}`, 1] },
      { method: 'incrby', args: [`job_views_daily:${jobId}:${dateKey}`, 1] },
      { method: 'incrby', args: [`user_job_views:${userId}`, 1] }
    ];
    
    await this.cacheService.pipeline(operations);
  }

  async processApplicationEvent(event) {
    const { jobId, userId, timestamp } = event;
    const dateKey = new Date(timestamp || Date.now()).toISOString().split('T')[0];
    
    const operations = [
      { method: 'incrby', args: [`job_applications:${jobId}`, 1] },
      { method: 'incrby', args: [`job_applications_daily:${jobId}:${dateKey}`, 1] }
    ];
    
    await this.cacheService.pipeline(operations);
    
    await this.updateConversionMetrics(jobId, userId);
  }

  async incrementCounter(key, amount = 1) {
    await this.cacheService.getClient().incrby(key, amount);
    await this.cacheService.getClient().expire(key, 86400 * 30);
  }

  async updateTrendingMetrics(searchParams) {
    const now = Date.now();
    if (searchParams.q) {
      const searchTerm = searchParams.q.toLowerCase();
      const scoreKey = `trending_score:${searchTerm}`;
      const timeDecay = Math.exp(- (now - Date.now()) / (24 * 60 * 60 * 1000));
      const trendScore = 1 * timeDecay;
      
      await this.cacheService.getClient().incrbyfloat(scoreKey, trendScore);
      await this.cacheService.getClient().expire(scoreKey, 86400 * 7);
    }
  }

  async updateConversionMetrics(jobId, userId) {
    await this.incrementCounter(`job_conversion:${jobId}`);
    await this.incrementCounter(`user_conversions:${userId}`);
  }

  async disconnect() {
    await this.cacheService.disconnect();
    await (await import('./kafkaService.js')).disconnectConsumer();
  }
}

export const createAnalyticsService = () => {
  const service = new AnalyticsService();
  service.initialize().catch(console.error);
  return service;
};

export class CacheService {
  constructor(options = {}) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: options.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 2000); // Exponential backoff, max 2s
        logger.warn(`Retrying Redis connection, attempt ${times}`);
        return delay;
      },
      maxRetriesPerRequest: 5,
      lazyConnect: true,
      commandTimeout: 5000,
      enableReadyCheck: true
    });

    this.redis.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.redis.on('close', () => {
      logger.warn('Redis client connection closed');
    });
  }

  getClient() {
    return this.redis;
  }

  async get(key) {
    try {
      const result = await this.getClient().get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      await this.getClient().setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key) {
    try {
      await this.getClient().del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async pipeline(operations) {
    const pipe = this.getClient().pipeline();
    operations.forEach(op => {
      if (op.method === 'setex') {
        pipe.setex(...op.args);
      } else if (op.method === 'incrby') {
        pipe.incrby(...op.args);
      }
    });
    try {
      return await pipe.exec();
    } catch (error) {
      logger.error('Pipeline error:', error);
      return null;
    }
  }

  async getMultiLevel(key, userId = null) {
    const userKey = userId ? `${key}:${userId}` : key;
    try {
      let result = await this.getClient().get(`hot:${userKey}`);
      if (result) {
        return JSON.parse(result);
      }
      result = await this.getClient().get(`warm:${userKey}`);
      if (result) {
        await this.getClient().setex(`hot:${userKey}`, 30, result);
        return JSON.parse(result);
      }
      result = await this.getClient().get(`cold:${key}`);
      if (result) {
        return JSON.parse(result);
      }
    } catch (error) {
      logger.error('Cache get error:', error);
    }
    return null;
  }

  async setMultiLevel(key, data, userId = null) {
    const userKey = userId ? `${key}:${userId}` : key;
    const dataStr = JSON.stringify(data);
    try {
      await Promise.all([
        this.getClient().setex(`hot:${userKey}`, 30, dataStr),
        this.getClient().setex(`warm:${userKey}`, 300, dataStr),
        this.getClient().setex(`cold:${key}`, 1800, dataStr)
      ]);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async disconnect() {
    try {
      await this.getClient().quit();
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }
}

export const createCacheService = (feature = 'search', options = {}) => {
  const opts = {
    ...(feature === 'analytics' && { db: 1, ttlDefault: 86400 }),
    ...(feature === 'recommendations' && { db: 2, ttlDefault: 7200 }),
    ...options
  };
  return new CacheService(opts);
};