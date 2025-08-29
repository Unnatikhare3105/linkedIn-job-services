import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from './utils/logger.js';

async function setupPinecone() {
  try {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexes = await pinecone.listIndexes();
    if (!indexes.some(index => index.name === 'job-embeddings')) {
      await pinecone.createIndex({
        name: 'job-embeddings',
        dimension: 1536, // Adjust based on your embedding model (e.g., OpenAI)
        metric: 'cosine',
        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
      });
      logger.info('Created job-embeddings index in Pinecone');
    } else {
      logger.info('job-embeddings index already exists');
    }
  } catch (error) {
    logger.error('Failed to setup Pinecone:', error);
  }
}

setupPinecone();