// app.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jobRouter from './routers/job.routes.js';
import applicationRouter from './routers/jobApplication.routes.js';
import analysisRouter from './routers/jobAnalysis.routes.js';
import searchRouter from './routers/search.routes.js';
import searchHistoryRouter from './routers/searchHistory.routes.js';
import filterRouter from './routers/filter.routes.js';
import sortRouter from './routers/sort.routes.js';
import aiRouter from './routers/ai.routes.js';
import qualityTrustRouter from './routers/qualityTrust.routes.js';
import companyRouter from './routers/company.routes.js';
import matchingRouter from './routers/matching.routes.js';
import premiumExtendedRouter from './routers/premium/premiumExended.routes.js';
import premiumJobSearchRouter from './routers/premium/premium.jobSearch.routes.js';
import premiumProfessionalDevelopmentRouter from './routers/premium/professionalDevelopment.routes.js';
import { authenticate } from './middlewares/auth.js';
import { connectDB } from './db/db.js';
import { initKafka, ensureTopics, consumer } from './config/kafka.js';
import { qualityTrustService } from './services/qualityTrust.services.js';
import { premiumService } from './services/premium/premium.service.js';
import { aiService } from './services/ai.services.js';
import premiumRouter from './routers/premium/premium.routes.js';
import { premiumLimiter } from './config/premium.rate.limiter.js';
import { premiumExtendedService } from './services/premium/premiumExtended.service.js';
import logger from './utils/logger.js';

const app = express();
dotenv.config();
connectDB();

async function startServer() {
  try {
    logger.info('Starting server...', { service: 'job-service' });
    await initKafka();
    logger.info('1. Kafka initialized', { service: 'job-service' });
    await ensureTopics();
    logger.info('2. Kafka topics ensured', { service: 'job-service' });

    const topics = [
      'quality_tasks',
      'quality_results',
      'ai_tasks',
      'competitive_analysis',
      'salary_benchmark',
      'interview_questions',
      'interview_tips',
      'premium_results',
      'job-search-events',
      'job-view-events',
      'job-application-events',
      'skills_analysis_completed',
      'career_path_generated',
      'assessment_completed',
      'linkedin_sync',
      'market_report_generation',
    ];

    // Single consumer subscription
    await consumer.subscribe({ topics, fromBeginning: false });
    logger.info('Kafka consumer subscribed to topics', { service: 'job-service' });

    // Run consumer with message routing
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        logger.info(`Received message on ${topic} partition ${partition}`, { service: 'job-service' });
        try {
          const value = JSON.parse(message.value.toString());
          switch (topic) {
            case 'quality_tasks':
            case 'quality_results':
              await qualityTrustService.handleMessage(topic, value);
              break;
            case 'ai_tasks':
              await aiService.handleMessage(topic, value);
              break;
            case 'premium_results':
              await premiumService.handleMessage(topic, value);
              break;
            case 'skills_analysis_completed':
            case 'career_path_generated':
            case 'assessment_completed':
            case 'linkedin_sync':
            case 'market_report_generation':
              await premiumExtendedService.handleMessage(topic, value);
              break;
            case 'job-search-events':
            case 'job-view-events':
            case 'job-application-events':
              logger.info(`Processing event topic ${topic}`, { service: 'job-service', value });
              break;
            default:
              logger.warn(`No handler for topic ${topic}`, { service: 'job-service' });
          }
        } catch (err) {
          logger.error(`Error processing message on ${topic}: ${err.message}`, { service: 'job-service' });
        }
      },
    });
    logger.info('Kafka consumer running', { service: 'job-service' });

  } catch (err) {
    logger.error(`Startup failed: ${err.message}`, { service: 'job-service' });
    process.exit(1);
  }
}

startServer();

app.use(authenticate);
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Job Service');
});

app.use('/jobs', jobRouter);
app.use('/jobs/applications', applicationRouter);
app.use('/jobs/analysis', analysisRouter);
app.use('/jobs/search', searchRouter);
app.use('/jobs/filters', filterRouter);
app.use('/jobs/search-history', searchHistoryRouter);
app.use('/jobs/sort', sortRouter);
app.use('/jobs/ai', aiRouter);
app.use('/jobs/quality-trust', qualityTrustRouter);
app.use('/jobs/company', companyRouter);
app.use('/jobs/matching', matchingRouter);
app.use('/jobs/premium', premiumLimiter, premiumRouter);
app.use('/jobs/premiumExtended', premiumLimiter, premiumExtendedRouter);
app.use('/jobs/premiumSearch', premiumLimiter, premiumJobSearchRouter);
app.use('/jobs/premium/professionalDevelopment', premiumLimiter, premiumProfessionalDevelopmentRouter);

export default app;