# API Versioning

Current approach (observed):

- URI versioning with /v1 prefix.

Proposed default:

- Continue using URI versioning for new endpoints.

Evidence:

- apps/api/src/app/bookings/bookings.controller.ts (Controller "v1/bookings")
- apps/manager-dashboard/src/app/shared/services/api.service.ts (v1 paths)
