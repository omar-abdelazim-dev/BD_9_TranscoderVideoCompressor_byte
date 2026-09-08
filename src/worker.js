import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'bullmq';
import { paths, queueName, redisConnection } from './config.js';
import { transcode } from './ffmpeg.js';
import { safeAssetName } from './media.js';

await mkdir(paths.output, { recursive: true });
const worker = new Worker(queueName, async (job) => {
  const outputPath = join(paths.output, safeAssetName(job.id, 'video'));
  const thumbnailPath = join(paths.output, safeAssetName(job.id, 'thumbnail'));
  await job.updateProgress(5);
  await transcode({ inputPath: job.data.inputPath, outputPath, thumbnailPath });
  await job.updateProgress(100);
  await rm(job.data.inputPath, { force: true });
  return { outputPath, thumbnailPath };
}, { connection: redisConnection(), concurrency: 2 });
worker.on('completed', (job) => console.log(`Transcoding job ${job.id} completed.`));
worker.on('failed', async (job, error) => {
  console.error(`Transcoding job ${job?.id} failed: ${error.message}`);
  if (job && job.attemptsMade >= job.opts.attempts) await rm(job.data.inputPath, { force: true });
});
worker.on('error', (error) => console.error('Worker error:', error));
async function shutdown(signal) { console.log(`${signal} received.`); await worker.close(); process.exit(0); }
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
