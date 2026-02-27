import { ConfigService } from '@nestjs/config';
import { validateJwtSecretsOrThrow } from './secret-validation';

function createConfigService(
  values: Record<string, string | undefined>
): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('validateJwtSecretsOrThrow', () => {
  it('allows placeholder-style values in development', () => {
    const configService = createConfigService({
      JWT_SECRET: 'change-in-production',
      JWT_REFRESH_SECRET: 'change-in-production',
    });

    expect(() =>
      validateJwtSecretsOrThrow('development', configService)
    ).not.toThrow();
  });

  it('fails in production when JWT_SECRET is missing', () => {
    const configService = createConfigService({
      JWT_SECRET: undefined,
      JWT_REFRESH_SECRET: 'x'.repeat(64),
    });

    expect(() =>
      validateJwtSecretsOrThrow('production', configService)
    ).toThrow(/JWT_SECRET: missing value/);
  });

  it('fails in staging when JWT_REFRESH_SECRET is missing', () => {
    const configService = createConfigService({
      JWT_SECRET: 'x'.repeat(64),
      JWT_REFRESH_SECRET: undefined,
    });

    expect(() => validateJwtSecretsOrThrow('staging', configService)).toThrow(
      /JWT_REFRESH_SECRET: missing value/
    );
  });

  it('fails when a weak marker is present', () => {
    const configService = createConfigService({
      JWT_SECRET: 'my-change-in-production-secret-that-is-long-enough',
      JWT_REFRESH_SECRET: 'x'.repeat(64),
    });

    expect(() =>
      validateJwtSecretsOrThrow('production', configService)
    ).toThrow(/contains weak marker/);
  });

  it('fails when secrets are too short', () => {
    const configService = createConfigService({
      JWT_SECRET: 'short-secret',
      JWT_REFRESH_SECRET: 'x'.repeat(64),
    });

    expect(() =>
      validateJwtSecretsOrThrow('production', configService)
    ).toThrow(/must be at least 32 characters/);
  });

  it('passes in production with strong secrets', () => {
    const configService = createConfigService({
      JWT_SECRET: 'prod-jwt-secret-0123456789-0123456789',
      JWT_REFRESH_SECRET: 'prod-refresh-secret-0123456789-0123456789',
    });

    expect(() =>
      validateJwtSecretsOrThrow('production', configService)
    ).not.toThrow();
  });
});
