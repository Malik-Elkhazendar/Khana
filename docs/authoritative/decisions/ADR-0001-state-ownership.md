# ADR-0001 State Ownership: Store vs Component

Status: ACCEPTED

Context:

- Booking data state is managed in a signal store.
- UI state (dialogs, selection, pagination) is held in components.

Decision:

- Store owns data state (bookings, loading, error, per-item action state).
- Components own UI state (dialogs, selection, pagination, search, filters).

Consequences:

- Stores remain focused on data and side effects.
- UI state stays close to the view layer for faster iteration and testing.

Evidence:

- apps/manager-dashboard/src/app/state/bookings/booking.store.ts (BookingState, signalStore)
- apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.ts (actionDialog, selectedBooking)
- apps/manager-dashboard/src/app/features/booking-list/booking-list.component.ts (cancelDialogBooking, selection)
