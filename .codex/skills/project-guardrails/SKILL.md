---
name: project-guardrails
description: >
  Khana-specific implementation rules: multi-tenancy enforcement, TypeORM patterns,
  booking engine usage, Angular SignalStore conventions, and entity design.
  Load automatically when writing any NestJS service, Angular store, or TypeORM entity.
---

# Khana Project Guardrails

This skill contains the deep implementation rules for the Khana codebase.
Architecture overview and commands are in `CLAUDE.md` (always loaded).
This skill covers **gotchas, enforcement patterns, and rules** that prevent recurring bugs.

For code examples, see [patterns.md](patterns.md).

---

## 1. Multi-Tenancy Enforcement (Backend)

Every service method that accesses data **must** validate the tenant before querying.

**Rule:** Call `this.requireTenantId(tenantId)` as the first line of any public service method.
Never skip this, even when `tenantId` comes from a JWT — always validate it is non-empty.

**FK column pattern:** The tenant relation is a FK column, not a joined `@ManyToOne` in every query.
Use `facility.tenantId = :tenantId` directly in query builders (no `@JoinColumn` needed for reads).

**Never expose cross-tenant data.** Every `findOne` / `find` / `createQueryBuilder` must include a `tenantId` condition.

See `patterns.md §1` for the `requireTenantId` implementation and query builder examples.

---

## 2. Raw SQL Numbers Come Back as Strings

TypeORM raw query results (`.getRawMany()`, `.getRawOne()`, aggregate columns) return numeric columns as **strings**, not numbers.

**Rule:** Always cast with `Number()` immediately:

```ts
const total = Number(raw.total_revenue); // NOT raw.total_revenue directly
```

This applies to: SUM, COUNT, AVG, and any column aliased in a raw select.

---

## 3. Side Effects Are Fire-and-Forget

Email sends, waitlist notifications, audit logs, and goal tracking are **side effects** — never `await` them in the main service flow.

**Pattern:**

```ts
this.emailService.sendConfirmation(booking).catch((err) => this.appLogger.error(LOG_EVENTS.EMAIL_FAILED, 'Email send failed', { bookingId: booking.id }, err));
```

**Never** let a side-effect failure throw and roll back the booking transaction.

---

## 4. Concurrent Booking: Pessimistic Lock in Transaction

Use `setLock('pessimistic_write')` inside a `manager.transaction()` when creating bookings.
This prevents two concurrent requests from double-booking the same slot.

Call `detectConflicts()` from `@khana/booking-engine` **after** acquiring the lock, never before.
See `patterns.md §4` for the full transaction pattern.

---

## 5. Per-Action Loading Flags (SignalStore)

Do **not** use a single `loading: boolean` flag for components where multiple independent actions can be in flight.

Use `actionLoadingById: Record<string, boolean>` and `actionErrorsById: Record<string, string | null>`:

- `actionLoadingById[id] = true` when the action starts
- `actionLoadingById[id] = false` in `finally`
- `actionErrorsById[id] = message` on failure, `null` on success/clear

The main `loading` flag is only for initial data fetches (the whole list).

---

## 6. SignalStore: async/await vs rxMethod

| Use case                                | Pattern                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| Button click → one-shot API call        | `async method(): Promise<boolean>` + `firstValueFrom()` |
| Reactive: changes when a signal changes | `rxMethod<T>(pipe(switchMap(...)))`                     |
| In-flight deduplication needed          | `async` with `inFlightActions: Map<string, Promise<T>>` |

Do not use `rxMethod` for one-shot actions triggered by user events. Do not use `firstValueFrom` for streams that should react to signal changes.

---

## 7. In-Flight Deduplication

For actions that must not fire twice (status updates, confirmations), guard with an in-flight map:

```ts
const inFlightActions = new Map<string, Promise<boolean>>();

const existing = inFlightActions.get(id);
if (existing) return existing;

const promise = doAction(id);
inFlightActions.set(id, promise);
promise.finally(() => inFlightActions.delete(id));
return promise;
```

---

## 8. Entity Design Rules

- `@PrimaryGeneratedColumn('uuid')` — always UUID, never serial int
- `@CreateDateColumn()` / `@UpdateDateColumn()` — always include on every entity
- `@Check()` for DB-level invariants (slug format, reserved words, lowercase)
- `@Index()` with an explicit name for composite/unique indexes
- Non-null columns: use `!` assertion. Nullable columns: use `?` and `nullable: true`
- Never expose `passwordHash` or internal tokens in API responses

### 8.1 Schema History Rule

- If a TypeORM entity change is intended to become part of the repo, pair it with a migration.
- Development `synchronize` exists for disposable local iteration only; it is not the source of truth for schema history.
- If preserving local data matters, do not trust `synchronize` for enum or column-shape changes — use migrations.

---

## 9. Layout Archetypes

Routes must set `data: { contentArchetype: '...' }` in `app.routes.ts`.

| Archetype     | Max width CSS var         | When to use                   |
| ------------- | ------------------------- | ----------------------------- |
| `'form'`      | `--content-max-form`      | Single-entity forms, settings |
| `'data'`      | `--content-max-data`      | Tables, lists, grids          |
| `'immersive'` | `--content-max-immersive` | Full-width calendars          |

The layout shell reads route data to set the correct `contentMaxWidth` computed signal.

---

## 10. Adding Navigation Items

To add a nav item, two files must be updated together — missing either breaks the nav:

1. `apps/manager-dashboard/src/app/shared/navigation/dashboard-nav.ts`

   - Add the icon name to `DashboardNavIcon` union type
   - Add the entry to `DASHBOARD_NAV_ITEMS` with `labelKey`, `route`, `icon`, `roles`

2. `apps/manager-dashboard/src/app/shared/components/ui/ui-icon.component.html`
   - Add a `@case('your-icon')` block with the SVG markup

---

## Supporting Files

- [patterns.md](patterns.md) — concrete code examples for rules §1, §4, and §6 above
