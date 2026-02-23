import { existsSync } from 'fs';
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import axios from 'axios';
// Jest global setup runs outside Nx path mapping; keep this import runtime-resolvable.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { resolveEnvFilePaths } from '../../../../libs/shared-utils/src/lib/env-files';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Load API env files with explicit precedence (highest wins).
  const envFilePaths = resolveEnvFilePaths(process.env['NODE_ENV']);
  for (const envFilePath of [...envFilePaths].reverse()) {
    if (existsSync(envFilePath)) {
      loadDotenv({ path: envFilePath, override: true });
    }
  }

  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT
    ? Number(process.env.PORT)
    : Number(process.env.API_PORT || '3000');
  await waitForApiReady(host, port);

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

async function waitForApiReady(
  host: string,
  port: number,
  timeoutMs = 120000,
  retryDelayMs = 1000
): Promise<void> {
  const url = `http://${host}:${port}/api`;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await axios.get(url, {
        timeout: 2000,
        validateStatus: () => true,
      });
      return;
    } catch (error: unknown) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `API not ready at ${url} within ${timeoutMs}ms. Last error: ${reason}`
  );
}
