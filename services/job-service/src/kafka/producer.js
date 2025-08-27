import {kafkaClient} from "../config/kafka.js";

export const kafkaProducer = kafkaClient.producer();
await kafkaProducer.connect();
