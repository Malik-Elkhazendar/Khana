import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { DashboardStore } from './dashboard.store';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';

describe('DashboardStore', () => {
  let store: InstanceType<typeof DashboardStore>;
  let apiMock: ApiServiceMock;
  let logger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    apiMock = createApiMock();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: LoggerService, useValue: logger },
      ],
    });

    store = TestBed.inject(DashboardStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('initializes with empty snapshot state', () => {
    expect(store.snapshot()).toBeNull();
    expect(store.loadingSnapshot()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('loads snapshot successfully', async () => {
    await store.loadSnapshot('facility-1');

    expect(apiMock.getTodaySnapshot).toHaveBeenCalledWith('facility-1');
    expect(store.snapshot()).not.toBeNull();
    expect(store.loadingSnapshot()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('deduplicates in-flight snapshot loads', async () => {
    await Promise.all([
      store.loadSnapshot('facility-1'),
      store.loadSnapshot('facility-1'),
    ]);

    expect(apiMock.getTodaySnapshot).toHaveBeenCalledTimes(1);
  });

  it('captures and logs load errors', async () => {
    apiMock.getTodaySnapshot.mockReturnValueOnce(
      throwError(() => new Error('boom'))
    );

    await store.loadSnapshot();

    expect(store.loadingSnapshot()).toBe(false);
    expect(store.error()).toEqual(expect.any(Error));
    expect(logger.error).toHaveBeenCalledWith(
      'client.dashboard.snapshot.load.failed',
      'Failed to load today snapshot',
      { facilityId: null },
      expect.any(Error)
    );
  });
});
