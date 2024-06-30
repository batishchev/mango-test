import bodyParser from 'body-parser';
import express from 'express';
import logger from './logger.js';
import process from 'node:process';
import { expressRoutes as userRoutes } from './users.js';

export function main() {
  const port = process.env.PORT || 8000;
  const app = express();

  app.use(bodyParser.json());

  app.use('/users', userRoutes());

  app.listen(port, () => logger.info(`Server is listening on port ${port}`));
}
