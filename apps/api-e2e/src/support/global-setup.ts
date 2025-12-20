import { waitForPortOpen } from '@nx/node/utils';
import 'dotenv/config';
import { Client } from 'pg';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await waitForPortOpen(port, { host });

  // Reset bookings to keep e2e deterministic (keep tenants/facilities seeded).
  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.query('TRUNCATE TABLE bookings RESTART IDENTITY CASCADE;');
    } catch (error: unknown) {
      // Don't fail the suite if DB reset isn't possible (e.g., table doesn't exist yet).
      console.warn('DB reset skipped:', error);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
