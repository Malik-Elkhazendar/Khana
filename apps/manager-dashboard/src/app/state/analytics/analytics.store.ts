import { inject } from '@angular/core';
import { signalStore, withMethods, withState } from '@ngrx/signals';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { createInitialAnalyticsState } from './internal/analytics-store-date';
import { createAnalyticsStoreMethods } from './internal/analytics-store.methods';
import {
  AnalyticsStoreStateSource,
  RangePreset,
} from './internal/analytics-store.models';

export type { RangePreset };

/**
 * Route-facing analytics store root.
 * Internal modules own date-range helpers and the combined dashboard load workflow.
 */
export const AnalyticsStore = signalStore(
  { providedIn: 'root' },
  withState(createInitialAnalyticsState()),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) =>
      createAnalyticsStoreMethods(
        store as AnalyticsStoreStateSource,
        api,
        logger
      )
  )
);
