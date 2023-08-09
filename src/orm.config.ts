import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as dotenv from 'dotenv';
import { NODE_ENV, NODE_ENVIRONMENT } from '@utils/index';
dotenv.config();

const { DATABASE_URL, DATABASE_LOCAL_URL } = process.env;

let config: PostgresConnectionOptions;

switch (NODE_ENV) {
  default:
  case NODE_ENVIRONMENT.DEVELOPMENT:
    config = {
      type: 'postgres',
      url: DATABASE_LOCAL_URL,
      entities: [`${__dirname}/**/*.entity{.ts,.js}`],
      // We are using migrations, synchronize should be set to false.
      synchronize: true,
      logging: ['error', 'query'],
      logger: 'file',
      cache: { duration: 1000 * 60 * 30 }, //cache for 30 minutes
      // Allow both start:prod and start:dev to use migrations
      // __dirname is either dist or src folder, meaning either
      // the compiled js in prod or the ts in dev.
      migrations: [`${__dirname}/migrations/**/*{.ts,.js}`],
      migrationsTableName: 'migrations',
      // Run migrations automatically,
      // you can disable this if you prefer running migration manually.
      migrationsRun: false,
      ssl: false,
    };
    break;
  case NODE_ENVIRONMENT.PRODUCTION:
    config = {
      type: 'postgres',
      url: DATABASE_URL,
      synchronize: true,
      dropSchema: false,
      logging: ['error', 'query'],
      logger: 'file',
      ssl: false,
      cache: { duration: 20000 },
      entities: ['dist/**/*.entity.js'],
      migrations: [`${__dirname}/migrations/**/*{.ts,.js}`],
      migrationsTableName: 'migrations',
      // Run migrations automatically,
      // you can disable this if you prefer running migration manually.
      migrationsRun: false,
    };
    break;
}

export default config;
