import { computed, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import {
  PromoCodeItemDto,
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { AuthStore } from '../../../shared/state/auth.store';
import { FacilityContextStore } from '../../../shared/state';
import { PromoCodesStore } from '../../../state/promo-codes/promo-codes.store';

export type PromoStateBadge = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'EXHAUSTED';

export const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Promo-code route state and presentation helpers.
 * Modal form state stays local to the page while persistence remains in PromoCodesStore.
 */
export abstract class PromoCodesRouteState {
  protected readonly formBuilder = inject(FormBuilder);
  protected readonly localeFormat = inject(LocaleFormatService);
  protected readonly translateService = inject(TranslateService, {
    optional: true,
  });
  protected readonly authStore = inject(AuthStore);
  protected readonly facilityContext = inject(FacilityContextStore);
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

  protected ensureScopeValidators(): void {
    const scope = this.promoForm.controls.facilityScope.value;
    if (scope === PromoFacilityScope.SINGLE_FACILITY) {
      this.promoForm.controls.facilityId.setValidators([Validators.required]);
    } else {
      // Clear any previously selected facility when switching back to
      // tenant-wide scope so stale ids are never submitted accidentally.
      this.promoForm.controls.facilityId.clearValidators();
      this.promoForm.controls.facilityId.setValue('');
    }
    this.promoForm.controls.facilityId.updateValueAndValidity({
      emitEvent: false,
    });
  }

  protected resetPromoForm(): void {
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

  protected buildPayload() {
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

  protected normalizeExpiresAt(value: string): string | null {
    if (!value.trim()) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  protected toDateTimeLocalInput(value: string | null): string {
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
