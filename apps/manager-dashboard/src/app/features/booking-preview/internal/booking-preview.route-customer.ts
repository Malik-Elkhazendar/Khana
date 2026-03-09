import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CUSTOMER_TAG_MAX_COUNT,
  CUSTOMER_TAG_MAX_LENGTH,
} from './booking-preview.models';
import { hasNormalizedTag, normalizeTagValue } from './booking-preview.tags';
import { BookingPreviewRoutePreviewBase } from './booking-preview.route-preview';

export abstract class BookingPreviewRouteCustomerBase extends BookingPreviewRoutePreviewBase {
  onPhoneInput(value: string): void {
    this.customerPhone.set(value);

    if (this.phoneLookupTimer) {
      window.clearTimeout(this.phoneLookupTimer);
      this.phoneLookupTimer = null;
    }

    const digits = value.replace(/\D/g, '');
    if (digits.length < 10) {
      this.phoneLookupRequestId += 1;
      this.lookupLoading.set(false);
      this.matchedCustomer.set(null);
      this.tagEditMode.set(false);
      return;
    }

    const requestId = ++this.phoneLookupRequestId;
    this.lookupLoading.set(true);

    this.phoneLookupTimer = window.setTimeout(() => {
      this.phoneLookupTimer = null;
      this.api
        .lookupCustomerByPhone(value.trim())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (customer) => {
            if (requestId !== this.phoneLookupRequestId) {
              return;
            }

            this.lookupLoading.set(false);
            this.matchedCustomer.set(customer);
            this.tagEditMode.set(false);
            if (customer && this.customerName().trim() === '') {
              this.customerName.set(customer.name);
            }
          },
          error: () => {
            if (requestId !== this.phoneLookupRequestId) {
              return;
            }

            this.lookupLoading.set(false);
            this.matchedCustomer.set(null);
            this.tagEditMode.set(false);
          },
        });
    }, 400);
  }

  enterTagEditMode(): void {
    if (!this.canEditTags()) {
      return;
    }

    if (!this.matchedCustomer()) {
      return;
    }

    if (!this.tenantTagsLoaded) {
      this.api
        .getTenantTags()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (tags) => {
            this.availableTags.set(tags);
            this.tenantTagsLoaded = true;
            this.newTagInput.set('');
            this.tagEditMode.set(true);
          },
          error: () => {
            this.newTagInput.set('');
            this.tagEditMode.set(true);
          },
        });
      return;
    }

    this.newTagInput.set('');
    this.tagEditMode.set(true);
  }

  onNewTagInput(value: string): void {
    this.newTagInput.set(value.slice(0, CUSTOMER_TAG_MAX_LENGTH));
  }

  addNewTag(): void {
    if (!this.canEditTags()) {
      return;
    }

    const customer = this.matchedCustomer();
    if (!customer) {
      return;
    }

    const candidate = normalizeTagValue(this.newTagInput());
    if (!candidate) {
      return;
    }

    const currentTags = customer.tags ?? [];
    if (
      currentTags.length >= CUSTOMER_TAG_MAX_COUNT ||
      hasNormalizedTag(currentTags, candidate)
    ) {
      return;
    }

    this.persistCustomerTags(customer.id, [...currentTags, candidate]);
  }

  toggleTag(tag: string): void {
    if (!this.canEditTags()) {
      return;
    }

    const customer = this.matchedCustomer();
    if (!customer) {
      return;
    }

    const currentTags = customer.tags ?? [];
    const exists = currentTags.includes(tag);
    const nextTags = exists
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag];

    this.persistCustomerTags(customer.id, nextTags);
  }

  protected persistCustomerTags(customerId: string, nextTags: string[]): void {
    this.api
      .updateCustomerTags(customerId, nextTags)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.matchedCustomer.set(updated);
          this.newTagInput.set('');
          if (updated.tags) {
            const merged = new Set([...this.availableTags(), ...updated.tags]);
            this.availableTags.set(Array.from(merged));
          }
        },
        error: () => {
          // No-op: keep previous UI state when save fails.
        },
      });
  }
}
