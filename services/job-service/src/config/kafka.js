// services/job-service/src/config/kafka.js
import pkg from 'kafkajs';
import logger from '../utils/logger.js';
const { Kafka, logLevel, Partitioners } = pkg;

export const kafkaClient = new Kafka({
  clientId: 'job-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka1:9092', 'kafka2:9093', 'kafka3:9094'],
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 10,
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2,
  },
  logLevel: logLevel.INFO,
});

export const producer = kafkaClient.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
  transactionTimeout: 30000,
});

export const consumer = kafkaClient.consumer({
  groupId: 'job-service-group',
  heartbeatInterval: 3000,
  sessionTimeout: 45000,
  rebalanceTimeout: 60000,
  maxWaitTimeInMs: 5000,
  fetchMinBytes: 1,
  fetchMaxBytes: 1024 * 1024,
});

export async function initKafka() {
  let retries = 5;
  while (retries > 0) {
    try {
      await Promise.all([
        producer.connect().then(() => logger.info('Kafka producer connected', { service: 'job-service' })),
        consumer.connect().then(() => logger.info('Kafka consumer connected', { service: 'job-service' })),
      ]);
      // Handle consumer crashes
      consumer.on('consumer.crash', ({ payload: { error } }) => {
        logger.error(`Consumer crashed: ${error.message}`, { service: 'job-service' });
        setTimeout(() => consumer.connect(), 5000);
      });
      return;
    } catch (err) {
      logger.error(`Error initializing Kafka: ${err.message}`, { retriesLeft: retries - 1, service: 'job-service' });
      retries -= 1;
      if (retries === 0) {
        logger.error('Max retries reached for Kafka initialization', { service: 'job-service' });
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

export async function publishJobEvent(topic, message) {
  try {
    await producer.send({
      topic,
      messages: [{ key: message.userId || 'default', value: JSON.stringify(message) }],
    });
    logger.info(`Published message to topic ${topic}`, { message, service: 'job-service' });
  } catch (err) {
    logger.error(`Failed to publish message to ${topic}: ${err.message}`, { service: 'job-service' });
    throw err;
  }
}

export async function ensureTopics() {
  const admin = kafkaClient.admin();
  try {
    await admin.connect();
    logger.info('Kafka admin connected', { service: 'job-service' });

    const cluster = await admin.describeCluster();
    const availableBrokers = cluster.brokers.length;
    logger.info(`Available Kafka brokers: ${availableBrokers}`, { service: 'job-service' });

    const existingTopics = await admin.listTopics();
    const requiredTopics = [
      { topic: 'ai_tasks', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'quality_tasks', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'quality_results', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'notifications', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'competitive_analysis', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'salary_benchmark', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'interview_questions', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'interview_tips', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'premium_results', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'reminder-scheduler', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'calendar-events', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'batch-application-queue', numPartitions: 12, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'data-export-queue', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'realtime-notifications', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'feature-usage-analytics', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'skills_analysis_completed', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'career_path_generated', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'assessment_completed', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'linkedin_sync', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
      { topic: 'market_report_generation', numPartitions: 10, replicationFactor: Math.min(3, availableBrokers) },
    ];

    const topicsToCreate = requiredTopics.filter((t) => !existingTopics.includes(t.topic));
    if (topicsToCreate.length > 0) {
      let retries = 3;
      while (retries > 0) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await admin.createTopics({
            topics: topicsToCreate,
            waitForLeaders: true,
            timeout: 30000,
          });
          logger.info('Kafka topics created', { topics: topicsToCreate.map((t) => t.topic), service: 'job-service' });
          break;
        } catch (err) {
          logger.error(`Attempt ${4 - retries} failed to create topics: ${err.message}`, { topicsToCreate, service: 'job-service' });
          retries -= 1;
          if (retries === 0) {
            logger.error('Max retries reached for topic creation', { service: 'job-service' });
            throw err;
          }
        }
      }
    } else {
      logger.info('All Kafka topics already exist', { service: 'job-service' });
    }
  } catch (err) {
    logger.error(`Failed to ensure topics: ${err.message}`, { service: 'job-service' });
    throw err;
  } finally {
    await admin.disconnect();
    logger.info('Kafka admin disconnected', { service: 'job-service' });
  }
}

export async function disconnectConsumer() {
  try {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected', { service: 'job-service' });
  } catch (err) {
    logger.error(`Failed to disconnect consumer: ${err.message}`, { service: 'job-service' });
  }
}