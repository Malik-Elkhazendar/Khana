import {
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import {
  BookingStatusFilter,
  BookingStatusTone,
  E164_PHONE_REGEX,
  resolveBookingPrice,
  SAUDI_PHONE_REGEX,
  SEARCH_DEBOUNCE_MS,
} from './booking-list.models';
import { BookingListRouteStateBase } from './booking-list.route-state';

export abstract class BookingListRoutePresentationBase extends BookingListRouteStateBase {
  onFacilityChange(facilityId: string): void {
    this.facilityContext.selectFacility(facilityId || null);
    this.store.loadBookings(this.getFacilityFilter());
    this.currentPage.set(1);
    this.clearSelection();
  }

  retryLoad(): void {
    this.store.loadBookings(this.getFacilityFilter());
    this.clearSelection();
  }

  retryFacilities(): void {
    this.facilityContext.refreshFacilities();
  }

  formatDate(isoString: string): string {
    return this.localeFormat.formatDate(isoString, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  formatTime(isoString: string | null | undefined): string {
    if (!isoString) {
      return '';
    }
    return this.localeFormat.formatDate(isoString, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatTimeRange(startIso: string, endIso: string): string {
    return `${this.formatTime(startIso)} - ${this.formatTime(endIso)}`;
  }

  toDialablePhone(phone: string | null | undefined): string | null {
    const compact = phone?.trim().replace(/\s+/g, '') ?? '';
    if (!compact) {
      return null;
    }

    if (this.isValidSaudiPhoneNumber(compact)) {
      return this.normalizeSaudiPhoneNumber(compact);
    }

    if (E164_PHONE_REGEX.test(compact)) {
      return compact;
    }

    return null;
  }

  phoneHref(phone: string | null | undefined): string | null {
    const dialable = this.toDialablePhone(phone);
    return dialable ? `tel:${dialable}` : null;
  }

  protected isValidSaudiPhoneNumber(phone: string): boolean {
    return SAUDI_PHONE_REGEX.test(phone);
  }

  protected normalizeSaudiPhoneNumber(phone: string): string {
    let normalized = phone;

    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    if (normalized.startsWith('00')) {
      normalized = normalized.substring(2);
    }
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    if (!normalized.startsWith('966')) {
      normalized = `966${normalized}`;
    }

    return `+${normalized}`;
  }

  statusTone(status: string): BookingStatusTone {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
      case 'NO_SHOW':
        return 'danger';
      default:
        return 'default';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED':
        return this.t('BOOKING_LIST.STATUS.CONFIRMED', 'Confirmed');
      case 'PENDING':
        return this.t('BOOKING_LIST.STATUS.PENDING', 'Pending');
      case 'CANCELLED':
        return this.t('BOOKING_LIST.STATUS.CANCELLED', 'Cancelled');
      case 'NO_SHOW':
        return this.t('BOOKING_LIST.STATUS.NO_SHOW', 'No show');
      default:
        return status;
    }
  }

  isHoldActive(booking: BookingListItemDto): boolean {
    if (booking.status !== BookingStatus.PENDING || !booking.holdUntil) {
      return false;
    }
    return new Date(booking.holdUntil).getTime() > Date.now();
  }

  bookingPrice(booking: BookingListItemDto): {
    amount: number;
    currency: string;
  } {
    return resolveBookingPrice(booking);
  }

  formatPrice(amount: number, currency: string): string {
    return this.localeFormat.formatCurrency(amount, currency);
  }

  onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this.searchDebounceId) {
      window.clearTimeout(this.searchDebounceId);
    }
    this.searchDebounceId = window.setTimeout(() => {
      this.searchTerm.set(this.searchInput());
      this.currentPage.set(1);
      this.searchDebounceId = null;
    }, SEARCH_DEBOUNCE_MS);
  }

  onFiltersChange(): void {
    this.currentPage.set(1);
    this.focusedRowIndex.set(0);
  }

  onStatusFilterChange(value: BookingStatusFilter): void {
    this.filterStatus.set(value);
    this.onFiltersChange();
  }

  onPaymentFilterChange(value: string): void {
    this.filterPaymentStatus.set(value as PaymentStatus | 'ALL');
    this.onFiltersChange();
  }

  toggleTagFilter(tag: string): void {
    this.tagFilter.update((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      return [...current, tag];
    });
    this.onFiltersChange();
  }

  clearTagFilter(): void {
    this.tagFilter.set([]);
    this.onFiltersChange();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      this.pageSize.set(parsed);
      this.currentPage.set(1);
      this.focusedRowIndex.set(0);
    }
  }

  setSort(key: 'date' | 'customer' | 'status' | 'price'): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      this.currentPage.set(1);
      this.focusedRowIndex.set(0);
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.focusedRowIndex.set(0);
  }

  getAriaSort(
    key: 'date' | 'customer' | 'status' | 'price'
  ): 'none' | 'ascending' | 'descending' {
    if (this.sortKey() !== key) {
      return 'none';
    }
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  goToPage(page: number): void {
    const total = this.totalPages();
    const next = Math.max(1, Math.min(total, page));
    this.currentPage.set(next);
    this.focusedRowIndex.set(0);
  }

  nextPage(): void {
    if (!this.hasNextPage()) {
      return;
    }
    this.goToPage(this.currentPageSafe() + 1);
  }

  previousPage(): void {
    if (!this.hasPreviousPage()) {
      return;
    }
    this.goToPage(this.currentPageSafe() - 1);
  }

  isCancellable(booking: BookingListItemDto): boolean {
    return (
      this.canCancel() &&
      booking.paymentStatus !== PaymentStatus.PAID &&
      booking.status !== BookingStatus.CANCELLED &&
      booking.status !== BookingStatus.COMPLETED &&
      booking.status !== BookingStatus.NO_SHOW
    );
  }

  isBulkMarkPayable(booking: BookingListItemDto): boolean {
    return (
      this.canMarkPaid() &&
      booking.paymentStatus !== PaymentStatus.PAID &&
      booking.status !== BookingStatus.CANCELLED
    );
  }

  text(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    return this.t(key, fallback, params);
  }

  protected t(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    this.languageService?.languageVersion();
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  abstract clearSelection(): void;
}
