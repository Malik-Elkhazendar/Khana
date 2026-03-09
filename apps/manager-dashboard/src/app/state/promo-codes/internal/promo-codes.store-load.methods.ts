import { patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../shared/services/api.service';
import { LoggerService } from '../../../shared/services/logger.service';
import {
  PromoCodesStoreStateSource,
  resolvePromoError,
  resolveRequestId,
  toPromoError,
} from './promo-codes.store.models';

export const createPromoCodesLoadMethods = (
  store: PromoCodesStoreStateSource,
  api: ApiService,
  logger: LoggerService
) => {
  let inFlightLoad: Promise<void> | null = null;

  const load = async (): Promise<void> => {
    if (inFlightLoad) {
      return inFlightLoad;
    }

    const promise = (async () => {
      patchState(store, { loading: true, error: null, errorCode: null });
      const filters = store.filters();

      try {
        const data = await firstValueFrom(
          api.listPromoCodes({
            facilityId: filters.facilityId ?? undefined,
            isActive: filters.isActive ?? undefined,
            includeExpired: filters.includeExpired,
            page: filters.page,
            pageSize: filters.pageSize,
          })
        );
        patchState(store, { data, loading: false });
      } catch (err) {
        const resolved = resolvePromoError(err);
        const requestId = resolveRequestId(err);
        const context: Record<string, unknown> = {
          filters,
        };
        if (requestId) {
          context['requestId'] = requestId;
        }

        logger.error(
          'client.promo_codes.load.failed',
          'Failed to load promo codes list',
          context,
          err
        );

        patchState(store, {
          loading: false,
          error: toPromoError(resolved.message),
          errorCode: resolved.code,
        });
      }
    })();

    inFlightLoad = promise;
    promise.finally(() => {
      inFlightLoad = null;
    });
    return promise;
  };

  return {
    load: async (): Promise<void> => {
      await load();
    },
    setFilters: (patch: Partial<ReturnType<typeof store.filters>>): void => {
      patchState(store, (state) => {
        const shouldResetPage =
          patch.facilityId !== undefined ||
          patch.isActive !== undefined ||
          patch.includeExpired !== undefined ||
          patch.pageSize !== undefined;

        return {
          filters: {
            ...state.filters,
            ...patch,
            page: patch.page ?? (shouldResetPage ? 1 : state.filters.page),
          },
        };
      });
    },
    setPage: (page: number): void => {
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          page,
        },
      }));
    },
    clearError: (): void => {
      patchState(store, {
        error: null,
        errorCode: null,
      });
    },
  };
};
