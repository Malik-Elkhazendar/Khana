import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TodaySnapshotDto } from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';

type DashboardState = {
  snapshot: TodaySnapshotDto | null;
  loadingSnapshot: boolean;
  error: Error | null;
};

const initialState: DashboardState = {
  snapshot: null,
  loadingSnapshot: false,
  error: null,
};

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error('Failed to load dashboard snapshot');
};

const isAuthSensitiveError = (error: unknown): boolean => {
  return (
    error instanceof HttpErrorResponse && [401, 403].includes(error.status)
  );
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) => {
      let inFlightLoad: Promise<void> | null = null;

      return {
        reset: (): void => {
          patchState(store, {
            snapshot: null,
            loadingSnapshot: false,
            error: null,
          });
        },
        loadSnapshot: async (facilityId?: string): Promise<void> => {
          if (inFlightLoad) {
            return inFlightLoad;
          }

          const loadPromise = (async () => {
            patchState(store, {
              loadingSnapshot: true,
              error: null,
            });

            try {
              const snapshot = await firstValueFrom(
                api.getTodaySnapshot(facilityId)
              );

              patchState(store, {
                snapshot,
                loadingSnapshot: false,
              });
            } catch (error) {
              logger.error(
                'client.dashboard.snapshot.load.failed',
                'Failed to load today snapshot',
                { facilityId: facilityId ?? null },
                error
              );

              patchState(store, {
                snapshot: isAuthSensitiveError(error) ? null : store.snapshot(),
                error: toError(error),
                loadingSnapshot: false,
              });
            }
          })();

          inFlightLoad = loadPromise;
          loadPromise.finally(() => {
            inFlightLoad = null;
          });

          return loadPromise;
        },
      };
    }
  )
);
