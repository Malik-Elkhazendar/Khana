import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';
import { AuthStore } from '../../shared/state/auth.store';
import { FacilityContextStore } from '../../shared/state';
import { PromoCodesStore } from '../../state/promo-codes/promo-codes.store';
import { PromoCodesComponent } from './promo-codes.component';

describe('PromoCodesComponent', () => {
  let fixture: ComponentFixture<PromoCodesComponent>;
  let component: PromoCodesComponent;

  const promoItem = {
    id: 'promo-1',
    tenantId: 'tenant-1',
    code: 'SAVE10',
    discountType: PromoDiscountType.PERCENTAGE,
    discountValue: 10,
    maxUses: 100,
    currentUses: 12,
    remainingUses: 88,
    isExhausted: false,
    expiresAt: '2026-12-31T23:59:59.999Z',
    isExpired: false,
    facilityScope: PromoFacilityScope.ALL_FACILITIES,
    facilityId: null,
    isActive: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };

  const promoStoreMock = {
    data: signal({
      items: [promoItem],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
    loading: signal(false),
    error: signal<Error | null>(null),
    filters: signal({
      facilityId: null as string | null,
      isActive: null as boolean | null,
      includeExpired: false,
      page: 1,
      pageSize: 20,
    }),
    actionLoadingByKey: signal<Record<string, boolean>>({}),
    actionErrorByKey: signal<Record<string, string | null>>({}),
    modal: signal({
      isOpen: false,
      mode: 'create' as const,
      editingPromoId: null as string | null,
    }),
    load: jest.fn().mockResolvedValue(undefined),
    setFilters: jest.fn(),
    setPage: jest.fn(),
    clearError: jest.fn(),
    openCreateModal: jest.fn(),
    openEditModal: jest.fn(),
    closeModal: jest.fn(),
    createPromo: jest.fn().mockResolvedValue(true),
    updatePromo: jest.fn().mockResolvedValue(true),
    toggleActive: jest.fn().mockResolvedValue(true),
    actionKeyForCreate: jest.fn().mockReturnValue('create'),
    actionKeyForUpdate: jest
      .fn()
      .mockImplementation((id: string) => `update:${id}`),
    actionKeyForToggle: jest
      .fn()
      .mockImplementation((id: string) => `toggle:${id}`),
  };

  const facilityContextMock = {
    facilities: signal([{ id: 'facility-1', name: 'Court A' }]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  const authStoreMock = {
    user: signal({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Owner',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoCodesComponent, TranslateModule.forRoot()],
      providers: [
        { provide: PromoCodesStore, useValue: promoStoreMock },
        { provide: FacilityContextStore, useValue: facilityContextMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PromoCodesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates and triggers initial load', () => {
    expect(component).toBeTruthy();
    expect(promoStoreMock.load).toHaveBeenCalled();
    expect(facilityContextMock.initialize).toHaveBeenCalled();
  });

  it('renders promo rows', () => {
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('SAVE10');
  });

  it('applies filters and reloads data', async () => {
    component.selectedFacilityId.set('facility-1');
    component.selectedIsActive.set('true');
    component.includeExpired.set(true);
    component.pageSize.set(50);

    await component.applyFilters();

    expect(promoStoreMock.setFilters).toHaveBeenCalledWith({
      facilityId: 'facility-1',
      isActive: true,
      includeExpired: true,
      pageSize: 50,
      page: 1,
    });
    expect(promoStoreMock.load).toHaveBeenCalled();
  });

  it('submits create payload with uppercase normalized code', async () => {
    promoStoreMock.modal.set({
      isOpen: true,
      mode: 'create',
      editingPromoId: null,
    });
    component.promoForm.patchValue({
      code: 'save20',
      discountType: PromoDiscountType.PERCENTAGE,
      discountValue: 20,
      facilityScope: PromoFacilityScope.ALL_FACILITIES,
      maxUses: 25,
      expiresAt: '',
      isActive: true,
    });

    await component.submitModal();

    expect(promoStoreMock.createPromo).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SAVE20',
        discountType: PromoDiscountType.PERCENTAGE,
        discountValue: 20,
        facilityScope: PromoFacilityScope.ALL_FACILITIES,
      })
    );
  });

  it('opens toggle confirmation and executes toggle action', async () => {
    component.openToggleDialog(promoItem);
    await component.confirmToggle();

    expect(promoStoreMock.toggleActive).toHaveBeenCalledWith(promoItem, false);
  });
});
