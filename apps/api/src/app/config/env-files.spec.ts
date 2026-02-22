import { normalizeNodeEnv, resolveEnvFilePaths } from './env-files';

describe('env-files', () => {
  describe('normalizeNodeEnv', () => {
    it('defaults to development when empty', () => {
      expect(normalizeNodeEnv(undefined)).toBe('development');
      expect(normalizeNodeEnv('')).toBe('development');
      expect(normalizeNodeEnv('   ')).toBe('development');
    });

    it('normalizes common aliases', () => {
      expect(normalizeNodeEnv('dev')).toBe('development');
      expect(normalizeNodeEnv('prod')).toBe('production');
      expect(normalizeNodeEnv('DEVELOPMENT')).toBe('development');
      expect(normalizeNodeEnv('Production')).toBe('production');
    });
  });

  describe('resolveEnvFilePaths', () => {
    it('uses deterministic development order and excludes .env', () => {
      const paths = resolveEnvFilePaths('development');

      expect(paths[0]).toMatch(/[\\/]\.env\.development\.local$/);
      expect(paths[1]).toMatch(/[\\/]\.env\.dev\.local$/);
      expect(paths[2]).toMatch(/[\\/]\.env\.local$/);
      expect(paths[3]).toMatch(/[\\/]\.env\.development$/);
      expect(paths[4]).toMatch(/[\\/]\.env\.dev$/);
      expect(paths.some((path) => /[\\/]\.env$/.test(path))).toBe(false);
    });

    it('keeps test isolated from .env.local and .env', () => {
      const paths = resolveEnvFilePaths('test');

      expect(paths[0]).toMatch(/[\\/]\.env\.test\.local$/);
      expect(paths[1]).toMatch(/[\\/]\.env\.test$/);
      expect(paths.some((path) => /[\\/]\.env\.local$/.test(path))).toBe(false);
      expect(paths.some((path) => /[\\/]\.env$/.test(path))).toBe(false);
    });

    it('includes .env fallback for non-development environments', () => {
      const paths = resolveEnvFilePaths('production');

      expect(paths[0]).toMatch(/[\\/]\.env\.production\.local$/);
      expect(paths[1]).toMatch(/[\\/]\.env\.prod\.local$/);
      expect(paths[2]).toMatch(/[\\/]\.env\.local$/);
      expect(paths[3]).toMatch(/[\\/]\.env\.production$/);
      expect(paths[4]).toMatch(/[\\/]\.env\.prod$/);
      expect(paths[5]).toMatch(/[\\/]\.env$/);
    });
  });
});
