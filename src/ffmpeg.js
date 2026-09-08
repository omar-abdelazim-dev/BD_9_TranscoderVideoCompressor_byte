import { spawn } from 'node:child_process';

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8_000); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

export async function transcode({ inputPath, outputPath, thumbnailPath, execute = run }) {
  await execute('ffmpeg', [
    '-y', '-i', inputPath,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '28',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath
  ]);
  await execute('ffmpeg', ['-y', '-ss', '0.1', '-i', inputPath, '-frames:v', '1', '-q:v', '2', thumbnailPath]);
}
