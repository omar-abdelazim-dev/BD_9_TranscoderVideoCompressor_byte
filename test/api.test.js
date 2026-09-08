import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hasIsoBaseMediaHeader } from '../src/media.js';

function fixture() {
  const jobs = new Map();
  const queue = {
    async waitUntilReady() {},
    async add(_name, data) {
      const job = { id: String(jobs.size + 1), data, opts: { attempts: 3 }, timestamp: 1_000, attemptsMade: 0, progress: 0, async getState() { return 'waiting'; } };
      jobs.set(job.id, job); return job;
    },
    async getJob(id) { return jobs.get(id); }
  };
  return { queue, jobs };
}

test('accepts a valid MP4 upload and immediately returns 202', async () => {
  const root = await mkdtemp(join(tmpdir(), 'transcoder-'));
  const { queue } = fixture();
  const app = createApp({ queue, storagePaths: { uploads: join(root, 'uploads'), output: join(root, 'output') } });
  const fakeMp4 = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
  const response = await request(app).post('/api/videos').attach('video', fakeMp4, { filename: 'sample.mp4', contentType: 'video/mp4' });
  assert.equal(response.status, 202);
  assert.equal(response.body.data.status, 'Queued');
  assert.equal((await request(app).get(response.body.data.statusUrl)).body.data.status, 'Queued');
});

test('rejects non-video payloads and recognizes ISO media signatures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'transcoder-'));
  const { queue } = fixture();
  const app = createApp({ queue, storagePaths: { uploads: join(root, 'uploads'), output: join(root, 'output') } });
  const rejected = await request(app).post('/api/videos').attach('video', Buffer.from('not video'), { filename: 'bad.txt', contentType: 'text/plain' });
  assert.equal(rejected.status, 415);
  assert.equal(hasIsoBaseMediaHeader(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])), true);
});

test('completed job exposes safe asset routes', async () => {
  const { queue, jobs } = fixture();
  const job = await queue.add('transcode', {});
  job.finishedOn = 2_000; job.getState = async () => 'completed'; job.progress = 100;
  jobs.set(job.id, job);
  const root = await mkdtemp(join(tmpdir(), 'transcoder-'));
  const app = createApp({ queue, storagePaths: { uploads: join(root, 'uploads'), output: join(root, 'output') } });
  const response = await request(app).get('/api/jobs/1');
  assert.equal(response.body.data.assets.video, '/api/jobs/1/download/video');
  assert.equal((await request(app).get('/api/jobs/nope/download/video')).status, 400);
});
