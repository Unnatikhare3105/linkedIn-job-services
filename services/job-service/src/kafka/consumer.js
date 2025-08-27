import {kafkaClient} from "../config/kafka.js";

export const consumer = kafkaClient.consumer({ groupId: 'service-group' });

await consumer.connect();