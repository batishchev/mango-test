import cluster, { Worker } from 'node:cluster';
import logger from './features/logger.js';
import os from 'node:os';
import { migrate } from './features/database/db.js';
import { main as doWork } from './features/worker.js';

async function main() {
  if (!cluster.isPrimary) {
    return doWork();
  }

  // Проверяем базу данных
  await migrate();

  // fork-аем дочерние процессы
  new Array(os.availableParallelism()).fill(0).map(forkWorker);
}

// TODO: подписаться на события: disconnect, error, exit
// TODO: переподнимать при падении
function forkWorker(): Worker {
  const worker = cluster.fork();

  worker.on('online', () => logger.info('worker online'));

  return worker;
}

main();
