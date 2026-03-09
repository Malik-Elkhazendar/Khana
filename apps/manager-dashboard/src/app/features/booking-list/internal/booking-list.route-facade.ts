import { Directive, effect } from '@angular/core';
import { BookingListRouteActionsBase } from './booking-list.route-actions';

/**
 * Route-scoped facade for the booking list page. The component inherits this
 * class so the page keeps its template API while the route shell stays small.
 */
@Directive()
export class BookingListRouteFacade extends BookingListRouteActionsBase {
  constructor() {
    super();

    effect(() => {
      if (!this.facilityContext.initialized()) {
        return;
      }

      const facilityId = this.facilityContext.selectedFacilityId();
      if (!this.hasFacilitySelectionInitialized) {
        this.hasFacilitySelectionInitialized = true;
        this.store.loadBookings(facilityId);
        return;
      }

      this.store.loadBookings(facilityId);
      this.currentPage.set(1);
      this.clearSelection();
    });
  }

  ngOnInit(): void {
    this.hydrateFiltersFromQueryParams();
    this.facilityContext.initialize();
    this.loadTenantTags();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      window.clearTimeout(this.searchDebounceId);
      this.searchDebounceId = null;
    }
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  protected hydrateFiltersFromQueryParams(): void {
    const queryParamMap = this.route.snapshot.queryParamMap;
    const statusParam = queryParamMap.get('status');
    const paymentStatusParam = queryParamMap.get('paymentStatus');

    if (statusParam && this.isStatusFilter(statusParam)) {
      this.filterStatus.set(statusParam);
    }

    if (paymentStatusParam && this.isPaymentStatus(paymentStatusParam)) {
      this.filterPaymentStatus.set(paymentStatusParam);
    }

    if (
      (statusParam && this.isStatusFilter(statusParam)) ||
      (paymentStatusParam && this.isPaymentStatus(paymentStatusParam))
    ) {
      this.onFiltersChange();
    }
  }
}
