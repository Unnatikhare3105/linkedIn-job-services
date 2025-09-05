import { Client } from '@elastic/elasticsearch';


export const esClient = new Client({
  nodes: [
    process.env.ELASTICSEARCH_NODE_1,
    process.env.ELASTICSEARCH_NODE_2,
    process.env.ELASTICSEARCH_NODE_3
  ],
  maxRetries: 3,
  requestTimeout: 5000,
  sniffOnStart: true,
  sniffInterval: 60000
});
