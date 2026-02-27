import { ConfigService } from '@nestjs/config';
import { normalizeNodeEnv } from './env-files';

const RELEASE_ENVS = new Set(['staging', 'production']);
const JWT_SECRET_KEYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
const WEAK_SECRET_MARKERS = [
  'change-in-production',
  'change_me',
  'changeme',
  'default',
  'example',
  'placeholder',
  'your_',
];
const MIN_SECRET_LENGTH = 32;

function findWeakMarker(secret: string): string | undefined {
  const normalized = secret.toLowerCase();
  return WEAK_SECRET_MARKERS.find((marker) => normalized.includes(marker));
}

export function validateJwtSecretsOrThrow(
  nodeEnv: string,
  configService: ConfigService
): void {
  const normalizedEnv = normalizeNodeEnv(nodeEnv);

  if (!RELEASE_ENVS.has(normalizedEnv)) {
    return;
  }

  const violations: string[] = [];

  for (const secretKey of JWT_SECRET_KEYS) {
    const secret = configService.get<string>(secretKey)?.trim();

    if (!secret) {
      violations.push(`${secretKey}: missing value`);
      continue;
    }

    if (secret.length < MIN_SECRET_LENGTH) {
      violations.push(
        `${secretKey}: must be at least ${MIN_SECRET_LENGTH} characters`
      );
    }

    const weakMarker = findWeakMarker(secret);
    if (weakMarker) {
      violations.push(`${secretKey}: contains weak marker "${weakMarker}"`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Insecure JWT configuration for NODE_ENV=${normalizedEnv}. ${violations.join(
        '; '
      )}. Provide strong secrets via environment variables or a secret manager.`
    );
  }
}
