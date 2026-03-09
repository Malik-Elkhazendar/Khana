import { inject } from '@angular/core';
import { signalStore, withMethods, withState } from '@ngrx/signals';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { createPromoCodesLoadMethods } from './internal/promo-codes.store-load.methods';
import { createPromoCodesMutationMethods } from './internal/promo-codes.store-mutation.methods';
import {
  initialPromoCodesState,
  PromoCodesStoreStateSource,
} from './internal/promo-codes.store.models';

/**
 * Promo-code store root.
 * Internal modules own list loading and mutation orchestration so the public store stays declarative.
 */
export const PromoCodesStore = signalStore(
  { providedIn: 'root' },
  withState(initialPromoCodesState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) =>
      createPromoCodesLoadMethods(
        store as PromoCodesStoreStateSource,
        api,
        logger
      )
  ),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) =>
      createPromoCodesMutationMethods(
        store as PromoCodesStoreStateSource,
        api,
        logger
      )
  )
);
