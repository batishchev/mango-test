import logger from './logger.js';
import { createClient } from 'redis';

type ClientType = ReturnType<typeof createClient>;

export const getClient = (() => {
  let client: ClientType;

  return async () => {
    if (client) {
      return client;
    }

    client = createClient({
      url: process.env['REDIS_ADDRESS']
    });

    client.on('error', (e: Error) => {
      logger.error(e, 'Redis error');
    });

    await client.connect();

    return client;
  };
})();

export const execute = async (handler: (client: ClientType) => any) => handler(await getClient());
