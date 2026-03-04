import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AnalyticsComponent } from './analytics.component';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { FacilityContextStore } from '../../shared/state';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';

const EN_TRANSLATIONS = {
  DASHBOARD: {
    PAGES: {
      ANALYTICS: {
        TITLE: 'Analytics',
        SUBTITLE: 'KPI and trends',
      },
    },
  },
};

describe('AnalyticsComponent', () => {
  let fixture: ComponentFixture<AnalyticsComponent>;
  let component: AnalyticsComponent;
  let apiMock: ApiServiceMock;
  let translateService: TranslateService;

  const facilityContextMock = {
    facilities: signal([
      {
        id: 'facility-1',
        name: 'Court A',
        type: 'PADEL_COURT' as const,
        basePrice: 180,
        openTime: '08:00',
        closeTime: '23:00',
      },
    ]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(async () => {
    apiMock = createApiMock();
    facilityContextMock.initialize.mockReset();

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: apiMock },
        {
          provide: LoggerService,
          useValue: {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('creates and loads analytics on init', () => {
    expect(component).toBeTruthy();
    expect(facilityContextMock.initialize).toHaveBeenCalled();
    expect(apiMock.getAnalyticsSummary).toHaveBeenCalled();
    expect(apiMock.getAnalyticsOccupancy).toHaveBeenCalled();
    expect(apiMock.getAnalyticsRevenue).toHaveBeenCalled();
    expect(apiMock.getAnalyticsPeakHours).toHaveBeenCalled();
  });

  it('renders analytics page header', () => {
    const title = fixture.nativeElement.querySelector('h1');
    expect(title?.textContent).toContain('Analytics');
  });

  it('applies filters and reloads analytics', async () => {
    component.fromDate.set('2026-03-01');
    component.toDate.set('2026-03-05');
    component.groupBy.set('week');
    component.facilityId.set('facility-1');

    await component.applyFilters();

    expect(apiMock.getAnalyticsSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({
        facilityId: 'facility-1',
      })
    );
    expect(apiMock.getAnalyticsRevenue).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupBy: 'week',
      })
    );
  });

  it('validates date range before loading filters', async () => {
    component.fromDate.set('2026-03-10');
    component.toDate.set('2026-03-01');
    const beforeCalls = apiMock.getAnalyticsSummary.mock.calls.length;

    await component.applyFilters();

    expect(component.filterError()).toBe(
      'DASHBOARD.PAGES.ANALYTICS.ERRORS.INVALID_RANGE'
    );
    expect(apiMock.getAnalyticsSummary.mock.calls.length).toBe(beforeCalls);
  });
});
