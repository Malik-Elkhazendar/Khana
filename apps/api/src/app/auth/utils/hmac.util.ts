import { createHmac, timingSafeEqual } from 'crypto';

const getHmacSecret = (secretOverride?: string): string => {
  const secret = secretOverride || process.env['REFRESH_TOKEN_HMAC_SECRET'];
  if (!secret) {
    throw new Error('REFRESH_TOKEN_HMAC_SECRET is not set');
  }
  return secret;
};

export const hashRefreshToken = (
  token: string,
  secretOverride?: string
): string => {
  const secret = getHmacSecret(secretOverride);
  return createHmac('sha256', secret).update(token).digest('hex');
};

export const verifyRefreshTokenHash = (
  token: string,
  storedHash: string,
  secretOverride?: string
): boolean => {
  const computedHash = hashRefreshToken(token, secretOverride);

  const computedBuffer = Buffer.from(computedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (computedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(computedBuffer, storedBuffer);
};

export const hashDeviceFingerprint = (
  ipAddress?: string,
  userAgent?: string,
  secretOverride?: string
): string | null => {
  if (!ipAddress && !userAgent) {
    return null;
  }

  const secret = getHmacSecret(secretOverride);
  const input = `${ipAddress || 'unknown'}|${userAgent || 'unknown'}`;
  return createHmac('sha256', secret).update(input).digest('hex');
};
