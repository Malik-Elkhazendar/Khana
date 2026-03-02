# Payments

Current state (observed):

- PaymentStatus enum exists.
- Paid booking cancellation is blocked until refund flow exists.

Status:

- FUTURE. No payment gateway integration was found.

Requirements (proposed):

- Refund flow must exist before allowing cancellation of paid bookings.
- Payment provider selection must be documented before implementation.

Evidence:

- libs/shared-dtos/src/lib/enums/payment-status.enum.ts
- apps/api/src/app/bookings/bookings.service.ts (refund TODO in updateStatus)
