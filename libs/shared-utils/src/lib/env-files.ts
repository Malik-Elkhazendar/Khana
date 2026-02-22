import { resolve } from 'path';

const ENV_ALIASES: Record<string, string[]> = {
  development: ['development', 'dev'],
  production: ['production', 'prod'],
  staging: ['staging'],
  test: ['test'],
};

/**
 * Normalize runtime env values to canonical names.
 */
export function normalizeNodeEnv(nodeEnv?: string): string {
  const raw = (nodeEnv || '').trim().toLowerCase();
  if (!raw) {
    return 'development';
  }

  if (raw === 'dev') {
    return 'development';
  }

  if (raw === 'prod') {
    return 'production';
  }

  return raw;
}

/**
 * Returns env files in priority order (highest -> lowest).
 *
 * Nest ConfigModule keeps the first value on key conflicts, so the order here
 * must be from most specific to least specific.
 */
export function resolveEnvFilePaths(nodeEnvRaw?: string): string[] {
  const nodeEnv = normalizeNodeEnv(nodeEnvRaw);
  const envNames = ENV_ALIASES[nodeEnv] ?? [nodeEnv];
  const paths: string[] = [];

  for (const envName of envNames) {
    paths.push(resolve(process.cwd(), `.env.${envName}.local`));
  }

  if (nodeEnv !== 'test') {
    paths.push(resolve(process.cwd(), '.env.local'));
  }

  for (const envName of envNames) {
    paths.push(resolve(process.cwd(), `.env.${envName}`));
  }

  // In dev/test, avoid .env fallback to prevent accidental secret drift.
  // Keep local credentials in .env.<env>.local / .env.local only.
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    paths.push(resolve(process.cwd(), '.env'));
  }

  return [...new Set(paths)];
}
