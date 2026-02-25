import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  const originalProduction = environment.production;
  const originalLogging = { ...environment.logging };

  beforeEach(() => {
    environment.production = false;
    environment.logging.level = 'debug';
    environment.logging.console = true;
    environment.logging.sentry = false;
    delete environment.logging.sentryDsn;
  });

  afterEach(() => {
    environment.production = originalProduction;
    environment.logging.level = originalLogging.level;
    environment.logging.console = originalLogging.console;
    environment.logging.sentry = originalLogging.sentry;
    environment.logging.sentryDsn = originalLogging.sentryDsn;
    jest.restoreAllMocks();
  });

  it('emits structured json payload for info logs', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.info('client.test.info', 'Test info message', {
      feature: 'booking',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;

    expect(payload['level']).toBe('info');
    expect(payload['event']).toBe('client.test.info');
    expect(payload['message']).toBe('Test info message');
    expect(payload['clientSessionId']).toEqual(expect.any(String));
    expect(payload['context']).toEqual({ feature: 'booking' });
  });

  it('uses a stable clientSessionId across logs from one service instance', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.info('client.test.info', 'First message');
    logger.info('client.test.info', 'Second message');

    expect(spy).toHaveBeenCalledTimes(2);
    const firstPayload = JSON.parse(spy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    const secondPayload = JSON.parse(spy.mock.calls[1][0] as string) as Record<
      string,
      unknown
    >;

    expect(firstPayload['clientSessionId']).toEqual(expect.any(String));
    expect(secondPayload['clientSessionId']).toBe(
      firstPayload['clientSessionId']
    );
  });

  it('honors minimum log level filtering', () => {
    environment.logging.level = 'warn';

    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.info('client.test.info', 'Should be skipped');
    logger.warn('client.test.warn', 'Should be emitted');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive fields and masks personal fields', () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.error('client.test.error', 'Sensitive context', {
      password: 'secret',
      token: 'abc123',
      tokenHash: 'hash-token',
      passwordHash: 'hash-password',
      email: 'user@example.com',
      phone: '+966501234567',
      nested: { refreshToken: 'refresh' },
    });

    const payload = JSON.parse(spy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    const context = payload['context'] as Record<string, unknown>;

    expect(context['password']).toBe('[REDACTED]');
    expect(context['token']).toBe('[REDACTED]');
    expect(context['tokenHash']).toBe('[REDACTED]');
    expect(context['passwordHash']).toBe('[REDACTED]');
    expect(context['email']).toBe('u***@example.com');
    expect(context['phone']).toBe('+966***4567');
    expect((context['nested'] as Record<string, unknown>)['refreshToken']).toBe(
      '[REDACTED]'
    );
  });

  it('promotes requestId to top-level and removes it from context', () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.error('client.test.error', 'Request-scoped error', {
      requestId: 'req-123',
      operation: 'load bookings',
    });

    const payload = JSON.parse(spy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;

    expect(payload['requestId']).toBe('req-123');
    expect(payload['context']).toEqual({ operation: 'load bookings' });
  });

  it('suppresses stack traces in production mode', () => {
    environment.production = true;

    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const logger = new LoggerService();
    const err = new Error('Boom');

    logger.error('client.test.error', 'Prod error', undefined, err);

    const payload = JSON.parse(spy.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    const error = payload['error'] as Record<string, unknown>;

    expect(error['name']).toBe('Error');
    expect(error['message']).toBe('Boom');
    expect(error['stack']).toBeUndefined();
  });

  it('does not emit when console logging is disabled', () => {
    environment.logging.console = false;

    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const logger = new LoggerService();

    logger.error('client.test.error', 'Should not be emitted');

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
