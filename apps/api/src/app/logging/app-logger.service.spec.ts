import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';

describe('AppLoggerService', () => {
  let requestContextService: jest.Mocked<RequestContextService>;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      LOG_FORMAT: 'json',
      LOG_COLOR: 'off',
      LOG_NEST_INFO: 'auto',
    };

    requestContextService = {
      get: jest.fn().mockReturnValue({
        requestId: 'req-123',
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sid-1',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: '01',
        method: 'GET',
        path: '/api/v1/test',
        startTime: Date.now() - 10,
      }),
      getRequestId: jest.fn().mockReturnValue('req-123'),
      run: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<RequestContextService>;

    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.env = originalEnv;
  });

  function createService(): AppLoggerService {
    return new AppLoggerService(requestContextService);
  }

  function parseLine(
    spy: jest.SpyInstance,
    callIndex = 0
  ): Record<string, unknown> {
    const line = String(spy.mock.calls[callIndex]?.[0] ?? '').trim();
    return JSON.parse(line) as Record<string, unknown>;
  }

  it('keeps JSON mode backward-compatible and adds OTel-ready fields', () => {
    const service = createService();

    service.info('auth.login.success', 'User logged in', {
      statusCode: 200,
      durationMs: 17,
      email: 'user@example.com',
    });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const payload = parseLine(stdoutSpy);

    expect(payload['ts']).toEqual(expect.any(String));
    expect(payload['timestamp']).toBe(payload['ts']);
    expect(payload['level']).toBe('info');
    expect(payload['severityText']).toBe('INFO');
    expect(payload['severityNumber']).toBe(9);
    expect(payload['event']).toBe('auth.login.success');
    expect(payload['statusCode']).toBe(200);
    expect(payload['durationMs']).toBe(17);
    expect(payload['trace_id']).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(payload['span_id']).toBe('00f067aa0ba902b7');
    expect(payload['trace_flags']).toBe('01');
  });

  it('marks fatal logs with FATAL severity while keeping compatibility', () => {
    const service = createService();

    service.fatal('Fatal startup', 'trace-line', 'Bootstrap');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const payload = parseLine(stderrSpy);

    expect(payload['level']).toBe('error');
    expect(payload['event']).toBe('nest.fatal');
    expect(payload['severityText']).toBe('FATAL');
    expect(payload['severityNumber']).toBe(21);
  });

  it('renders hybrid compact pretty logs with expected token order', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_COLOR'] = 'off';

    const service = createService();

    service.info('booking.create.success', 'Booking created', {
      statusCode: 201,
      durationMs: 14,
      bookingId: 'b1',
    });

    const line = String(stdoutSpy.mock.calls[0]?.[0] ?? '');

    expect(line).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} INFO 201\/14ms GET \/api\/v1\/test req=req-123 ten=tenant-1 usr=user-1 evt=booking\.create\.success msg="Booking created"/
    );
    expect(line).toContain(
      'ctx={"statusCode":201,"durationMs":14,"bookingId":"b1"}'
    );
  });

  it('applies level and status colors in pretty mode when enabled', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_COLOR'] = 'on';

    const service = createService();

    service.info('http.request.completed', 'ok', {
      statusCode: 200,
      durationMs: 8,
    });
    service.warn('http.request.failed', 'bad request', {
      statusCode: 404,
      durationMs: 12,
    });
    service.error('http.request.failed', 'server error', {
      statusCode: 500,
      durationMs: 20,
    });

    const infoLine = String(stdoutSpy.mock.calls[0]?.[0] ?? '');
    const warnLine = String(stderrSpy.mock.calls[0]?.[0] ?? '');
    const errorLine = String(stderrSpy.mock.calls[1]?.[0] ?? '');

    expect(infoLine).toContain('\u001b[36mINFO\u001b[0m');
    expect(infoLine).toContain('\u001b[32m200\u001b[0m/8ms');

    expect(warnLine).toContain('\u001b[33mWARN\u001b[0m');
    expect(warnLine).toContain('\u001b[33m404\u001b[0m/12ms');

    expect(errorLine).toContain('\u001b[31mERROR\u001b[0m');
    expect(errorLine).toContain('\u001b[31m500\u001b[0m/20ms');
  });

  it('prints error stack on a multiline block in pretty mode only', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_COLOR'] = 'off';

    const service = createService();
    const error = new Error('Boom');

    service.error(
      'system.seed.failed',
      'Seed failed',
      { phase: 'seed' },
      error
    );

    const line = String(stderrSpy.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('err="Error:Boom"');
    expect(line).toContain('\n    Error: Boom');
  });

  it('truncates pretty context display without truncating JSON mode context', () => {
    const longPayload = 'x'.repeat(600);

    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_COLOR'] = 'off';
    const prettyService = createService();
    prettyService.info('system.startup', 'Pretty long context', {
      payload: longPayload,
    });

    const prettyLine = String(stdoutSpy.mock.calls[0]?.[0] ?? '');
    expect(prettyLine).toContain('ctxTruncated=true');
    expect(prettyLine).not.toContain(longPayload);

    stdoutSpy.mockClear();

    process.env['LOG_FORMAT'] = 'json';
    const jsonService = createService();
    jsonService.info('system.startup', 'JSON long context', {
      payload: longPayload,
    });

    const jsonPayload = parseLine(stdoutSpy);
    const jsonContext = jsonPayload['context'] as Record<string, unknown>;
    expect(jsonContext['payload']).toBe(longPayload);
  });

  it('filters low-signal nest.info logs in pretty mode by default', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_NEST_INFO'] = 'auto';

    const service = createService();

    service.log('TypeOrmModule dependencies initialized', 'InstanceLoader');
    service.log('Mapped {/api, GET} route', 'RouterExplorer');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('does not filter startup boundary nest.info logs', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_NEST_INFO'] = 'auto';

    const service = createService();

    service.log('Starting Nest application...', 'NestFactory');
    service.log('Nest application successfully started', 'NestApplication');

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
  });

  it('does not filter nest.info when LOG_NEST_INFO=on', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_NEST_INFO'] = 'on';

    const service = createService();

    service.log('Mapped {/api, GET} route', 'RouterExplorer');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it('never filters warnings or errors', () => {
    process.env['LOG_FORMAT'] = 'pretty';
    process.env['LOG_NEST_INFO'] = 'off';

    const service = createService();

    service.warn('Potential issue', 'InstanceLoader');
    service.error('Failure', 'trace-line', 'InstanceLoader');

    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it('routes info/debug to stdout and warn/error/fatal to stderr', () => {
    const service = createService();

    service.info('system.startup', 'info');
    service.debug('system.debug', 'debug');
    service.warn('system.warn', 'warn');
    service.error('system.error', 'error');
    service.fatal('fatal message', 'trace', 'Bootstrap');

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledTimes(3);
  });
});
