import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { FacilityListItemDto } from '@khana/shared-dtos';
import { ApiService } from '../services/api.service';
import { LoggerService } from '../services/logger.service';

type FacilityContextState = {
  facilities: FacilityListItemDto[];
  selectedFacilityId: string | null;
  loading: boolean;
  error: Error | null;
  initialized: boolean;
};

const FACILITY_CONTEXT_KEY = 'khana_dashboard_facility_id';

const initialState: FacilityContextState = {
  facilities: [],
  selectedFacilityId: null,
  loading: false,
  error: null,
  initialized: false,
};

function readPersistedFacilityId(): string | null {
  try {
    const value = sessionStorage.getItem(FACILITY_CONTEXT_KEY)?.trim() ?? '';
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function persistFacilityId(facilityId: string | null): void {
  try {
    if (!facilityId) {
      sessionStorage.removeItem(FACILITY_CONTEXT_KEY);
      return;
    }
    sessionStorage.setItem(FACILITY_CONTEXT_KEY, facilityId);
  } catch {
    // Ignore storage failures so state stays in-memory.
  }
}

export const FacilityContextStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) => ({
      initialize(): void {
        if (store.initialized() || store.loading()) {
          return;
        }
        this.refreshFacilities();
      },

      refreshFacilities(): void {
        patchState(store, {
          loading: true,
          error: null,
        });

        api.getFacilities().subscribe({
          next: (facilities) => {
            const persisted = readPersistedFacilityId();
            const persistedValid =
              persisted != null &&
              facilities.some((facility) => facility.id === persisted);
            const selectedFacilityId = persistedValid
              ? persisted
              : facilities[0]?.id ?? null;

            if (persisted && !persistedValid) {
              logger.warn(
                'client.facility_context.selection.invalid',
                'Persisted facility selection is no longer valid',
                { persistedFacilityId: persisted }
              );
            }

            persistFacilityId(selectedFacilityId);
            patchState(store, {
              facilities,
              selectedFacilityId,
              loading: false,
              error: null,
              initialized: true,
            });
          },
          error: (error) => {
            logger.error(
              'client.facility_context.load.failed',
              'Failed to load facility context',
              undefined,
              error
            );

            patchState(store, {
              loading: false,
              error:
                error instanceof Error
                  ? error
                  : new Error('Failed to load facilities'),
              initialized: true,
            });
          },
        });
      },

      selectFacility(id: string | null): void {
        const normalizedId = id?.trim() ?? '';
        const selectedFacilityId =
          normalizedId.length > 0 ? normalizedId : null;
        const exists =
          selectedFacilityId == null
            ? false
            : store
                .facilities()
                .some((facility) => facility.id === selectedFacilityId);

        if (selectedFacilityId && !exists) {
          logger.warn(
            'client.facility_context.selection.invalid',
            'Attempted to select unavailable facility',
            { selectedFacilityId }
          );
        }

        const resolvedSelection =
          selectedFacilityId && exists
            ? selectedFacilityId
            : store.facilities()[0]?.id ?? null;

        persistFacilityId(resolvedSelection);
        patchState(store, {
          selectedFacilityId: resolvedSelection,
        });
      },

      clearError(): void {
        patchState(store, { error: null });
      },

      reset(): void {
        persistFacilityId(null);
        patchState(store, {
          facilities: [],
          selectedFacilityId: null,
          loading: false,
          error: null,
          initialized: false,
        });
      },
    })
  )
);
