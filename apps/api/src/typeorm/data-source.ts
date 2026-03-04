import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  AuditLog,
  Booking,
  Facility,
  PasswordResetToken,
  RefreshToken,
  Tenant,
  User,
  WaitingListEntry,
  PromoCode,
  PromoCodeRedemption,
  GoalMilestone,
  Customer,
} from '@khana/data-access';
import { normalizeNodeEnv, resolveEnvFilePaths } from '../app/config/env-files';

const nodeEnv = normalizeNodeEnv(process.env['NODE_ENV']);

for (const envPath of resolveEnvFilePaths(nodeEnv)) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

if (!process.env['DATABASE_URL']) {
  throw new Error(
    'DATABASE_URL is required to run TypeORM migrations. Check your .env.* files.'
  );
}

export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  entities: [
    Tenant,
    Facility,
    User,
    Booking,
    RefreshToken,
    PasswordResetToken,
    AuditLog,
    WaitingListEntry,
    PromoCode,
    PromoCodeRedemption,
    GoalMilestone,
    Customer,
  ],
  // Migration CLI should never use synchronize.
  synchronize: false,
  migrationsTableName: 'typeorm_migrations',
  migrations: [
    resolve(process.cwd(), 'libs/data-access/src/lib/migrations/*{.ts,.js}'),
    resolve(
      process.cwd(),
      'dist/libs/data-access/src/lib/migrations/*{.ts,.js}'
    ),
  ],
});
