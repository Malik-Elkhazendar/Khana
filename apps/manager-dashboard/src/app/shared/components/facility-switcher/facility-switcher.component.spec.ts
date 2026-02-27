import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FacilityContextStore } from '../../state';
import { FacilitySwitcherComponent } from './facility-switcher.component';

const EN_TRANSLATIONS = {
  DASHBOARD: {
    FACILITY_SWITCHER: {
      ARIA_LABEL: 'Facility selector',
      LABEL: 'Active facility',
      RETRY: 'Retry',
      LOADING: 'Loading facilities',
      EMPTY: 'No facilities available',
    },
  },
};

describe('FacilitySwitcherComponent', () => {
  let translateService: TranslateService;

  const facilityContextMock = {
    facilities: signal<{ id: string; name: string }[]>([]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  const setup = (variant: 'default' | 'header-compact' = 'default') => {
    const fixture = TestBed.createComponent(FacilitySwitcherComponent);
    fixture.componentInstance.variant = variant;
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    facilityContextMock.facilities.set([]);
    facilityContextMock.selectedFacilityId.set(null);
    facilityContextMock.loading.set(false);
    facilityContextMock.error.set(null);
    facilityContextMock.initialize.mockReset();
    facilityContextMock.refreshFacilities.mockReset();
    facilityContextMock.selectFacility.mockReset();
    facilityContextMock.clearError.mockReset();

    await TestBed.configureTestingModule({
      imports: [FacilitySwitcherComponent, TranslateModule.forRoot()],
      providers: [
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();

    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
  });

  it('renders label and state text in default variant', () => {
    facilityContextMock.loading.set(true);
    facilityContextMock.facilities.set([]);

    const { fixture } = setup('default');

    const label = fixture.nativeElement.querySelector(
      '.facility-switcher__label'
    ) as HTMLLabelElement | null;
    const state = fixture.nativeElement.querySelector(
      '.facility-switcher__state'
    ) as HTMLParagraphElement | null;

    expect(label).toBeTruthy();
    expect(label?.classList.contains('facility-switcher__label--sr-only')).toBe(
      false
    );
    expect(state).toBeTruthy();
  });

  it('hides visual label and state text in header-compact variant', () => {
    facilityContextMock.loading.set(true);
    facilityContextMock.facilities.set([]);

    const { fixture } = setup('header-compact');

    const label = fixture.nativeElement.querySelector(
      '.facility-switcher__label'
    ) as HTMLLabelElement | null;
    const state = fixture.nativeElement.querySelector(
      '.facility-switcher__state'
    );

    expect(label).toBeTruthy();
    expect(label?.classList.contains('facility-switcher__label--sr-only')).toBe(
      true
    );
    expect(state).toBeNull();
  });

  it('keeps select accessibility label in header-compact variant', () => {
    facilityContextMock.facilities.set([
      { id: 'facility-1', name: 'Center Court' },
    ]);
    facilityContextMock.selectedFacilityId.set('facility-1');

    const { fixture } = setup('header-compact');

    const select = fixture.nativeElement.querySelector(
      '.facility-switcher__select'
    ) as HTMLSelectElement | null;

    expect(select).toBeTruthy();
    expect(select?.getAttribute('aria-label')).toBe(
      translateService.instant('DASHBOARD.FACILITY_SWITCHER.LABEL')
    );
  });

  it('calls selectFacility when facility changes', () => {
    facilityContextMock.facilities.set([
      { id: 'facility-1', name: 'Center Court' },
      { id: 'facility-2', name: 'Side Court' },
    ]);
    facilityContextMock.selectedFacilityId.set('facility-1');

    const { fixture } = setup('header-compact');

    const select = fixture.nativeElement.querySelector(
      '.facility-switcher__select'
    ) as HTMLSelectElement;
    select.value = 'facility-2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(facilityContextMock.selectFacility).toHaveBeenCalledWith(
      'facility-2'
    );
  });
});
