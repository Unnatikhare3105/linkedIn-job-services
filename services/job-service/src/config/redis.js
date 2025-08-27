import { createClient } from 'redis';
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', { error: err.message });
});

redisClient.connect().catch((err) => {
  logger.error('Redis connection failed', { error: err.message });
});

export default redisClient;