import { maskEmail, maskPhone } from '@khana/shared-utils';
import { redact } from './redaction.util';

describe('maskEmail', () => {
  it('should mask a normal email', () => {
    expect(maskEmail('test@example.com')).toBe('t***@example.com');
  });

  it('should mask single char local part', () => {
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });

  it('should return empty string for empty input', () => {
    expect(maskEmail('')).toBe('');
  });

  it('should return input without @', () => {
    expect(maskEmail('notanemail')).toBe('notanemail');
  });
});

describe('maskPhone', () => {
  it('should mask a full phone number', () => {
    expect(maskPhone('+966501234567')).toBe('+966***4567');
  });

  it('should fully mask short phone (<=7 chars)', () => {
    expect(maskPhone('12345')).toBe('***');
    expect(maskPhone('1234567')).toBe('***');
  });

  it('should partially mask medium phone numbers (8-10 chars)', () => {
    expect(maskPhone('12345678')).toBe('12***78');
    expect(maskPhone('1234567890')).toBe('12***90');
  });

  it('should handle empty string', () => {
    expect(maskPhone('')).toBe('');
  });
});

describe('redact', () => {
  it('should redact password field', () => {
    const result = redact({ password: 'secret123' });
    expect(result.password).toBe('[REDACTED]');
  });

  it('should redact nested objects', () => {
    const result = redact({ user: { password: 'secret123', name: 'John' } });
    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.name).toBe('John');
  });

  it('should mask email fields', () => {
    const result = redact({ email: 'user@example.com' });
    expect(result.email).toBe('u***@example.com');
  });

  it('should mask phone fields', () => {
    const result = redact({ phone: '+966501234567' });
    expect(result.phone).toBe('+966***4567');
  });

  it('should handle null and undefined', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('should handle case-insensitive field names', () => {
    const result = redact({ Password: 'secret', TOKEN: 'abc' });
    expect(result.Password).toBe('[REDACTED]');
    expect(result.TOKEN).toBe('[REDACTED]');
  });

  it('should handle arrays', () => {
    const result = redact({ items: [{ password: 'x' }, { password: 'y' }] });
    expect(result.items[0].password).toBe('[REDACTED]');
    expect(result.items[1].password).toBe('[REDACTED]');
  });

  it('should preserve circular references without throwing', () => {
    const node: { password: string; self?: unknown } = { password: 'secret' };
    node.self = node;

    expect(() => redact(node)).not.toThrow();
    const result = redact(node);
    expect(result.password).toBe('[REDACTED]');
    expect(result.self).toBe(result);
  });

  it('should safely serialize bigint/function/symbol values', () => {
    const result = redact({
      counter: BigInt(99),
      handler: () => 'ok',
      marker: Symbol('secret-marker'),
    });

    expect(result.counter).toBe('99');
    expect(result.handler).toBe('[Function]');
    expect(result.marker).toBe('Symbol(secret-marker)');
  });

  it('should redact all REDACTED_FIELDS', () => {
    const obj = {
      password: 'a',
      newPassword: 'b',
      oldPassword: 'c',
      currentPassword: 'd',
      token: 'e',
      refreshToken: 'f',
      accessToken: 'g',
      authorization: 'h',
      cookie: 'i',
      resetToken: 'j',
      tokenHash: 'k',
      passwordHash: 'l',
      secret: 'm',
      apiKey: 'n',
    };
    const result = redact(obj);
    for (const key of Object.keys(result)) {
      expect(result[key as keyof typeof result]).toBe('[REDACTED]');
    }
  });

  it('should not mutate the original object', () => {
    const original = { password: 'secret', email: 'user@example.com' };
    redact(original);
    expect(original.password).toBe('secret');
    expect(original.email).toBe('user@example.com');
  });

  it('should return fallback payload when redaction fails', () => {
    const explosive = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('ownKeys exploded');
        },
      }
    );

    const result = redact(explosive as unknown as Record<string, unknown>);
    expect(result).toEqual({
      redactionError: true,
      reason: 'ownKeys exploded',
    });
  });
});
