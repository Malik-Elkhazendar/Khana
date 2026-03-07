import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormBuilder } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  PromoCodeItemDto,
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';
import {
  ConfirmationDialogComponent,
  UiStatusBadgeComponent,
} from '../../shared/components';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { AuthStore } from '../../shared/state/auth.store';
import { FacilityContextStore } from '../../shared/state';
import { PromoCodesStore } from '../../state/promo-codes/promo-codes.store';

type PromoStateBadge = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED';

const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;
const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-promo-codes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    ConfirmationDialogComponent,
    UiStatusBadgeComponent,
  ],
  templateUrl: './promo-codes.component.html',
  styleUrl: './promo-codes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromoCodesComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  private readonly authStore = inject(AuthStore);
  private readonly facilityContext = inject(FacilityContextStore);
  readonly store = inject(PromoCodesStore);

  readonly data = this.store.data;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly filters = this.store.filters;
  readonly actionLoadingByKey = this.store.actionLoadingByKey;
  readonly actionErrorByKey = this.store.actionErrorByKey;
  readonly modal = this.store.modal;
  readonly facilities = this.facilityContext.facilities;

  readonly PromoDiscountType = PromoDiscountType;
  readonly PromoFacilityScope = PromoFacilityScope;

  readonly selectedFacilityId = signal<string>(this.filters().facilityId ?? '');
  readonly selectedIsActive = signal<'' | 'true' | 'false'>(
    this.filters().isActive === null
      ? ''
      : this.filters().isActive
      ? 'true'
      : 'false'
  );
  readonly includeExpired = signal<boolean>(this.filters().includeExpired);
  readonly pageSize = signal<number>(
    this.filters().pageSize ?? DEFAULT_PAGE_SIZE
  );
  readonly formError = signal<string | null>(null);
  readonly toggleTarget = signal<PromoCodeItemDto | null>(null);

  readonly canManage = computed(() => {
    const role = this.authStore.user()?.role;
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });

  readonly pageCount = computed(() => {
    const total = this.data()?.total ?? 0;
    const size = this.data()?.pageSize ?? this.filters().pageSize;
    return Math.max(1, Math.ceil(total / size));
  });

  readonly page = computed(() => this.data()?.page ?? this.filters().page);

  readonly modalSubmitActionKey = computed(() => {
    if (!this.modal().isOpen) {
      return '';
    }
    if (this.modal().mode === 'create') {
      return this.store.actionKeyForCreate();
    }
    const promoId = this.modal().editingPromoId;
    return promoId ? this.store.actionKeyForUpdate(promoId) : '';
  });

  readonly modalBusy = computed(() => {
    const key = this.modalSubmitActionKey();
    return key ? this.actionLoadingByKey()[key] === true : false;
  });

  readonly modalError = computed(() => {
    const key = this.modalSubmitActionKey();
    return key ? this.actionErrorByKey()[key] ?? null : null;
  });

  readonly promoForm = this.formBuilder.group({
    code: ['', [Validators.required, Validators.pattern(CODE_REGEX)]],
    discountType: [PromoDiscountType.PERCENTAGE, [Validators.required]],
    discountValue: [10, [Validators.required, Validators.min(0.01)]],
    facilityScope: [PromoFacilityScope.ALL_FACILITIES, [Validators.required]],
    facilityId: [''],
    maxUses: [null as number | null, [Validators.min(1)]],
    expiresAt: [''],
    isActive: [true],
  });

  constructor() {
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

  isTogglePending(item: PromoCodeItemDto): boolean {
    const key = this.store.actionKeyForToggle(item.id);
    return this.actionLoadingByKey()[key] === true;
  }

  toggleError(item: PromoCodeItemDto): string | null {
    const key = this.store.actionKeyForToggle(item.id);
    return this.actionErrorByKey()[key] ?? null;
  }

  stateBadge(item: PromoCodeItemDto): PromoStateBadge {
    if (item.isExpired) return 'EXPIRED';
    if (item.isExhausted) return 'EXHAUSTED';
    return item.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  stateTone(item: PromoCodeItemDto): 'success' | 'warning' | 'neutral' {
    const badge = this.stateBadge(item);
    if (badge === 'ACTIVE') return 'success';
    if (badge === 'EXHAUSTED' || badge === 'EXPIRED') return 'warning';
    return 'neutral';
  }

  formatDiscount(item: PromoCodeItemDto): string {
    if (item.discountType === PromoDiscountType.PERCENTAGE) {
      return `${this.formatNumber(item.discountValue, 2)}%`;
    }
    return this.localeFormat.formatCurrency(Number(item.discountValue), 'SAR', {
      maximumFractionDigits: 2,
    });
  }

  formatScope(item: PromoCodeItemDto): string {
    if (item.facilityScope === PromoFacilityScope.ALL_FACILITIES) {
      return this.text('DASHBOARD.PAGES.PROMO_CODES.SCOPE.ALL_FACILITIES');
    }
    const facilityName = this.facilities().find(
      (facility) => facility.id === item.facilityId
    )?.name;
    return (
      facilityName ??
      this.text('DASHBOARD.PAGES.PROMO_CODES.SCOPE.SINGLE_FACILITY')
    );
  }

  formatDateTime(value: string | null): string {
    if (!value) {
      return this.text('DASHBOARD.PAGES.PROMO_CODES.TABLE.NOT_SET');
    }
    return this.localeFormat.formatDate(value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  usageValue(item: PromoCodeItemDto): string {
    return this.text('DASHBOARD.PAGES.PROMO_CODES.TABLE.USAGE_VALUE', {
      current: this.formatNumber(item.currentUses),
      remaining:
        item.remainingUses === null
          ? this.text('DASHBOARD.PAGES.PROMO_CODES.TABLE.UNLIMITED')
          : this.formatNumber(item.remainingUses),
      max:
        item.maxUses === null
          ? this.text('DASHBOARD.PAGES.PROMO_CODES.TABLE.UNLIMITED')
          : this.formatNumber(item.maxUses),
    });
  }

  formatNumber(value: number, maxFractionDigits = 0): string {
    const locale = this.localeFormat.getCurrentLocale();
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits,
    }).format(value);
  }

  text(key: string, params?: Record<string, unknown>): string {
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : key;
  }

  trackByPromoId(_: number, item: PromoCodeItemDto): string {
    return item.id;
  }

  private ensureScopeValidators(): void {
    const scope = this.promoForm.controls.facilityScope.value;
    if (scope === PromoFacilityScope.SINGLE_FACILITY) {
      this.promoForm.controls.facilityId.setValidators([Validators.required]);
    } else {
      this.promoForm.controls.facilityId.clearValidators();
      this.promoForm.controls.facilityId.setValue('');
    }
    this.promoForm.controls.facilityId.updateValueAndValidity({
      emitEvent: false,
    });
  }

  private resetPromoForm(): void {
    this.promoForm.reset({
      code: '',
      discountType: PromoDiscountType.PERCENTAGE,
      discountValue: 10,
      facilityScope: PromoFacilityScope.ALL_FACILITIES,
      facilityId: '',
      maxUses: null,
      expiresAt: '',
      isActive: true,
    });
    this.ensureScopeValidators();
    this.promoForm.markAsPristine();
    this.promoForm.markAsUntouched();
  }

  private buildPayload() {
    this.ensureScopeValidators();
    const value = this.promoForm.getRawValue();
    const expiresAtIso = this.normalizeExpiresAt(value.expiresAt ?? '');
    if (value.expiresAt && !expiresAtIso) {
      return null;
    }

    const maxUsesValue =
      value.maxUses === null ||
      value.maxUses === undefined ||
      value.maxUses === 0
        ? null
        : Number(value.maxUses);

    return {
      code: (value.code ?? '').trim().toUpperCase(),
      discountType: value.discountType ?? PromoDiscountType.PERCENTAGE,
      discountValue: Number(value.discountValue ?? 0),
      facilityScope: value.facilityScope ?? PromoFacilityScope.ALL_FACILITIES,
      facilityId:
        value.facilityScope === PromoFacilityScope.SINGLE_FACILITY
          ? (value.facilityId ?? '').trim() || null
          : null,
      maxUses: maxUsesValue,
      expiresAt: expiresAtIso,
      isActive: Boolean(value.isActive),
    };
  }

  private normalizeExpiresAt(value: string): string | null {
    if (!value.trim()) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  private toDateTimeLocalInput(value: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
