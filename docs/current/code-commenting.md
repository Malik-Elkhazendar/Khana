# Code Commenting Standard

Khana uses comments to explain non-obvious intent, not to narrate obvious code.

## Policy

- Prefer better names first. If naming fixes the ambiguity, do not add a comment.
- Use `/** ... */` for consumer-facing documentation.
- Use `//` for implementation intent and workflow constraints.
- Keep comments short. If the explanation needs more than 5-8 lines, move it to nearby markdown and leave a short comment in code.
- Delete or avoid comments that only restate the symbol name, type, or the next obvious line of code.

## Placement Matrix

| File type                   | Use comments for                                                                                | Avoid comments for                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| Nest controllers            | unusual business semantics, side effects, non-obvious response shape                            | every endpoint by default            |
| DTOs and entities           | business meaning, units, examples, non-obvious constraints                                      | every property                       |
| Nest services and workflows | transactions, locks, tenant guards, fallback order, side-effect sequencing                      | simple repository calls              |
| Angular components          | routed-page summary, large section landmarks, template-called methods with non-obvious behavior | every computed or event handler      |
| SignalStores                | optimistic updates, rollback, in-flight deduplication, cache invalidation                       | basic patchState calls               |
| HTML templates              | rare structural landmarks, accessibility notes, portal or sticky layout constraints             | every section or div                 |
| SCSS                        | hacks, RTL constraints, browser workarounds, non-obvious layout math                            | normal token usage                   |
| Tests                       | business invariants, non-obvious fixture setup                                                  | routine arrange-act-assert narration |

## Preferred Patterns

### JSDoc for workflow entrypoints

```ts
/**
 * Resolves the tenant profile used by the dashboard shell.
 * Keep the payload small because guards and interceptors call it often.
 */
getTenantContext(...)
```

### Inline comments for risky orchestration

```ts
// Lock before conflict detection so concurrent requests cannot both claim the slot.
const lockedFacility = await ...
```

```ts
// Reuse one in-flight tenant lookup so guards and interceptors do not stampede /tenant.
private tenantContextRequest$?: Observable<string>;
```

## Good / Bad / Unnecessary

```ts
// Bad: sets loading to true
this.loading.set(true);
```

```ts
// Good: keep both list and detail views in sync while the optimistic update is pending.
patchState(store, ...)
```

```ts
// Unnecessary: trims the value
const normalized = value.trim();
```

## Local Reference Files

Use these as local examples of helpful, non-noisy comments:

- `apps/manager-dashboard/src/app/features/booking-list/booking-list.component.ts`
- `apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.ts`

High-risk workflow files should have enough comments that a new engineer can answer:

- Why is this transaction or lock here?
- Why is this side effect queued instead of awaited?
- Why does this fallback order exist?
- Why does this optimistic update need rollback or deduplication?
