import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
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
  error: string | null;
  filter: { facilityId: string | null };
};

const initialState: BookingState = {
  bookings: [],
  loading: false,
  error: null,
  filter: { facilityId: null },
};

export const BookingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => {
    const runStatusAction = async (
      id: string,
      updates: { status?: BookingStatus; paymentStatus?: PaymentStatus }
    ): Promise<boolean> => {
      const booking = store.bookings().find((b) => b.id === id);

      if (!booking) {
        patchState(store, { error: 'Booking not found' });
        return false;
      }

      const previousBooking = { ...booking };
      const optimistic = {
        ...booking,
        status: updates.status ?? booking.status,
        paymentStatus: updates.paymentStatus ?? booking.paymentStatus,
      };

      patchState(store, (state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? optimistic : b)),
        error: null,
      }));

      try {
        const updated = await firstValueFrom(
          api.updateBookingStatus(id, updates.status, updates.paymentStatus)
        );

        patchState(store, (state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: updated?.status ?? b.status,
                  paymentStatus: updated?.paymentStatus ?? b.paymentStatus,
                  updatedAt: updated?.updatedAt ?? b.updatedAt,
                }
              : b
          ),
        }));
        return true;
      } catch (err) {
        console.error('Update failed, rolling back', err);
        patchState(store, (state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? previousBooking : b
          ),
          error: 'Failed to update status',
        }));
        return false;
      }
    };

    return {
      confirmBooking: async (id: string): Promise<boolean> => {
        return await runStatusAction(id, { status: BookingStatus.CONFIRMED });
      },
      markBookingPaid: async (id: string): Promise<boolean> => {
        return await runStatusAction(id, { paymentStatus: PaymentStatus.PAID });
      },
      cancelBooking: async (id: string): Promise<boolean> => {
        return await runStatusAction(id, { status: BookingStatus.CANCELLED });
      },
      setFacilityFilter: (facilityId: string | null) => {
        patchState(store, { filter: { facilityId } });
      },
      loadBookings: rxMethod<string | null>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((facilityId) =>
            api.getBookings(facilityId ?? undefined).pipe(
              tap((bookings) =>
                patchState(store, { bookings, loading: false })
              ),
              catchError((err) => {
                patchState(store, {
                  loading: false,
                  error: 'Failed to load bookings',
                });
                console.error(err);
                return of([]);
              })
            )
          )
        )
      ),
      updateStatus: rxMethod<{
        id: string;
        status?: BookingStatus;
        paymentStatus?: PaymentStatus;
        previousBooking: BookingListItemDto;
      }>(
        pipe(
          tap(({ id, status, paymentStatus }) => {
            patchState(store, (state) => ({
              bookings: state.bookings.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      status: status ?? b.status,
                      paymentStatus: paymentStatus ?? b.paymentStatus,
                    }
                  : b
              ),
            }));
          }),
          switchMap(({ id, status, paymentStatus, previousBooking }) =>
            api.updateBookingStatus(id, status, paymentStatus).pipe(
              tap((updatedBooking) => {
                patchState(store, (state) => ({
                  bookings: state.bookings.map((b) =>
                    b.id === id ? updatedBooking : b
                  ),
                }));
              }),
              catchError((err) => {
                console.error('Update failed, rolling back', err);
                patchState(store, (state) => ({
                  bookings: state.bookings.map((b) =>
                    b.id === id ? previousBooking : b
                  ),
                  error: 'Failed to update status',
                }));
                return of(null);
              })
            )
          )
        )
      ),
    };
  })
);
