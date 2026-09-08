import { existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import express from 'express';
import multer from 'multer';
import { maxUploadBytes, paths } from './config.js';
import { safeAssetName, validateVideoFile } from './media.js';
import { serializeJob } from './status.js';

function makeUpload(pathsToUse, limit) {
  mkdirSync(pathsToUse.uploads, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, pathsToUse.uploads),
      filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
    }),
    limits: { fileSize: limit, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, ['video/mp4', 'video/quicktime'].includes(file.mimetype))
  }).single('video');
}

export function createApp({ queue, storagePaths = paths, uploadLimit = maxUploadBytes }) {
  mkdirSync(storagePaths.output, { recursive: true });
  const upload = makeUpload(storagePaths, uploadLimit);
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', async (_req, res) => {
    try { await queue.waitUntilReady(); res.json({ status: 'ok', redis: 'connected' }); }
    catch { res.status(503).json({ status: 'degraded', redis: 'unavailable' }); }
  });

  app.post('/api/videos', (req, res, next) => upload(req, res, (error) => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'UPLOAD_REJECTED', message: error.message });
    next();
  }), async (req, res, next) => {
    try {
      const validation = await validateVideoFile(req.file);
      if (validation.error) {
        if (req.file?.path) await rm(req.file.path, { force: true });
        return res.status(415).json({ error: 'UNSUPPORTED_MEDIA', message: validation.error });
      }
      const job = await queue.add('transcode', { inputPath: req.file.path, originalName: req.file.originalname });
      res.location(`/api/jobs/${job.id}`).status(202).json({ data: { jobId: job.id, status: 'Queued', statusUrl: `/api/jobs/${job.id}` } });
    } catch (error) { next(error); }
  });

  app.get('/api/jobs/:id', async (req, res, next) => {
    try {
      const job = await queue.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: 'JOB_NOT_FOUND', message: 'No transcoding job has this ID.' });
      res.json({ data: await serializeJob(job) });
    } catch (error) { next(error); }
  });

  app.get('/api/jobs/:id/download/:kind', (req, res) => {
    try {
      const asset = join(storagePaths.output, safeAssetName(req.params.id, req.params.kind));
      if (!existsSync(asset)) return res.status(404).json({ error: 'ASSET_NOT_READY', message: 'This asset is not ready yet.' });
      res.download(asset, req.params.kind === 'video' ? 'compressed.mp4' : 'thumbnail.jpg');
    } catch { res.status(400).json({ error: 'INVALID_ASSET_REQUEST' }); }
  });

  app.use((req, res) => res.status(404).json({ error: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}.` }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(503).json({ error: 'QUEUE_UNAVAILABLE', message: 'Video was not queued. Try again shortly.' });
  });
  return app;
}
