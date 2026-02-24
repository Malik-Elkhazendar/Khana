import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ErrorReporterService } from './error-reporter.service';
import { LoggerService } from './logger.service';

describe('ErrorReporterService', () => {
  let service: ErrorReporterService;
  let loggerMock: jest.Mocked<LoggerService>;

  const originalLogging = { ...environment.logging };

  beforeEach(() => {
    loggerMock = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    TestBed.configureTestingModule({
      providers: [
        ErrorReporterService,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    service = TestBed.inject(ErrorReporterService);
    environment.logging.sentry = false;
    delete environment.logging.sentryDsn;
  });

  afterEach(() => {
    environment.logging.level = originalLogging.level;
    environment.logging.console = originalLogging.console;
    environment.logging.sentry = originalLogging.sentry;
    environment.logging.sentryDsn = originalLogging.sentryDsn;
    jest.clearAllMocks();
  });

  it('reports unhandled errors through LoggerService', () => {
    const err = new Error('Unhandled');
    service.report(err, { feature: 'auth' });

    expect(loggerMock.error).toHaveBeenCalledWith(
      'client.error.unhandled',
      'Unhandled client error',
      { feature: 'auth' },
      err
    );
  });

  it('emits provider pending debug log when sentry is configured', () => {
    environment.logging.sentry = true;
    environment.logging.sentryDsn = 'https://example@sentry.io/project';

    service.report(new Error('With sentry'));

    expect(loggerMock.debug).toHaveBeenCalledWith(
      'client.error.reporter.provider_pending',
      'External error provider configured but integration is not enabled in this phase.',
      { provider: 'sentry' }
    );
  });
});
