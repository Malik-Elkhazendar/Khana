# Khana - Deep Pattern Examples

Supporting file for `project-guardrails/SKILL.md`. Load when you need concrete
code for the rules described there.

---

## Section 1 - Multi-Tenancy: requireTenantId + Query Builder

```ts
private requireTenantId(tenantId?: string): string {
  if (!tenantId?.trim()) {
    throw new ForbiddenException('Access denied: tenant context required');
  }
  return tenantId;
}

async findAll(tenantId: string): Promise<Facility[]> {
  const resolvedTenantId = this.requireTenantId(tenantId);

  return this.facilityRepository
    .createQueryBuilder('facility')
    .where('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
    .getMany();
}

private async validateFacilityOwnership(
  facilityId: string,
  tenantId: string
): Promise<Facility> {
  const facility = await this.facilityRepository.findOne({
    where: { id: facilityId },
    relations: { tenant: true },
  });

  if (!facility) throw new NotFoundException('Facility not found');
  if (facility.tenant.id !== tenantId) {
    throw new ForbiddenException('Access denied');
  }

  return facility;
}
```

---

## Section 3 - Fire-and-Forget Side Effects

```ts
await waitlistRepo.save(entry);

// Queue outbound delivery after the state transition commits.
void this.emailService.sendWaitlistSlotAvailableEmail(payload).catch((error) => {
  this.appLogger.error(LOG_EVENTS.WAITLIST_NOTIFY_FAILED, 'Failed to dispatch waitlist slot available email', { entryId: entry.id }, error);
});
```

---

## Section 4 - Pessimistic Locking Transaction Pattern

```ts
const saved = await this.bookingRepository.manager.transaction(async (manager) => {
  // Lock the facility row before conflict detection so concurrent requests
  // cannot both observe the slot as free.
  const lockedFacility = await manager.getRepository(Facility).createQueryBuilder('facility').where('facility.id = :id', { id: facilityId }).setLock('pessimistic_write').getOne();

  const occupiedSlots = await manager.getRepository(Booking).find({
    where: { facility: { id: facilityId }, status: BookingStatus.CONFIRMED },
  });

  const conflict = detectConflicts({
    facilityId,
    requestedStart: startTime,
    requestedEnd: endTime,
    occupiedSlots,
  });

  if (conflict.hasConflict) {
    throw new ConflictException({ message: 'Time slot already booked' });
  }

  return manager.getRepository(Booking).save(manager.getRepository(Booking).create({ ...dto, tenantId }));
});
```

---

## Section 6 - SignalStore: async vs rxMethod

```ts
const inFlightActions = new Map<string, Promise<boolean>>();

const runStatusAction = async (id: string): Promise<boolean> => {
  const existing = inFlightActions.get(id);
  if (existing) {
    return existing;
  }

  const actionPromise = (async () => {
    const previous = store.bookings().find((booking) => booking.id === id);
    if (!previous) return false;

    // Optimistic patch keeps list and detail views consistent while the
    // request is in flight.
    patchState(store, (state) => ({
      bookings: state.bookings.map((booking) => (booking.id === id ? { ...booking, status: BookingStatus.CONFIRMED } : booking)),
      actionLoadingById: { ...state.actionLoadingById, [id]: true },
    }));

    try {
      await firstValueFrom(api.updateBookingStatus(id, BookingStatus.CONFIRMED));
      return true;
    } catch (error) {
      // Roll back to the pre-request snapshot if the backend rejects the update.
      patchState(store, (state) => ({
        bookings: state.bookings.map((booking) => (booking.id === id ? previous : booking)),
      }));
      return false;
    } finally {
      patchState(store, (state) => ({
        actionLoadingById: { ...state.actionLoadingById, [id]: false },
      }));
    }
  })();

  inFlightActions.set(id, actionPromise);
  actionPromise.finally(() => inFlightActions.delete(id));
  return actionPromise;
};
```

---

## Section 10 - Navigation: Two Files Must Change Together

```ts
export type DashboardNavIcon = 'analytics' | 'bookings' | 'calendar' | 'facilities' | 'promo' | 'team' | 'settings' | 'waitlist';

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.WAITLIST',
    route: '/dashboard/waitlist',
    icon: 'waitlist',
    exact: true,
    roles: [UserRole.OWNER, UserRole.MANAGER],
  },
];
```

```html
@case ('waitlist') {
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="8" y1="6" x2="21" y2="6" />
  <line x1="8" y1="12" x2="21" y2="12" />
  <line x1="8" y1="18" x2="21" y2="18" />
  <line x1="3" y1="6" x2="3.01" y2="6" />
  <line x1="3" y1="12" x2="3.01" y2="12" />
  <line x1="3" y1="18" x2="3.01" y2="18" />
</svg>
}
```

---

## Section 11 - Commenting Patterns

### Nest controller method

```ts
/**
 * Returns the current tenant profile used by the dashboard shell.
 * The response is intentionally small because guards and interceptors call it often.
 */
@Get('tenant')
getTenantContext(@TenantId() tenantId?: string) {
  return this.authService.getTenantContext(tenantId);
}
```

### DTO field

```ts
export class WaitlistStatusResponseDto {
  /**
   * Present only while the user still has an active slot-specific entry.
   * Historical entries are returned through `status` without a queue position.
   */
  queuePosition!: number | null;
}
```

### Service or workflow transaction block

```ts
return manager.transaction(async (tx) => {
  // Keep queue selection and status transition in the same transaction so
  // notify-next cannot pick two users for the same slot under concurrency.
  const entry = await tx.getRepository(WaitingListEntry)...
});
```

### SignalStore optimistic update

```ts
// Optimistically patch both list and detail state so every visible surface
// reflects the pending action before the API confirms it.
patchState(store, (state) => ({ ... }));
```

### Angular template-facing method

```ts
/**
 * Formats the trend tooltip label using the currently selected grouping.
 * Called from the template because the SVG points are rendered lazily.
 */
tooltipLabel(point: TrendPointVm): string {
  ...
}
```

### Template structural comment

```html
<!-- Sticky summary remains outside the virtualized list to keep keyboard focus stable. -->
<section class="booking-list__summary">...</section>
```

### Bad vs good

```ts
// Bad: sets loading to true
this.loading.set(true);

// Good: keep both list and detail views in sync while the optimistic update is pending.
patchState(store, ...);
```
