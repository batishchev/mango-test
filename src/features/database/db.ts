import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import logger from '../logger.js';

const pool = new pg.Pool({
  host: process.env['PG_HOST'],
  user: process.env['PG_USER'],
  password: process.env['PG_PASSWORD'],
  port: parseInt(process.env['PG_PORT'] || '5432', 10),
  database: process.env['PG_DATABASE'],
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
pool.on('error', (e) => logger.error(e));
export const db = pool;

/**
 * С нумероваными параметрами типа $1, $2 работать неудобно
 * Сделаем свой вариант со знаком вопроса без индекса
 * Пример: 'select * from user where id = ? limit ?' => 'select * from user where id = $1 limit $2'
 */
export function query(text: string, values?: any[]) {
  const s = serial();
  const query = text.replace(/\?/g, () => `$${s.next().value}`);

  logger.debug(query);

  return pool.query(query, values);
}
// export const query = pool.query.bind(pool);

/**
 * Для миграций лучше использовать отдельный инструмент.
 * Временное решение на коленке
 */
export async function migrate() {
  const migrationDir = path.join(import.meta.dirname, 'migrations');
  const version = await getCurrentDbVersion();

  const migrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.endsWith('.sql'))
    .slice(version);

  if (migrations.length <= 0) {
    return;
  }

  logger.info(`Выполняем миграции:\n\t${migrations.join('\n\t')}`);

  // Не оборачиваем в try/catch,
  // т.к. скорее всего мы не хотим работать с несоответствующей схемой приложения
  // Читаем файл синхронно целиком в оперативную память, т.к. query принимает только текст
  // Было-бы хорошо научить query принимать Readable Stream и делать pipe в query
  for (let i = 0; i < migrations.length; i++) {
    await query(fs.readFileSync(path.join(migrationDir, migrations[i]), { encoding: 'utf-8' }));
    await query('UPDATE info SET version = $1', [version + i + 1]);
  }
}

async function getCurrentDbVersion(): Promise<number> {
  try {
    const { rows } = await query('SELECT version FROM info');
    const [result] = rows;

    if (result && typeof result.version === 'number') {
      return result.version;
    }

    return 0;
  } catch (e) {
    return 0;
  }
}

function* serial() {
  let i = 0;
  while (true) {
    yield ++i;
  }
}
