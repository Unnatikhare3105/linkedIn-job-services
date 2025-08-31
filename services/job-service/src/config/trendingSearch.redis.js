// import redisClient from './config/redis.js';

// async function populateTrendingSearches() {
//   await redisClient.zAdd('trending:searches', [
//     { score: 100, value: 'software engineer' },
//     { score: 80, value: 'data scientist' },
//     { score: 60, value: 'product manager' },
//   ]);
//   console.log('Trending searches populated');
// }

// (async () => {
//   await redisClient.connect();
//   await populateTrendingSearches();
//   await redisClient.quit();
// })();