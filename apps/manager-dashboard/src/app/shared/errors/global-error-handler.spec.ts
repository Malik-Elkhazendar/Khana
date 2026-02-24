import { TestBed } from '@angular/core/testing';
import { ErrorReporterService } from '../services/error-reporter.service';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let reporterMock: jest.Mocked<ErrorReporterService>;
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    reporterMock = {
      report: jest.fn(),
    } as unknown as jest.Mocked<ErrorReporterService>;

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: ErrorReporterService, useValue: reporterMock },
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('forwards errors to ErrorReporterService', () => {
    const err = new Error('Global error');

    handler.handleError(err);

    expect(reporterMock.report).toHaveBeenCalledWith(err, {
      source: 'angular.global_error_handler',
    });
  });

  it('never throws when reporter fails', () => {
    reporterMock.report.mockImplementation(() => {
      throw new Error('Reporter failure');
    });

    expect(() => handler.handleError(new Error('x'))).not.toThrow();
  });
});
