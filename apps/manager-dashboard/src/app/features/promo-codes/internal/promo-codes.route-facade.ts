import { PromoCodeItemDto } from '@khana/shared-dtos';
import {
  PromoCodesRouteState,
  DEFAULT_PAGE_SIZE,
} from './promo-codes.route-state';

/**
 * Promo-code route facade owns modal actions, filter application, and page refresh.
 */
export class PromoCodesRouteFacade extends PromoCodesRouteState {
  constructor() {
    super();
    this.facilityContext.initialize();
    void this.store.load();
    this.ensureScopeValidators();
  }

  async refresh(): Promise<void> {
    this.store.clearError();
    await this.store.load();
  }

  async applyFilters(): Promise<void> {
    this.store.setFilters({
      facilityId: this.selectedFacilityId() || null,
      isActive:
        this.selectedIsActive() === ''
          ? null
          : this.selectedIsActive() === 'true',
      includeExpired: this.includeExpired(),
      pageSize: Number(this.pageSize()),
      page: 1,
    });
    await this.store.load();
  }

  async resetFilters(): Promise<void> {
    this.selectedFacilityId.set('');
    this.selectedIsActive.set('');
    this.includeExpired.set(false);
    this.pageSize.set(DEFAULT_PAGE_SIZE);
    this.formError.set(null);

    this.store.setFilters({
      facilityId: null,
      isActive: null,
      includeExpired: false,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    await this.store.load();
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.pageCount() || page === this.page()) {
      return;
    }
    this.store.setPage(page);
    await this.store.load();
  }

  openCreateModal(): void {
    this.store.openCreateModal();
    this.resetPromoForm();
    this.formError.set(null);
  }

  onPageSizeChange(value: number | string): void {
    const parsed =
      typeof value === 'number' ? value : Number.parseInt(value, 10);
    this.pageSize.set(Number.isFinite(parsed) ? parsed : DEFAULT_PAGE_SIZE);
  }

  openEditModal(item: PromoCodeItemDto): void {
    this.store.openEditModal(item);
    this.promoForm.reset({
      code: item.code,
      discountType: item.discountType,
      discountValue: Number(item.discountValue),
      facilityScope: item.facilityScope,
      facilityId: item.facilityId ?? '',
      maxUses: item.maxUses,
      expiresAt: this.toDateTimeLocalInput(item.expiresAt),
      isActive: item.isActive,
    });
    this.ensureScopeValidators();
    this.promoForm.markAsPristine();
    this.promoForm.markAsUntouched();
    this.formError.set(null);
  }

  onFacilityScopeChange(): void {
    this.ensureScopeValidators();
    this.promoForm.controls.facilityId.markAsTouched();
  }

  closeModal(): void {
    if (this.modalBusy()) {
      return;
    }
    this.store.closeModal();
    this.formError.set(null);
  }

  async submitModal(): Promise<void> {
    this.promoForm.markAllAsTouched();
    this.formError.set(null);

    if (this.promoForm.invalid) {
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      this.formError.set('DASHBOARD.PAGES.PROMO_CODES.FORM.ERROR_INVALID_DATE');
      return;
    }

    if (this.modal().mode === 'create') {
      await this.store.createPromo(payload);
      return;
    }

    const promoId = this.modal().editingPromoId;
    if (!promoId) {
      return;
    }

    await this.store.updatePromo(promoId, payload);
  }

  openToggleDialog(item: PromoCodeItemDto): void {
    this.toggleTarget.set(item);
  }

  closeToggleDialog(): void {
    this.toggleTarget.set(null);
  }

  async confirmToggle(): Promise<void> {
    const target = this.toggleTarget();
    if (!target) {
      return;
    }
    const success = await this.store.toggleActive(target, !target.isActive);
    if (success) {
      this.toggleTarget.set(null);
    }
  }
}
