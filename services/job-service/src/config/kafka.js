import { Kafka } from 'kafkajs';
import logger from '../utils/logger.js';

export const kafkaClient = new Kafka({
  clientId: 'job-service',
  brokers: (process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092']),
  retry:{
    initialRetryTime: 1000,
    retries: 8
  }
});

export const producer = kafkaClient.producer();

export const consumer = kafkaClient.consumer({ groupId: 'job-service' });



export async function initKafka() {
  await producer.connect()
  .then(() => {
    logger.info('Kafka producer connected');
  })
  .catch((error) => {
    logger.error('Error connecting Kafka producer:', error);
  });

  await consumer.connect()
  .then(() => {
    logger.info('Kafka consumer connected');
  })
  .catch((error) => {
    logger.error('Error connecting Kafka consumer:', error);
  });
}

export const publishJobEvent = async (topic, message) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    logger.info(`Published message to topic ${topic}`, { message });
  } catch (err) {
    logger.error(`Failed to publish message to ${topic}`, { error: err.message });
    throw err;
  }
};
