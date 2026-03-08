import { patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { BookingListItemDto } from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { LoggerService } from '../../../shared/services/logger.service';
import {
  BookingStoreStateSource,
  resolveBookingError,
  resolveRequestId,
  upsertBookingDetail,
} from './booking-store.models';

export const createBookingDetailMethods = (
  store: BookingStoreStateSource,
  api: ApiService,
  logger: LoggerService
) => {
  const inFlightDetailLoads = new Map<string, Promise<void>>();
  const detailRequestVersionById = new Map<string, number>();

  return {
    loadBookingById: async (id: string): Promise<void> => {
      const bookingId = id.trim();
      if (!bookingId) return;

      const existing = inFlightDetailLoads.get(bookingId);
      if (existing) {
        await existing;
        return;
      }

      const requestVersion = (detailRequestVersionById.get(bookingId) ?? 0) + 1;
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
  };
};
