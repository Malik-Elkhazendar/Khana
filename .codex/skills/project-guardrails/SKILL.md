---
name: project-guardrails
description: >
  Khana-specific implementation rules: multi-tenancy enforcement, TypeORM patterns,
  booking engine usage, Angular SignalStore conventions, and entity design.
  Load automatically when writing any NestJS service, Angular store, or TypeORM entity.
---

# Khana Project Guardrails

This skill contains the implementation rules for the Khana codebase.
Architecture overview and commands are in `CLAUDE.md`.
For concrete examples, see [patterns.md](patterns.md).

---

## 1. Multi-Tenancy Enforcement (Backend)

Every service method that accesses data must validate the tenant before querying.

**Rule:** Validate tenant context at the public entrypoint or in the first delegated
workflow before any repository or query access. In thin facade services, the root
method may delegate immediately as long as the delegated workflow calls
`requireTenantId(tenantId)` before touching data.

Never skip this, even when `tenantId` comes from a JWT.

**FK column pattern:** The tenant relation is a FK column, not a joined `@ManyToOne`
in every query. Use `facility.tenantId = :tenantId` directly in query builders.

**Never expose cross-tenant data.** Every `findOne`, `find`, or `createQueryBuilder`
must include a tenant condition.

See `patterns.md` section 1 for examples.

---

## 2. Raw SQL Numbers Come Back as Strings

TypeORM raw query results (`.getRawMany()`, `.getRawOne()`, aggregate columns)
return numeric columns as strings, not numbers.

**Rule:** Always cast with `Number()` immediately.

```ts
const total = Number(raw.total_revenue);
```

This applies to `SUM`, `COUNT`, `AVG`, and aliased numeric columns.

---

## 3. Side Effects Are Fire-and-Forget

Email sends, waitlist notifications, audit-adjacent alerts, and goal tracking are
side effects. Do not `await` them in the main workflow once the primary state
change has succeeded.

**Pattern:**

```ts
void this.emailService.sendConfirmation(booking).catch((err) => this.appLogger.error(LOG_EVENTS.EMAIL_FAILED, 'Email send failed', { bookingId: booking.id }, err));
```

Side-effect failure must never roll back the booking, waitlist, or auth flow.

---

## 4. Concurrent Booking: Pessimistic Lock in Transaction

Use `setLock('pessimistic_write')` inside a `manager.transaction()` when creating
bookings. This prevents concurrent double-booking of the same slot.

Call `detectConflicts()` from `@khana/booking-engine` only after acquiring the lock.
See `patterns.md` section 4 for the full pattern.

---

## 5. Per-Action Loading Flags (SignalStore)

Do not use a single `loading: boolean` flag when multiple actions can be in flight.

Use:

- `actionLoadingById: Record<string, boolean>`
- `actionErrorsById: Record<string, string | null>`

The main `loading` flag is only for initial data fetches.

---

## 6. SignalStore: async/await vs rxMethod

| Use case                             | Pattern                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| Button click -> one-shot API call    | `async method(): Promise<boolean>` + `firstValueFrom()` |
| Reactive updates from signal changes | `rxMethod<T>(pipe(switchMap(...)))`                     |
| In-flight deduplication needed       | `async` with `inFlightActions: Map<string, Promise<T>>` |

Do not use `rxMethod` for one-shot button actions. Do not use `firstValueFrom`
for streams that should react to signal changes.

---

## 7. In-Flight Deduplication

For actions that must not fire twice, guard with an in-flight map.

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

- Use `@PrimaryGeneratedColumn('uuid')`.
- Include `@CreateDateColumn()` and `@UpdateDateColumn()` on every entity.
- Use `@Check()` for DB-level invariants.
- Use `@Index()` with explicit names for composite and unique indexes.
- Use `!` for non-null columns and `?` plus `nullable: true` for nullable columns.
- Never expose `passwordHash` or internal tokens in API responses.

### 8.1 Schema History Rule

- Pair repo-intended entity changes with a migration.
- Do not treat `synchronize` as schema history.
- If preserving local data matters, use migrations for enum or column-shape changes.

---

## 9. Layout Archetypes

Routes must set `data: { contentArchetype: '...' }` in `app.routes.ts`.

| Archetype     | Max width CSS var         | When to use                   |
| ------------- | ------------------------- | ----------------------------- |
| `'form'`      | `--content-max-form`      | Single-entity forms, settings |
| `'data'`      | `--content-max-data`      | Tables, lists, grids          |
| `'immersive'` | `--content-max-immersive` | Full-width calendars          |

The layout shell reads route data to set the correct `contentMaxWidth`.

---

## 10. Adding Navigation Items

To add a nav item, update both:

1. `apps/manager-dashboard/src/app/shared/navigation/dashboard-nav.ts`
2. `apps/manager-dashboard/src/app/shared/components/ui/ui-icon.component.html`

Missing either file breaks the nav.

---

## 11. Code Comments and Code Documentation

Prefer self-explanatory names first. If renaming a symbol makes the intent obvious,
do that instead of adding a comment.

Use `/** ... */` only for consumer-facing documentation:

- exported classes or functions whose role is not obvious from the name
- Angular components, services, and stores that coordinate a workflow
- Nest controllers, DTO fields, and public service entrypoints when business meaning is not obvious

Use `//` only for implementation intent:

- transaction boundaries
- tenant-safety guards
- pessimistic locking or concurrency protection
- optimistic update or rollback behavior
- retry, offline, or fallback logic
- RTL, accessibility, browser, or bidi workarounds
- non-obvious cache invalidation or side-effect sequencing

Do not add comments for:

- trivial getters or setters
- obvious mapping code
- straightforward API calls
- simple template structure
- comments that only restate the symbol name or type

Place JSDoc before decorators, matching the Google TypeScript style guide.
Prefer `//` line comments over multi-line non-JSDoc block comments.
If an explanation needs more than 5-8 lines, move the deep explanation to a
nearby markdown file and keep the code comment short.

Use this placement matrix:

- Nest controllers: comment only unusual business semantics, side effects, or response behavior
- DTOs and entities: comment only fields whose business meaning or unit is not obvious
- Nest services and workflows: comment risky orchestration steps, not every branch
- Angular components: add a short class summary for large routed pages; section comments only when they improve navigation
- SignalStores: comment optimistic updates, rollback, and in-flight deduplication
- HTML: comment only rare structural landmarks or a11y and portal constraints
- SCSS: comment only hacks, RTL constraints, browser workarounds, or non-obvious layout math
- Tests: comment only non-obvious fixture setup or business invariants

## 12. Oversized Roots Need Workflow Splits

Use the file-size thresholds in `docs/current/repo-architecture.md` and
`repo-architecture/SKILL.md` when reviewing large services, stores, and
components.

Helper extraction alone is not enough if the root file still exceeds hotspot
thresholds. If the root stays oversized after moving helpers into `internal/`,
split orchestration by workflow or use case instead of adding more utility files.

---

## Supporting Files

- [patterns.md](patterns.md) - concrete examples for the rules above
- `docs/current/code-commenting.md` - human-facing commenting standard for the repo
