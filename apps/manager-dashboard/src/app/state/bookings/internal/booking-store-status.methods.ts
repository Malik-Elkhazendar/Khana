import { patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  BookingCancellationScope,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { LoggerService } from '../../../shared/services/logger.service';
import {
  BOOKING_ERROR_MESSAGES,
  BookingStatusUpdates,
  BookingStoreStateSource,
  mergeBookingsIntoDetails,
  resolveBookingError,
  resolveRequestId,
  toBookingError,
} from './booking-store.models';

export const createBookingStatusMethods = (
  store: BookingStoreStateSource,
  api: ApiService,
  logger: LoggerService
) => {
  const inFlightActions = new Map<string, Promise<boolean>>();

  const runStatusAction = async (
    id: string,
    updates: BookingStatusUpdates
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
                  optimistic.facility ?? state.bookingDetailsById[id].facility,
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
          updates.cancellationScope === BookingCancellationScope.THIS_AND_FUTURE
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
                    updated?.cancellationReason ?? b.cancellationReason ?? null,
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
                    updated?.facility ?? state.bookingDetailsById[id].facility,
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
  };
};
