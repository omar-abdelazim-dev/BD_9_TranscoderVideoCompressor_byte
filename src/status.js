const statusMap = { waiting: 'Queued', delayed: 'Queued', active: 'Processing', completed: 'Completed', failed: 'Failed' };

export async function serializeJob(job) {
  const state = await job.getState();
  const status = statusMap[state] ?? 'Queued';
  const data = {
    jobId: job.id, status, progress: typeof job.progress === 'number' ? job.progress : 0,
    attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts,
    createdAt: new Date(job.timestamp).toISOString()
  };
  if (status === 'Completed') {
    data.completedAt = new Date(job.finishedOn).toISOString();
    data.assets = { video: `/api/jobs/${job.id}/download/video`, thumbnail: `/api/jobs/${job.id}/download/thumbnail` };
  }
  if (status === 'Failed') data.error = job.failedReason || 'Transcoding failed.';
  return data;
}
