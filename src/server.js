import { createApp } from './app.js';
import { createQueue } from './queue.js';

const queue = createQueue();
const server = createApp({ queue }).listen(Number(process.env.PORT ?? 3000), () => console.log('Transcoder API listening on port 3000.'));
async function shutdown(signal) { console.log(`${signal} received.`); server.close(); await queue.close(); process.exit(0); }
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
