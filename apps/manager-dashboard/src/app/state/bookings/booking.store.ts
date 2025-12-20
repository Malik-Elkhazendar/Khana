import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject } from '@angular/core';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { BookingStatus, PaymentStatus, BookingListItemDto } from '@khana/shared-dtos';

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
  withMethods((store, api = inject(ApiService)) => ({
    setFacilityFilter: (facilityId: string | null) => {
        patchState(store, { filter: { facilityId } });
    },
    loadBookings: rxMethod<string | null>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((facilityId) =>
          api.getBookings(facilityId ?? undefined).pipe(
            tap((bookings) => patchState(store, { bookings, loading: false })),
            catchError((err) => {
              patchState(store, { loading: false, error: 'Failed to load bookings' });
              console.error(err);
              return of([]);
            })
          )
        )
      )
    ),
    updateStatus: rxMethod<{ id: string; status?: BookingStatus; paymentStatus?: PaymentStatus; previousBooking: BookingListItemDto }>(
      pipe(
        tap(({ id, status, paymentStatus }) => {
          patchState(store, (state) => ({
            bookings: state.bookings.map((b) =>
              b.id === id
                ? { ...b, status: status ?? b.status, paymentStatus: paymentStatus ?? b.paymentStatus }
                : b
            ),
          }));
        }),
        switchMap(({ id, status, paymentStatus, previousBooking }) =>
          api.updateBookingStatus(id, status, paymentStatus).pipe(
            tap((updatedBooking) => {
                 patchState(store, (state) => ({
                    bookings: state.bookings.map(b => b.id === id ? updatedBooking : b)
                 }));
            }),
            catchError((err) => {
              console.error('Update failed, rolling back', err);
              patchState(store, (state) => ({
                bookings: state.bookings.map((b) => (b.id === id ? previousBooking : b)),
                error: 'Failed to update status',
              }));
              return of(null);
            })
          )
        )
      )
    ),
  }))
);
