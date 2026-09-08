import { Queue } from 'bullmq';
import { queueName, redisConnection } from './config.js';

export function createQueue(options = {}) {
  return new Queue(options.name ?? queueName, {
    connection: options.connection ?? redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { age: 86_400, count: 500 },
      removeOnFail: { age: 604_800, count: 2_000 }
    }
  });
}
