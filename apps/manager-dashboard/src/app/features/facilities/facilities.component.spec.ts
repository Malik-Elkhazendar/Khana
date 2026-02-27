import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FacilityListItemDto } from '@khana/shared-dtos';
import { FacilityContextStore } from '../../shared/state';
import { FacilitiesComponent } from './facilities.component';

const createFacility = (id: string, name: string): FacilityListItemDto => ({
  id,
  name,
  openTime: '08:00',
  closeTime: '23:00',
  slotDurationMinutes: 60,
  basePrice: 350,
  currency: 'SAR',
});

describe('FacilitiesComponent', () => {
  const facilityContextMock = {
    facilities: signal<FacilityListItemDto[]>([
      createFacility('facility-1', 'Center Court'),
      createFacility('facility-2', 'Padel Court 2'),
    ]),
    selectedFacilityId: signal<string | null>('facility-1'),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(async () => {
    facilityContextMock.refreshFacilities.mockReset();
    facilityContextMock.selectFacility.mockReset();
    facilityContextMock.error.set(null);
    facilityContextMock.loading.set(false);
    facilityContextMock.selectedFacilityId.set('facility-1');

    await TestBed.configureTestingModule({
      imports: [FacilitiesComponent, TranslateModule.forRoot()],
      providers: [
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();
  });

  it('renders facilities and active state', () => {
    const fixture = TestBed.createComponent(FacilitiesComponent);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.facility-card');
    const activeBadge = fixture.nativeElement.querySelector(
      '.facility-card__badge'
    ) as HTMLElement | null;
    const activeAction = fixture.nativeElement.querySelector(
      '.facility-card__active-action'
    ) as HTMLElement | null;

    expect(cards.length).toBe(2);
    expect(activeBadge).toBeTruthy();
    expect(activeAction).toBeTruthy();
  });

  it('calls selectFacility when activating a different facility', () => {
    const fixture = TestBed.createComponent(FacilitiesComponent);
    fixture.detectChanges();

    const actionButtons = fixture.nativeElement.querySelectorAll(
      '.facility-card__action'
    ) as NodeListOf<HTMLButtonElement>;

    actionButtons[0]?.click();
    expect(facilityContextMock.selectFacility).toHaveBeenCalledWith(
      'facility-2'
    );
  });
});
