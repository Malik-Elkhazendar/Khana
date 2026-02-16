# Frontend (Angular) Patterns

Framework:

- Angular standalone components with signals and computed state.

State usage:

- Data state and API calls live in BookingStore.
- UI state (dialogs, pagination, selection, search) lives in components.

Forms:

- Template-driven forms with ngModel for filters and inputs.

Timers and cleanup:

- Timer subscriptions use takeUntilDestroyed in HoldTimerComponent.

Testing:

- Jest is the unit test runner for manager-dashboard.

Evidence:

- apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.ts (standalone, signals)
- apps/manager-dashboard/src/app/features/booking-list/booking-list.component.ts (FormsModule, UI state)
- apps/manager-dashboard/src/app/features/booking-preview/booking-preview.component.ts (standalone, ApiService)
- apps/manager-dashboard/src/app/state/bookings/booking.store.ts (signalStore)
- apps/manager-dashboard/src/app/features/booking-calendar/hold-timer.component.ts (takeUntilDestroyed)
- apps/manager-dashboard/jest.config.cts
