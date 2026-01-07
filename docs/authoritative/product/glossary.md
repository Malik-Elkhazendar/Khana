# Glossary

Booking:
Reservation for a facility time slot or period.
Evidence: libs/shared-dtos/src/lib/dtos/booking-api.dto.ts (BookingListItemDto)

Facility:
A rentable unit (court, chalet, resort, etc.).
Evidence: libs/shared-dtos/src/lib/dtos/booking-api.dto.ts (FacilityListItemDto)

Hold:
Temporary reservation for a pending booking.
Evidence: apps/manager-dashboard/src/app/features/booking-calendar/hold-timer.component.ts

Booking status:
State of a booking (PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW).
Evidence: libs/shared-dtos/src/lib/enums/booking-status.enum.ts

Payment status:
State of payment for a booking (PENDING, PARTIALLY_PAID, PAID, REFUNDED).
Evidence: libs/shared-dtos/src/lib/enums/payment-status.enum.ts

Preview:
Non-persisted calculation of price/conflicts before booking.
Evidence: apps/api/src/app/bookings/bookings.controller.ts (preview endpoint)
