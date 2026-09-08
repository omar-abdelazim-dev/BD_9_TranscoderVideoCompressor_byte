import { readFile } from 'node:fs/promises';

const allowedMimes = new Set(['video/mp4', 'video/quicktime']);

export function hasIsoBaseMediaHeader(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

export async function validateVideoFile(file) {
  if (!file) return { error: 'A multipart field named video is required.' };
  if (!allowedMimes.has(file.mimetype)) return { error: 'Only video/mp4 and video/quicktime are accepted.' };
  const header = await readFile(file.path, { encoding: null });
  if (!hasIsoBaseMediaHeader(header.subarray(0, 16))) return { error: 'The uploaded file is not a valid MP4/MOV container.' };
  return { value: file };
}

export function safeAssetName(jobId, kind) {
  if (!/^\d+$/.test(String(jobId))) throw new Error('Invalid job id for asset path.');
  if (!['video', 'thumbnail'].includes(kind)) throw new Error('Invalid asset kind.');
  return kind === 'video' ? `${jobId}.mp4` : `${jobId}.jpg`;
}
