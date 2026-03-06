import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { pipe, tap, switchMap, catchError, of, firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import {
  BookingCancellationScope,
  BookingStatus,
  PaymentStatus,
  BookingListItemDto,
} from '@khana/shared-dtos';

type BookingState = {
  bookings: BookingListItemDto[];
  bookingDetailsById: Record<string, BookingListItemDto>;
  loading: boolean;
  error: Error | null;
  errorCode: string | null;
  filter: { facilityId: string | null };
  actionLoadingById: Record<string, boolean>;
  actionErrorsById: Record<string, string | null>;
  detailLoadingById: Record<string, boolean>;
  detailErrorsById: Record<string, string | null>;
};

const initialState: BookingState = {
  bookings: [],
  bookingDetailsById: {},
  loading: false,
  error: null,
  errorCode: null,
  filter: { facilityId: null },
  actionLoadingById: {},
  actionErrorsById: {},
  detailLoadingById: {},
  detailErrorsById: {},
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

const resolveRequestId = (err: unknown): string | undefined => {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  return err.headers?.get('x-request-id') ?? undefined;
};

const isAuthSensitiveError = (err: unknown): boolean => {
  return err instanceof HttpErrorResponse && [401, 403].includes(err.status);
};

export const BookingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) => {
      const inFlightActions = new Map<string, Promise<boolean>>();
      const inFlightDetailLoads = new Map<string, Promise<void>>();
      const detailRequestVersionById = new Map<string, number>();

      const upsertBookingDetail = (
        details: Record<string, BookingListItemDto>,
        booking: BookingListItemDto
      ): Record<string, BookingListItemDto> => ({
        ...details,
        [booking.id]: booking,
      });

      const mergeBookingsIntoDetails = (
        details: Record<string, BookingListItemDto>,
        bookings: BookingListItemDto[]
      ): Record<string, BookingListItemDto> => {
        let next = details;
        for (const booking of bookings) {
          next = upsertBookingDetail(next, booking);
        }
        return next;
      };

      const runStatusAction = async (
        id: string,
        updates: {
          status?: BookingStatus;
          paymentStatus?: PaymentStatus;
          cancellationReason?: string | null;
          cancellationScope?: BookingCancellationScope;
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
            bookingDetailsById: state.bookingDetailsById[id]
              ? {
                  ...state.bookingDetailsById,
                  [id]: {
                    ...state.bookingDetailsById[id],
                    ...optimistic,
                    facility:
                      optimistic.facility ??
                      state.bookingDetailsById[id].facility,
                  },
                }
              : state.bookingDetailsById,
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
                trimmedReason ?? undefined,
                updates.cancellationScope
              )
            );

            if (
              updates.cancellationScope ===
              BookingCancellationScope.THIS_AND_FUTURE
            ) {
              const refreshedBookings = await firstValueFrom(
                api.getBookings(store.filter().facilityId ?? undefined)
              );
              patchState(store, (state) => ({
                bookings: refreshedBookings,
                bookingDetailsById: mergeBookingsIntoDetails(
                  state.bookingDetailsById,
                  refreshedBookings
                ),
              }));
              return true;
            }

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
              bookingDetailsById: state.bookingDetailsById[id]
                ? {
                    ...state.bookingDetailsById,
                    [id]: {
                      ...state.bookingDetailsById[id],
                      ...updated,
                      facility:
                        updated?.facility ??
                        state.bookingDetailsById[id].facility,
                    },
                  }
                : state.bookingDetailsById,
            }));
            return true;
          } catch (err) {
            const resolved = resolveBookingError(err);
            const requestId = resolveRequestId(err);
            const context: Record<string, unknown> = { bookingId: id };
            if (requestId) {
              context['requestId'] = requestId;
            }

            logger.error(
              'client.booking.status_update.rollback',
              'Update failed, rolling back optimistic booking status',
              context,
              err
            );
            patchState(store, (state) => ({
              bookings: state.bookings.map((b) =>
                b.id === id ? previousBooking : b
              ),
              bookingDetailsById: state.bookingDetailsById[id]
                ? {
                    ...state.bookingDetailsById,
                    [id]: {
                      ...state.bookingDetailsById[id],
                      ...previousBooking,
                      facility:
                        previousBooking.facility ??
                        state.bookingDetailsById[id].facility,
                    },
                  }
                : state.bookingDetailsById,
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
          return await runStatusAction(id, {
            paymentStatus: PaymentStatus.PAID,
          });
        },
        cancelBooking: async (id: string, reason: string): Promise<boolean> => {
          return await runStatusAction(id, {
            status: BookingStatus.CANCELLED,
            cancellationReason: reason,
            cancellationScope: BookingCancellationScope.SINGLE,
          });
        },
        cancelBookingWithScope: async (
          id: string,
          reason: string,
          cancellationScope: BookingCancellationScope
        ): Promise<boolean> => {
          return await runStatusAction(id, {
            status: BookingStatus.CANCELLED,
            cancellationReason: reason,
            cancellationScope,
          });
        },
        loadBookingById: async (id: string): Promise<void> => {
          const bookingId = id.trim();
          if (!bookingId) return;

          const existing = inFlightDetailLoads.get(bookingId);
          if (existing) {
            await existing;
            return;
          }

          const requestVersion =
            (detailRequestVersionById.get(bookingId) ?? 0) + 1;
          detailRequestVersionById.set(bookingId, requestVersion);

          patchState(store, (state) => ({
            detailLoadingById: {
              ...state.detailLoadingById,
              [bookingId]: true,
            },
            detailErrorsById: {
              ...state.detailErrorsById,
              [bookingId]: null,
            },
          }));

          const loadPromise = (async () => {
            try {
              const booking = await firstValueFrom(api.getBooking(bookingId));
              if (detailRequestVersionById.get(bookingId) !== requestVersion) {
                return;
              }

              patchState(store, (state) => ({
                bookings: state.bookings.some((item) => item.id === bookingId)
                  ? state.bookings.map((item) =>
                      item.id === bookingId ? { ...item, ...booking } : item
                    )
                  : state.bookings,
                bookingDetailsById: upsertBookingDetail(
                  state.bookingDetailsById,
                  booking
                ),
              }));
            } catch (err) {
              if (detailRequestVersionById.get(bookingId) !== requestVersion) {
                return;
              }

              const resolved = resolveBookingError(err);
              const requestId = resolveRequestId(err);
              const context: Record<string, unknown> = { bookingId };
              if (requestId) {
                context['requestId'] = requestId;
              }

              logger.error(
                'client.booking.detail.load.failed',
                'Failed to load booking details',
                context,
                err
              );

              patchState(store, (state) => ({
                detailErrorsById: {
                  ...state.detailErrorsById,
                  [bookingId]: resolved.message,
                },
              }));
            } finally {
              if (detailRequestVersionById.get(bookingId) === requestVersion) {
                patchState(store, (state) => ({
                  detailLoadingById: {
                    ...state.detailLoadingById,
                    [bookingId]: false,
                  },
                }));
              }
            }
          })();

          inFlightDetailLoads.set(bookingId, loadPromise);
          try {
            await loadPromise;
          } finally {
            const current = inFlightDetailLoads.get(bookingId);
            if (current === loadPromise) {
              inFlightDetailLoads.delete(bookingId);
            }
          }
        },
        getBookingDetail: (id: string): BookingListItemDto | null => {
          const bookingId = id.trim();
          if (!bookingId) return null;
          const fromDetails = store.bookingDetailsById()[bookingId];
          if (fromDetails) {
            return fromDetails;
          }
          return store.bookings().find((item) => item.id === bookingId) ?? null;
        },
        clearBookingDetailError: (id: string): void => {
          const bookingId = id.trim();
          if (!bookingId) return;
          patchState(store, (state) => ({
            detailErrorsById: {
              ...state.detailErrorsById,
              [bookingId]: null,
            },
          }));
        },
        setFacilityFilter: (facilityId: string | null) => {
          patchState(store, { filter: { facilityId } });
        },
        clearError: () => {
          patchState(store, { error: null, errorCode: null });
        },
        reset: (): void => {
          patchState(store, {
            bookings: [],
            bookingDetailsById: {},
            loading: false,
            error: null,
            errorCode: null,
            filter: { facilityId: null },
            actionLoadingById: {},
            actionErrorsById: {},
            detailLoadingById: {},
            detailErrorsById: {},
          });
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
    }
  )
);
