# Khana — Deep Pattern Examples

Supporting file for `project-guardrails/SKILL.md`. Load when you need concrete code for the rules described there.

---

## §1 · Multi-Tenancy: requireTenantId + Query Builder

```ts
// In every public service method — first line:
private requireTenantId(tenantId?: string): string {
  if (!tenantId?.trim()) {
    throw new ForbiddenException('Access denied: tenant context required');
  }
  return tenantId;
}

// Query builder — always include tenantId:
async findAll(tenantId: string): Promise<Facility[]> {
  const resolvedTenantId = this.requireTenantId(tenantId);
  return this.facilityRepository
    .createQueryBuilder('facility')
    .where('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
    .getMany();
}

// findOne — validate ownership, not just existence:
private async validateFacilityOwnership(
  facilityId: string,
  tenantId: string,
): Promise<Facility> {
  const facility = await this.facilityRepository.findOne({
    where: { id: facilityId },
    relations: { tenant: true },
  });
  if (!facility) throw new NotFoundException('Facility not found');
  if (facility.tenant.id !== tenantId) throw new ForbiddenException('Access denied');
  return facility;
}
```

---

## §4 · Pessimistic Locking Transaction Pattern

```ts
const saved = await this.bookingRepository.manager.transaction(async (manager) => {
  // 1. Lock the row to prevent concurrent double-books
  const lockedFacility = await manager.getRepository(Facility).createQueryBuilder('facility').where('facility.id = :id', { id: facilityId }).setLock('pessimistic_write').getOne();

  // 2. Detect conflicts AFTER lock
  const occupiedSlots = await manager
    .getRepository(Booking)
    .createQueryBuilder('b')
    .where('b.facilityId = :facilityId AND b.status != :cancelled', {
      facilityId,
      cancelled: BookingStatus.CANCELLED,
    })
    .getMany();

  const conflict = detectConflicts({
    facilityId,
    requestedStart: startTime,
    requestedEnd: endTime,
    occupiedSlots,
  });

  if (conflict.hasConflict) {
    throw new ConflictException({ message: 'Time slot already booked' });
  }

  // 3. Create and save inside the transaction
  const booking = manager.getRepository(Booking).create({ ...dto, tenantId });
  return manager.getRepository(Booking).save(booking);
});
```

---

## §6 · SignalStore — async vs rxMethod

```ts
// ✅ One-shot action triggered by user event — use async + firstValueFrom:
cancelBooking: async (id: string, reason: string): Promise<boolean> => {
  patchState(store, (s) => ({
    actionLoadingById: { ...s.actionLoadingById, [id]: true },
  }));
  try {
    await firstValueFrom(api.cancelBooking(id, reason));
    patchState(store, (s) => ({
      bookings: s.bookings.filter(b => b.id !== id),
    }));
    return true;
  } catch (err) {
    patchState(store, (s) => ({
      actionErrorsById: { ...s.actionErrorsById, [id]: resolveError(err) },
    }));
    return false;
  } finally {
    patchState(store, (s) => ({
      actionLoadingById: { ...s.actionLoadingById, [id]: false },
    }));
  }
},

// ✅ Reactive: reload when facility signal changes — use rxMethod:
loadBookings: rxMethod<string | null>(
  pipe(
    tap(() => patchState(store, { loading: true, error: null })),
    switchMap((facilityId) =>
      api.getBookings(facilityId ?? undefined).pipe(
        tap((bookings) => patchState(store, { bookings, loading: false })),
        catchError((err) => {
          patchState(store, { loading: false, error: resolveError(err) });
          return of([]);
        })
      )
    )
  )
),
```

---

## §8 · Entity with Check Constraints

```ts
@Entity({ name: 'facilities' })
@Index('facilities_tenant_name_unique', ['tenantId', 'name'], { unique: true })
@Check('facilities_capacity_positive_chk', `"capacity" > 0`)
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({ type: 'uuid' })
  tenantId!: string; // FK column — no @JoinColumn needed for reads

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

---

## §10 · Navigation — Two Files Must Change Together

```ts
// 1. dashboard-nav.ts — add icon to union and entry to array:
export type DashboardNavIcon = 'analytics' | 'bookings' | 'calendar' | 'new' | 'facilities' | 'promo' | 'team' | 'settings' | 'waitlist'; // ← new

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  // ... existing items ...
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.WAITLIST',
    route: '/dashboard/waitlist',
    icon: 'waitlist', // ← must match union above
    exact: true,
    roles: [UserRole.OWNER, UserRole.MANAGER],
  },
];
```

```html
<!-- 2. ui-icon.component.html — add SVG case: -->
@case('waitlist') {
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
