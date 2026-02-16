import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { pipe, tap, switchMap, catchError, of, firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import {
  BookingStatus,
  PaymentStatus,
  BookingListItemDto,
} from '@khana/shared-dtos';

type BookingState = {
  bookings: BookingListItemDto[];
  loading: boolean;
  error: Error | null;
  errorCode: string | null;
  filter: { facilityId: string | null };
  actionLoadingById: Record<string, boolean>;
  actionErrorsById: Record<string, string | null>;
};

const initialState: BookingState = {
  bookings: [],
  loading: false,
  error: null,
  errorCode: null,
  filter: { facilityId: null },
  actionLoadingById: {},
  actionErrorsById: {},
};

type BookingErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

const BOOKING_ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  NETWORK: 'Network error. Check your connection and try again.',
  VALIDATION: 'Validation failed. Please check the inputs.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. Please contact an administrator.',
  NOT_FOUND: 'Booking not found. Refresh and try again.',
  CONFLICT: 'Conflict detected. Please refresh and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN: 'Unexpected error. Please try again.',
};

const resolveBookingError = (
  err: unknown
): { code: BookingErrorCode; message: string } => {
  if (err instanceof HttpErrorResponse) {
    const statusMap: Record<number, BookingErrorCode> = {
      0: 'NETWORK',
      400: 'VALIDATION',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      500: 'SERVER_ERROR',
    };
    const fallbackCode = statusMap[err.status] ?? 'UNKNOWN';
    const serverMessage =
      typeof err.error?.message === 'string' ? err.error.message : undefined;
    const message = serverMessage ?? BOOKING_ERROR_MESSAGES[fallbackCode];
    return { code: fallbackCode, message };
  }

  return { code: 'UNKNOWN', message: BOOKING_ERROR_MESSAGES.UNKNOWN };
};

const toBookingError = (message: string): Error => {
  return new Error(message);
};

export const BookingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => {
    const inFlightActions = new Map<string, Promise<boolean>>();

    const runStatusAction = async (
      id: string,
      updates: {
        status?: BookingStatus;
        paymentStatus?: PaymentStatus;
        cancellationReason?: string | null;
      }
    ): Promise<boolean> => {
      const existing = inFlightActions.get(id);
      if (existing) {
        return existing;
      }

      const actionPromise = (async (): Promise<boolean> => {
        const booking = store.bookings().find((b) => b.id === id);

        if (!booking) {
          patchState(store, {
            error: toBookingError(BOOKING_ERROR_MESSAGES.NOT_FOUND),
            errorCode: 'NOT_FOUND',
          });
          return false;
        }

        const previousBooking = { ...booking };
        const trimmedReason = updates.cancellationReason?.trim();
        if (updates.status === BookingStatus.CANCELLED && !trimmedReason) {
          patchState(store, {
            error: toBookingError('Cancellation reason is required'),
            errorCode: 'VALIDATION',
            actionErrorsById: {
              ...store.actionErrorsById(),
              [id]: 'Cancellation reason is required',
            },
          });
          return false;
        }
        if (trimmedReason && updates.status !== BookingStatus.CANCELLED) {
          patchState(store, {
            error: toBookingError(
              'Cancellation reason is only allowed when cancelling'
            ),
            errorCode: 'VALIDATION',
            actionErrorsById: {
              ...store.actionErrorsById(),
              [id]: 'Cancellation reason is only allowed when cancelling',
            },
          });
          return false;
        }

        const optimistic = {
          ...booking,
          status: updates.status ?? booking.status,
          paymentStatus: updates.paymentStatus ?? booking.paymentStatus,
          cancellationReason:
            updates.status === BookingStatus.CANCELLED
              ? trimmedReason ?? booking.cancellationReason ?? null
              : updates.status
              ? null
              : booking.cancellationReason ?? null,
        };

        patchState(store, (state) => ({
          bookings: state.bookings.map((b) => (b.id === id ? optimistic : b)),
          error: null,
          errorCode: null,
          actionLoadingById: { ...state.actionLoadingById, [id]: true },
          actionErrorsById: { ...state.actionErrorsById, [id]: null },
        }));

        try {
          const updated = await firstValueFrom(
            api.updateBookingStatus(
              id,
              updates.status,
              updates.paymentStatus,
              trimmedReason ?? undefined
            )
          );

          patchState(store, (state) => ({
            bookings: state.bookings.map((b) =>
              b.id === id
                ? {
                    ...b,
                    status: updated?.status ?? b.status,
                    paymentStatus: updated?.paymentStatus ?? b.paymentStatus,
                    cancellationReason:
                      updated?.cancellationReason ??
                      b.cancellationReason ??
                      null,
                    updatedAt: updated?.updatedAt ?? b.updatedAt,
                  }
                : b
            ),
          }));
          return true;
        } catch (err) {
          const resolved = resolveBookingError(err);
          console.error('Update failed, rolling back', err);
          patchState(store, (state) => ({
            bookings: state.bookings.map((b) =>
              b.id === id ? previousBooking : b
            ),
            error: toBookingError(resolved.message),
            errorCode: resolved.code,
            actionErrorsById: {
              ...state.actionErrorsById,
              [id]: resolved.message,
            },
          }));
          return false;
        } finally {
          patchState(store, (state) => ({
            actionLoadingById: { ...state.actionLoadingById, [id]: false },
          }));
        }
      })();

      inFlightActions.set(id, actionPromise);
      actionPromise.finally(() => {
        inFlightActions.delete(id);
      });

      return actionPromise;
    };

    return {
      confirmBooking: async (id: string): Promise<boolean> => {
        return await runStatusAction(id, { status: BookingStatus.CONFIRMED });
      },
      markBookingPaid: async (id: string): Promise<boolean> => {
        return await runStatusAction(id, { paymentStatus: PaymentStatus.PAID });
      },
      cancelBooking: async (id: string, reason: string): Promise<boolean> => {
        return await runStatusAction(id, {
          status: BookingStatus.CANCELLED,
          cancellationReason: reason,
        });
      },
      setFacilityFilter: (facilityId: string | null) => {
        patchState(store, { filter: { facilityId } });
      },
      clearError: () => {
        patchState(store, { error: null, errorCode: null });
      },
      loadBookings: rxMethod<string | null>(
        pipe(
          tap(() =>
            patchState(store, { loading: true, error: null, errorCode: null })
          ),
          switchMap((facilityId) =>
            api.getBookings(facilityId ?? undefined).pipe(
              tap((bookings) =>
                patchState(store, { bookings, loading: false })
              ),
              catchError((err) => {
                const resolved = resolveBookingError(err);
                patchState(store, {
                  loading: false,
                  error: toBookingError(resolved.message),
                  errorCode: resolved.code,
                });
                console.error(err);
                return of([]);
              })
            )
          )
        )
      ),
    };
  })
);
