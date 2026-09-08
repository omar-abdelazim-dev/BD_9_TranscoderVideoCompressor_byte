import { join } from 'node:path';

export const queueName = process.env.QUEUE_NAME ?? 'transcoder-video';
export const storageRoot = process.env.STORAGE_ROOT ?? './storage';
export const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 524_288_000);
export const paths = {
  uploads: join(storageRoot, 'uploads'),
  output: join(storageRoot, 'output')
};
export function redisConnection(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return { url, maxRetriesPerRequest: null };
}
