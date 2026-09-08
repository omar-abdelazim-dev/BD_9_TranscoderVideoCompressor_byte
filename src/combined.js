import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'bullmq';
import { createApp } from './app.js';
import { paths, queueName, redisConnection } from './config.js';
import { transcode } from './ffmpeg.js';
import { safeAssetName } from './media.js';
import { createQueue } from './queue.js';

await mkdir(paths.output, { recursive: true });
const queue = createQueue();
const worker = new Worker(queueName, async (job) => {
  const outputPath = join(paths.output, safeAssetName(job.id, 'video'));
  const thumbnailPath = join(paths.output, safeAssetName(job.id, 'thumbnail'));
  await job.updateProgress(5);
  await transcode({ inputPath: job.data.inputPath, outputPath, thumbnailPath });
  await job.updateProgress(100);
  await rm(job.data.inputPath, { force: true });
  return { outputPath, thumbnailPath };
}, { connection: redisConnection(), concurrency: 1 });
worker.on('failed', async (job, error) => {
  console.error(`Transcoding job ${job?.id} failed: ${error.message}`);
  if (job && job.attemptsMade >= job.opts.attempts) await rm(job.data.inputPath, { force: true });
});

const server = createApp({ queue }).listen(Number(process.env.PORT ?? 3000), () => {
  console.log('Transcoder combined API and worker are running.');
});
async function shutdown(signal) {
  console.log(`${signal} received.`);
  server.close();
  await Promise.all([worker.close(), queue.close()]);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
