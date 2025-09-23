import Redis from 'ioredis';

// Redis Client Configuration
let redisClient;
let useRedis = false;

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
  });

  redisClient.on('connect', () => {
    console.log('✅ Connected to Redis for rate limiting');
    useRedis = true;
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Error, falling back to memory store:', err.message);
    useRedis = false;
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis is ready for rate limiting');
    useRedis = true;
  });

} catch (error) {
  console.error('❌ Failed to initialize Redis, using memory store:', error.message);
  useRedis = false;
}
await redisClient.connect();

// Create store function for rate limiting
export const createStore = (prefix = 'rl:') => {
  if (useRedis && redisClient) {
    try {
      return {
        // Increment the counter for the given key
        incr: async (key, cb) => {
          try {
            const result = await redisClient.incr(key);
            cb(null, result);
          } catch (err) {
            cb(err);
          }
        },
        // Reset the counter for the given key
        resetKey: async (key) => {
          try {
            await redisClient.del(key);
          } catch (err) {
            console.error('❌ Failed to reset key:', err.message);
          }
        },
        // Set TTL for the key
        setTTL: async (key, ttl) => {
          try {
            await redisClient.expire(key, Math.ceil(ttl / 1000));
          } catch (err) {
            console.error('❌ Failed to set TTL:', err.message);
          }
        },
      };
    } catch (error) {
      console.error('❌ Failed to create Redis store, using memory store:', error.message);
      return undefined;
    }
  }
  
  console.log('ℹ️ Using memory store for rate limiting');
  return undefined; // Use default memory store
};

// Export Redis client for other uses
export default redisClient;

// Graceful shutdown
const gracefulShutdown = async () => {
  if (redisClient && useRedis) {
    console.log('Closing Redis connection...');
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed successfully');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error.message);
    }
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);