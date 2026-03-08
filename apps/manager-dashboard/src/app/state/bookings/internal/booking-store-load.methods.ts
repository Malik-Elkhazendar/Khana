import { patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { of, pipe, switchMap, tap, catchError } from 'rxjs';
import { ApiService } from '../../../shared/services/api.service';
import { LoggerService } from '../../../shared/services/logger.service';
import {
  BookingStoreStateSource,
  initialBookingState,
  isAuthSensitiveError,
  mergeBookingsIntoDetails,
  resolveBookingError,
  resolveRequestId,
  toBookingError,
} from './booking-store.models';

export const createBookingLoadMethods = (
  store: BookingStoreStateSource,
  api: ApiService,
  logger: LoggerService
) => {
  return {
    setFacilityFilter: (facilityId: string | null) => {
      patchState(store, { filter: { facilityId } });
    },
    clearError: () => {
      patchState(store, { error: null, errorCode: null });
    },
    reset: (): void => {
      patchState(store, initialBookingState);
    },
    loadBookings: rxMethod<string | null>(
      pipe(
        tap(() =>
          patchState(store, { loading: true, error: null, errorCode: null })
        ),
        switchMap((facilityId) =>
          api.getBookings(facilityId ?? undefined).pipe(
            tap((bookings) =>
              patchState(store, (state) => ({
                bookings,
                loading: false,
                bookingDetailsById: mergeBookingsIntoDetails(
                  state.bookingDetailsById,
                  bookings
                ),
              }))
            ),
            catchError((err) => {
              const resolved = resolveBookingError(err);
              const requestId = resolveRequestId(err);
              const context: Record<string, unknown> = {
                facilityId: facilityId ?? null,
              };
              if (requestId) {
                context['requestId'] = requestId;
              }

              patchState(store, {
                loading: false,
                bookings: isAuthSensitiveError(err) ? [] : store.bookings(),
                bookingDetailsById: isAuthSensitiveError(err)
                  ? {}
                  : store.bookingDetailsById(),
                error: toBookingError(resolved.message),
                errorCode: resolved.code,
              });
              logger.error(
                'client.booking.load.failed',
                'Failed to load bookings',
                context,
                err
              );
              return of([]);
            })
          )
        )
      )
    ),
  };
};
