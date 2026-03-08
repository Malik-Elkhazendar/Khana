import { inject } from '@angular/core';
import { signalStore, withMethods, withState } from '@ngrx/signals';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { createBookingDetailMethods } from './internal/booking-store-detail.methods';
import { createBookingLoadMethods } from './internal/booking-store-load.methods';
import {
  BookingStoreStateSource,
  initialBookingState,
} from './internal/booking-store.models';
import { createBookingStatusMethods } from './internal/booking-store-status.methods';

export const BookingStore = signalStore(
  { providedIn: 'root' },
  withState(initialBookingState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) =>
      createBookingStatusMethods(store as BookingStoreStateSource, api, logger)
  ),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) =>
      createBookingDetailMethods(store as BookingStoreStateSource, api, logger)
  ),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) =>
      createBookingLoadMethods(store as BookingStoreStateSource, api, logger)
  )
);
