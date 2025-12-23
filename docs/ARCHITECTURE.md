# Khana Technical Architecture

---

# Part I: Golden Path Development Standards

> **📚 NEW: Skill-Based Documentation System**
>
> For token-efficient learning, use our **focused skill files** instead of reading this entire document:
>
> - **Master Index:** [docs/skills/INDEX.md](docs/skills/INDEX.md)
> - **Common tasks:** See "I need to..." quick reference in INDEX.md
> - **Token savings:** 90%+ reduction (read ~480 tokens instead of ~8,500)

---

## Quick Navigation to Development Skills

| Need to...              | Read This Skill                                                                                               | Tokens |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| Implement a new feature | [PATTERNS.md](docs/skills/development/PATTERNS.md) + [CONVENTIONS.md](docs/skills/development/CONVENTIONS.md) | ~1,000 |
| Fix naming issues       | [CONVENTIONS.md](docs/skills/development/CONVENTIONS.md)                                                      | ~400   |
| Pre-commit verification | [CHECKLIST.md](docs/skills/development/CHECKLIST.md)                                                          | ~320   |
| Write tests             | [TESTING.md](docs/skills/development/TESTING.md)                                                              | ~480   |
| Onboard new developer   | [ONBOARDING.md](docs/skills/development/ONBOARDING.md)                                                        | ~560   |

**vs. Reading this full file:** ~8,500 tokens

---

## Quick Reference: What Goes Where?

_This quick reference is also available in [PATTERNS.md](docs/skills/development/PATTERNS.md)_

| What                           | Where                                                | Example                     |
| ------------------------------ | ---------------------------------------------------- | --------------------------- |
| HTTP Controllers               | `apps/api/src/app/[feature]/`                        | `bookings.controller.ts`    |
| Backend Services               | `apps/api/src/app/[feature]/`                        | `bookings.service.ts`       |
| Backend DTOs (with validators) | `apps/api/src/app/[feature]/dto/`                    | `create-booking.dto.ts`     |
| TypeORM Entities               | `libs/data-access/src/lib/entities/`                 | `booking.entity.ts`         |
| Pure Domain Logic              | `libs/booking-engine/src/lib/`                       | `conflict-detector.ts`      |
| Shared DTOs/Interfaces         | `libs/shared-dtos/src/lib/dtos/`                     | `booking.dto.ts`            |
| Shared Enums                   | `libs/shared-dtos/src/lib/enums/`                    | `booking-status.enum.ts`    |
| Angular Feature Components     | `apps/manager-dashboard/src/app/features/[feature]/` | `booking-list.component.ts` |
| Global State (SignalStore)     | `apps/manager-dashboard/src/app/state/[domain]/`     | `booking.store.ts`          |
| Shared UI Components           | `apps/manager-dashboard/src/app/shared/components/`  | `status-badge/`             |
| Centralized API Service        | `apps/manager-dashboard/src/app/shared/services/`    | `api.service.ts`            |

---

## Backend Pattern (NestJS)

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CONTROLLER (Thin Layer)                                    │
│  ✓ Parse HTTP requests                                      │
│  ✓ Validate input (via DTOs + class-validator)              │
│  ✓ Return HTTP responses                                    │
│  ✗ NO business logic                                        │
│  ✗ NO direct repository access                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVICE (Orchestration Layer)                              │
│  ✓ Orchestrate domain logic                                 │
│  ✓ Call repositories                                        │
│  ✓ Transform data between layers                            │
│  ✗ NO HTTP-specific code                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN ENGINE (@khana/booking-engine)                      │
│  ✓ Pure business logic functions                            │
│  ✓ Framework-agnostic, deterministic                        │
│  ✗ NO side effects, NO I/O                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DATA-ACCESS (@khana/data-access)                           │
│  ✓ TypeORM entities only                                    │
│  ✗ NEVER import in frontend                                 │
└─────────────────────────────────────────────────────────────┘
```

### Controller Rules

```typescript
// ✅ CORRECT: Thin controller - delegates everything
@Controller('v1/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }
}

// ❌ WRONG: Business logic in controller
@Post()
createBooking(@Body() dto: CreateBookingDto) {
  const price = dto.hours * RATE;  // ← VIOLATION: Logic belongs in service
  if (price > MAX) throw new BadRequestException();
}
```

### Backend DTO Pattern

Backend DTOs use `class-validator` decorators and live in feature folders:

```typescript
// apps/api/src/app/bookings/dto/create-booking.dto.ts
import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { BookingStatus } from '@khana/shared-dtos'; // ✅ Import enums from shared

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @IsDateString()
  startTime!: string;
}
```

---

## Frontend Pattern (Angular)

### Feature Structure

```
apps/manager-dashboard/src/app/
├── features/                   # Feature modules
│   ├── booking-list/           # Smart component (page)
│   │   ├── booking-list.component.ts
│   │   ├── booking-list.component.html
│   │   └── booking-list.component.scss
│   │
│   ├── booking-preview/        # Smart component (page)
│   │   └── ...
│   │
│   └── calendar/               # Future feature
│       └── ...
│
├── shared/                     # Shared across features
│   ├── components/             # Dumb/presentational components
│   │   └── status-badge/
│   └── services/               # Centralized services
│       └── api.service.ts      # Single API client
│
└── state/                      # Global state (cross-feature)
    └── bookings/
        └── booking.store.ts    # NgRx SignalStore
```

### Smart vs Dumb Components

| Smart Components (Pages)        | Dumb Components (UI)           |
| ------------------------------- | ------------------------------ |
| Location: `features/[feature]/` | Location: `shared/components/` |
| Inject services and stores      | Receive data via `@Input()`    |
| Handle user interactions        | Emit events via `@Output()`    |
| Connect to routes               | Pure rendering only            |
| Orchestrate child components    | NO service injection           |

### State Management Pattern (NgRx SignalStore)

```typescript
// state/bookings/booking.store.ts
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { BookingDto } from '@khana/shared-dtos'; // ✅ Use shared types

export const BookingStore = signalStore(
  { providedIn: 'root' },
  withState({ bookings: [] as BookingDto[], loading: false }),
  withMethods((store, api = inject(ApiService)) => ({
    loadBookings: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(() => api.getBookings()),
        tap((bookings) => patchState(store, { bookings, loading: false }))
      )
    ),
  }))
);
```

### Store Placement Rules

| Scope                      | Location                                |
| -------------------------- | --------------------------------------- |
| **Global** (cross-feature) | `state/[domain]/`                       |
| **Feature-local**          | `features/[feature]/[feature].store.ts` |

---

## Shared Kernel (@khana/shared-dtos)

### Library Structure

```
libs/shared-dtos/src/lib/
├── dtos/                       # API contract interfaces
│   ├── booking.dto.ts
│   └── index.ts
├── enums/                      # Shared enumerations
│   ├── booking-status.enum.ts
│   └── index.ts
├── interfaces/                 # Domain interfaces
│   ├── price-breakdown.interface.ts
│   └── index.ts
└── shared-dtos.ts              # Barrel export
```

### When to Add to shared-dtos

| Add to shared-dtos ✅                | Keep local ❌                 |
| ------------------------------------ | ----------------------------- |
| Used by BOTH frontend AND backend    | Backend-only validation DTOs  |
| API response/request shapes          | Local component state types   |
| Domain enums (BookingStatus)         | UI-only types (ButtonVariant) |
| Business interfaces (PriceBreakdown) | Framework-specific types      |

---

## Naming Conventions

### Files (kebab-case)

```
booking-preview.component.ts
booking-preview.service.ts
create-booking.dto.ts
booking-status.enum.ts
price-breakdown.interface.ts
```

### Classes (PascalCase)

```typescript
export class BookingPreviewComponent {}
export class BookingsService {}
export class CreateBookingDto {}
export enum BookingStatus {}
```

### Signals (camelCase)

```typescript
selectedFacilityId = signal<string>('');
bookings = signal<BookingDto[]>([]);
loading = signal<boolean>(false);

// Computed
selectedFacility = computed(() => ...);
canSubmit = computed(() => ...);
```

### Methods

```typescript
// Event handlers: on[Event]
onSubmit(): void {}
onFacilityChange(): void {}

// Data operations: [verb][Noun]
loadBookings(): void {}
createBooking(dto: CreateBookingDto): Promise<Booking> {}

// Formatting: format[Type]
formatDate(isoString: string): string {}
formatPrice(amount: number, currency: string): string {}
```

---

## Dependency Rules

### Import Hierarchy

```
                    ┌─────────────┐
                    │   apps/     │
                    └─────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────────┐   ┌──────────────┐
    │   api    │   │  dashboard   │   │   api-e2e    │
    └──────────┘   └──────────────┘   └──────────────┘
          │               │
          │    ┌──────────┴──────────┐
          │    │                     │
          ▼    ▼                     ▼
    ┌──────────────┐           ┌──────────────┐
    │ data-access  │           │ shared-dtos  │
    └──────────────┘           └──────────────┘
          │                          ▲
          │                          │
          ▼                          │
    ┌──────────────┐                 │
    │booking-engine│─────────────────┘
    └──────────────┘
```

### Allowed Imports

| From                     | Can Import                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `apps/api`               | `@khana/booking-engine`, `@khana/data-access`, `@khana/shared-dtos` |
| `apps/manager-dashboard` | `@khana/shared-dtos`                                                |
| `libs/booking-engine`    | `@khana/shared-dtos`                                                |
| `libs/data-access`       | `@khana/shared-dtos`                                                |
| `libs/shared-dtos`       | Nothing (leaf node)                                                 |

### Forbidden Imports ❌

```typescript
// Frontend MUST NOT import data-access (entities)
import { Booking } from '@khana/data-access'; // FORBIDDEN in Angular

// Libs MUST NOT import from apps
import { BookingsService } from 'apps/api/...'; // FORBIDDEN
```

---

## Design System: Desert Night Theme

### CSS Custom Properties

```scss
:root {
  // Core palette
  --color-sand: #c2b280;
  --color-terracotta: #e07a5f;
  --color-night: #1a1a2e;
  --color-dusk: #16213e;
  --color-twilight: #0f3460;

  // Semantic tokens
  --color-primary: var(--color-terracotta);
  --color-background: var(--color-night);
  --color-surface: var(--color-dusk);
  --color-text: var(--color-sand);

  // Status colors
  --color-success: #4ade80;
  --color-warning: #fbbf24;
  --color-danger: #f87171;

  // Spacing & radius
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --radius-sm: 4px;
  --radius-md: 8px;
}
```

### Usage Rule

```scss
// ✅ CORRECT: Use CSS custom properties
.card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

// ❌ WRONG: Hardcoded values
.card {
  background: #16213e; // Should use var(--color-surface)
}
```

---

## Responsive Design & Layout Rules

### ⚠️ CRITICAL: Mobile-First Responsive Design

**ALL pages and components MUST be responsive and mobile-optimized.**

### Core Principles

1. **Mobile-First Approach**: Design for mobile (320px+) first, then enhance for larger screens
2. **Fluid Layouts**: Use flexible units (%, rem, vh, vw) instead of fixed pixels
3. **Touch-Friendly**: Minimum 44×44px tap targets for interactive elements
4. **CSS Logical Properties**: Use logical properties for RTL support (see below)

### Breakpoint System

```scss
// Standard breakpoints (align with Tailwind conventions)
$breakpoint-sm: 640px; // Small devices (landscape phones)
$breakpoint-md: 768px; // Tablets
$breakpoint-lg: 1024px; // Laptops
$breakpoint-xl: 1280px; // Desktops
$breakpoint-2xl: 1536px; // Large screens

// Usage
@media (min-width: $breakpoint-md) {
  // Tablet and above styles
}
```

### Sizing Rules

#### ✅ DO: Use CSS Custom Properties & Relative Units

```scss
// Spacing tokens (already defined)
--space-1: 0.25rem; // 4px
--space-2: 0.5rem; // 8px
--space-3: 0.75rem; // 12px
--space-4: 1rem; // 16px
--space-5: 1.25rem; // 20px
--space-6: 1.5rem; // 24px
--space-8: 2rem; // 32px
--space-10: 2.5rem; // 40px
--space-12: 3rem; // 48px

// Font sizes (use existing tokens)
--text-xs: 0.75rem; // 12px
--text-sm: 0.875rem; // 14px
--text-base: 1rem; // 16px
--text-lg: 1.125rem; // 18px
--text-xl: 1.25rem; // 20px
--text-2xl: 1.5rem; // 24px
--text-3xl: 1.875rem; // 30px

// Example usage
.component {
  padding: var(--space-4);
  font-size: var(--text-base);
  gap: var(--space-2);
}
```

#### ❌ DON'T: Hardcode Pixel Values

```scss
// ❌ WRONG
.component {
  padding: 16px;
  font-size: 14px;
  gap: 8px;
}

// ❌ WRONG: Hardcoded breakpoint values
@media (max-width: 768px) {
  font-size: 0.65rem; // Use var(--text-xs)
}
```

### Alignment & Layout Rules

#### Flexbox & Grid (Preferred for Layouts)

```scss
// ✅ CORRECT: Flexible layouts
.container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  @media (min-width: $breakpoint-md) {
    flex-direction: row;
  }
}

// ✅ CORRECT: CSS Grid for complex layouts
.calendar-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  gap: 1px;
}
```

#### CSS Logical Properties (RTL Support)

**MANDATORY for all directional properties:**

| Physical Property   | Logical Property       | Use Case       |
| ------------------- | ---------------------- | -------------- |
| `margin-left`       | `margin-inline-start`  | Start margin   |
| `margin-right`      | `margin-inline-end`    | End margin     |
| `padding-left`      | `padding-inline-start` | Start padding  |
| `padding-right`     | `padding-inline-end`   | End padding    |
| `border-left`       | `border-inline-start`  | Start border   |
| `border-right`      | `border-inline-end`    | End border     |
| `left`              | `inset-inline-start`   | Positioning    |
| `right`             | `inset-inline-end`     | Positioning    |
| `top`               | `inset-block-start`    | Positioning    |
| `bottom`            | `inset-block-end`      | Positioning    |
| `text-align: left`  | `text-align: start`    | Text alignment |
| `text-align: right` | `text-align: end`      | Text alignment |

```scss
// ✅ CORRECT: RTL-compatible
.card {
  padding-inline: var(--space-4);
  padding-block: var(--space-3);
  border-inline-start: 3px solid var(--color-primary);
  text-align: start;
}

// ❌ WRONG: Not RTL-compatible
.card {
  padding-left: 1rem;
  padding-right: 1rem;
  border-left: 3px solid var(--color-primary);
  text-align: left;
}
```

### Responsive Typography

```scss
// ✅ CORRECT: Fluid typography
.heading {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  line-height: 1.2;
}

// ✅ CORRECT: Breakpoint-based scaling
.title {
  font-size: var(--text-xl);

  @media (min-width: $breakpoint-md) {
    font-size: var(--text-2xl);
  }

  @media (min-width: $breakpoint-lg) {
    font-size: var(--text-3xl);
  }
}
```

### Touch Target Sizes

```scss
// ✅ CORRECT: Minimum 44×44px for interactive elements
.button {
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-3) var(--space-4);
}

// ✅ CORRECT: Mobile navigation
.nav-item {
  padding-block: var(--space-4);
  min-height: 48px;
}
```

### Mobile-Specific Patterns

#### Bottom Sheets & Modals

```scss
// ✅ CORRECT: Mobile-first modal
.modal {
  position: fixed;
  inset-inline: 0;
  inset-block-end: 0;
  max-height: 90vh;
  border-start-start-radius: var(--radius-xl);
  border-start-end-radius: var(--radius-xl);

  @media (min-width: $breakpoint-md) {
    inset-inline: auto;
    inset-block: auto;
    max-inline-size: 480px;
    margin: auto;
  }
}
```

#### Responsive Grid Columns

```scss
// ✅ CORRECT: Auto-responsive grid
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

// ✅ CORRECT: Breakpoint-based columns
.calendar-grid {
  grid-template-columns: 60px repeat(3, 1fr); // Mobile: 3 days

  @media (min-width: $breakpoint-md) {
    grid-template-columns: 80px repeat(7, 1fr); // Desktop: 7 days
  }
}
```

### Viewport Units & Container Queries

```scss
// ✅ CORRECT: Viewport-based spacing
.hero {
  min-height: 100vh;
  padding-block: 10vh;
}

// ✅ CORRECT: Container queries (future-ready)
@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: auto 1fr;
  }
}
```

### Color Opacity & Transparency

```scss
// ✅ CORRECT: Use color-mix for alpha transparency
.overlay {
  background: color-mix(in srgb, var(--color-background) 80%, transparent);
}

// ✅ CORRECT: CSS variable with alpha (if supported)
:root {
  --color-accent-rgb: 212, 168, 85;
}

.highlight {
  background: rgba(var(--color-accent-rgb), 0.1);
}

// ❌ WRONG: Hardcoded rgba
.overlay {
  background: rgba(20, 28, 39, 0.45); // Should use theme color
}
```

### Accessibility & Performance

```scss
// ✅ CORRECT: Prefers-reduced-motion
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

// ✅ CORRECT: High contrast mode
@media (prefers-contrast: high) {
  .button {
    border: 2px solid currentColor;
  }
}
```

### Responsive Checklist

Before marking a component complete:

- [ ] **Mobile tested** at 375px, 414px (iPhone), 360px (Android)
- [ ] **Tablet tested** at 768px, 1024px (iPad)
- [ ] **Desktop tested** at 1280px, 1920px
- [ ] **No horizontal scroll** on mobile viewports
- [ ] **Touch targets** ≥ 44×44px for all interactive elements
- [ ] **CSS logical properties** used for all directional styles
- [ ] **CSS custom properties** used for colors, spacing, sizing
- [ ] **No hardcoded pixel values** (except specific cases like borders)
- [ ] **Fluid typography** using clamp() or breakpoints
- [ ] **RTL tested** by adding `dir="rtl"` to `<html>`

---

## Pre-Commit Checklist

Before creating a new feature, verify:

- [ ] Domain logic is pure? → `@khana/booking-engine`
- [ ] Database entity? → `@khana/data-access`
- [ ] Shared type/enum? → `@khana/shared-dtos`
- [ ] HTTP handling? → `apps/api/[feature]/`
- [ ] UI component? → `apps/manager-dashboard/features/[feature]/`
- [ ] State crosses features? → Global store in `state/`
- [ ] Using CSS tokens? → Check `var(--color-*)` usage
- [ ] **Mobile responsive?** → Test at 375px, 768px, 1280px
- [ ] **CSS logical properties?** → Check for RTL support
- [ ] **No hardcoded colors/sizes?** → Use design tokens only
- [ ] **Touch targets ≥44px?** → Verify all interactive elements

---

# Part II: Technical Architecture Details

## 🏗️ System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
├─────────────────────────────────────────────────────────────┤
│  Manager Dashboard (Angular)  │  Future: Customer App       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTPS/REST
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   API Gateway (NestJS)                      │
├─────────────────────────────────────────────────────────────┤
│  Authentication │ Rate Limiting │ Request Validation        │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼──────┐    ┌───────▼──────┐    ┌──────────────┐
│   Booking    │    │   Tenant     │    │   Payment    │
│   Service    │    │   Service    │    │   Service    │
│              │    │              │    │   (Future)   │
└───────┬──────┘    └───────┬──────┘    └──────┬───────┘
        │                   │                   │
        └───────────┬───────┴───────────────────┘
                    │
┌───────────────────▼───────────────────────────────────────┐
│              PostgreSQL Database                          │
├───────────────────────────────────────────────────────────┤
│  Tenants │ Facilities │ Inventory │ Bookings │ Users     │
└───────────────────────────────────────────────────────────┘
```

---

## 📦 Nx Monorepo Structure

```
khana-workspace/
├── apps/
│   ├── api/                      # NestJS Backend API
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app/
│   │   │   │   ├── auth/         # Authentication module
│   │   │   │   ├── tenants/      # Multi-tenancy management
│   │   │   │   ├── bookings/     # Booking endpoints
│   │   │   │   └── facilities/   # Facility management
│   │   │   └── config/           # Configuration
│   │   └── test/
│   │
│   ├── manager-dashboard/        # Angular Dashboard (Owners)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/         # Core services
│   │   │   │   ├── features/     # Feature modules
│   │   │   │   │   ├── bookings/
│   │   │   │   │   ├── inventory/
│   │   │   │   │   ├── customers/
│   │   │   │   │   └── analytics/
│   │   │   │   └── shared/       # Shared components
│   │   │   └── assets/
│   │   └── project.json
│   │
│   └── customer-app/             # Future: Customer mobile app
│
├── libs/
│   ├── booking-engine/           # Core booking logic (shared)
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── conflict-detector.ts
│   │   │   │   ├── availability-calculator.ts
│   │   │   │   ├── pricing-engine.ts
│   │   │   │   └── validation-rules.ts
│   │   │   └── index.ts
│   │   └── README.md
│   │
│   ├── shared-dtos/              # Pure TypeScript DTOs (no decorators)
│   │   ├── src/
│   │   │   ├── booking.dto.ts
│   │   │   ├── facility.dto.ts
│   │   │   ├── availability.dto.ts
│   │   │   └── index.ts
│   │   └── README.md
│   │   # ⚠️ CRITICAL: Frontend-safe interfaces only
│   │   # No ORM decorators (@Entity, @Column, etc.)
│   │   # Shared between Angular apps and NestJS API
│   │
│   ├── data-access/              # Backend-only Database layer
│   │   ├── src/
│   │   │   ├── entities/
│   │   │   │   ├── tenant.entity.ts
│   │   │   │   ├── facility.entity.ts
│   │   │   │   ├── inventory-slot.entity.ts
│   │   │   │   ├── booking.entity.ts
│   │   │   │   └── user.entity.ts
│   │   │   └── repositories/
│   │   └── README.md
│   │   # ⚠️ CRITICAL: Backend use ONLY
│   │   # Contains TypeORM entities with decorators
│   │   # NEVER import this into Angular apps
│   │   # Frontend should use libs/shared-dtos instead
│   │
│   ├── payment-gateway/          # Payment integration (Phase 2)
│   │   └── src/
│   │
│   ├── ui-components/            # Shared Angular components
│   │   ├── src/
│   │   │   ├── calendar/
│   │   │   ├── booking-card/
│   │   │   └── time-selector/
│   │   └── README.md
│   │
│   └── shared-utils/             # Common utilities
│       ├── src/
│       │   ├── date-utils.ts
│       │   ├── validation.ts
│       │   └── formatters.ts
│       └── README.md
│
├── tools/                        # Custom build tools
├── nx.json                       # Nx configuration
├── package.json
└── tsconfig.base.json
```

---

## 🗄️ Database Schema

### Core Entities

#### 1. Tenant Entity

```typescript
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  subdomain: string; // e.g., 'elite-padel'

  @Column()
  name: string;

  @Column({ type: 'enum', enum: TenantType })
  type: TenantType; // SPORTS_FACILITY, CHALET, RESORT

  @Column({ type: 'jsonb', nullable: true })
  settings: TenantSettings;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Facility, (facility) => facility.tenant)
  facilities: Facility[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 2. Facility Entity

```typescript
@Entity('facilities')
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.facilities)
  tenant: Tenant;

  @Column()
  name: string; // "Court 1", "VIP Chalet"

  @Column({ type: 'enum', enum: FacilityType })
  type: FacilityType; // PADEL_COURT, FOOTBALL_FIELD, CHALET

  @Column({ type: 'jsonb' })
  metadata: FacilityMetadata; // capacity, amenities, etc.

  @OneToMany(() => InventorySlot, (slot) => slot.facility)
  inventory: InventorySlot[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
```

#### 3. Inventory Slot Entity

**⚠️ CRITICAL DESIGN DECISION:**
This entity represents **ONLY occupied time slots** (BOOKED, BLOCKED, MAINTENANCE).
**AVAILABLE slots are NEVER stored** in the database to prevent millions of unnecessary rows.

Availability is calculated in-memory by:

1. Generating possible slots from Facility operating hours
2. Subtracting existing InventorySlot records (occupied time)
3. Returning the difference as available time

```typescript
@Entity('inventory_slots')
export class InventorySlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Facility, facility => facility.inventory)
  facility: Facility;

  @Column({ type: 'enum', enum: InventoryType })
  type: InventoryType; // HOURLY, DAILY, CUSTOM

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({ type: 'enum', enum: SlotStatus })
  status: SlotStatus; // BOOKED, BLOCKED, MAINTENANCE (no AVAILABLE)

  @ManyToOne(() => Booking, { nullable: true })
  booking?: Booking; // Null if status is BLOCKED or MAINTENANCE

  @Column({ type: 'text', nullable: true })
  notes: string; // Reason for blocking, maintenance notes, etc.

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index(['facility', 'startTime', 'endTime'])
  @Index(['facility', 'status'])
}
```

**Why No Price Field?**
Pricing is calculated dynamically by the PricingEngine based on:

- Facility base price (stored in `facility.metadata`)
- Time of day multipliers
- Day of week multipliers
- Duration discounts

This allows flexible pricing without database updates.

#### 4. Booking Entity

```typescript
@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  bookingReference: string; // KH-2025-001234

  @ManyToOne(() => Facility)
  facility: Facility;

  @ManyToOne(() => Tenant)
  tenant: Tenant; // Denormalized for tenant isolation queries

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @ManyToOne(() => Customer)
  customer: Customer;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'enum', enum: BookingStatus })
  status: BookingStatus; // PENDING, CONFIRMED, CANCELLED

  @Column({ type: 'enum', enum: PaymentStatus })
  paymentStatus: PaymentStatus; // UNPAID, PAID, REFUNDED

  @Column({ type: 'jsonb', nullable: true })
  priceBreakdown: PriceBreakdown; // Stored for audit trail

  @Column({ type: 'jsonb', nullable: true })
  metadata: BookingMetadata; // notes, special requests

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index(['bookingReference'])
  @Index(['tenant', 'status', 'createdAt'])
  @Index(['facility', 'startTime', 'endTime'])
}
```

**Design Notes:**

- Booking stores its own `startTime` and `endTime` for direct queries
- When a Booking is created, an InventorySlot with `status: BOOKED` is also created
- This denormalization improves query performance and simplifies availability checks

---

## ⚙️ Core Business Logic

### 1. Conflict Detection Algorithm

**⚠️ PERFORMANCE-CRITICAL:** This algorithm queries ONLY occupied slots (BOOKED, BLOCKED, MAINTENANCE).
No AVAILABLE slots are ever stored or queried, preventing database bloat.

```typescript
// libs/booking-engine/src/lib/conflict-detector.ts

export class ConflictDetector {
  constructor(private readonly inventorySlotRepository: Repository<InventorySlot>, private readonly availabilityCalculator: AvailabilityCalculator) {}

  /**
   * Detects if a booking request conflicts with existing occupied slots
   *
   * Overlap Detection Logic:
   * Two time ranges [A_start, A_end] and [B_start, B_end] overlap if:
   * A_start < B_end AND A_end > B_start
   *
   * @returns ConflictResult with conflicts and alternative suggestions
   */
  async detectConflicts(facilityId: string, requestedStart: Date, requestedEnd: Date): Promise<ConflictResult> {
    // Query ONLY occupied slots (BOOKED, BLOCKED, MAINTENANCE)
    // Since we never store AVAILABLE slots, all returned rows are conflicts
    const occupiedSlots = await this.inventorySlotRepository.createQueryBuilder('slot').where('slot.facilityId = :facilityId', { facilityId }).andWhere('slot.startTime < :requestedEnd', { requestedEnd }).andWhere('slot.endTime > :requestedStart', { requestedStart }).getMany();

    if (occupiedSlots.length > 0) {
      return {
        hasConflict: true,
        conflictType: this.classifyConflict(occupiedSlots[0], requestedStart, requestedEnd),
        conflicts: occupiedSlots.map((slot) => ({
          slotId: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          notes: slot.notes,
        })),
        suggestedAlternatives: await this.findAlternatives(facilityId, requestedStart, requestedEnd),
      };
    }

    return {
      hasConflict: false,
      message: 'Slot is available for booking',
    };
  }

  /**
   * Classifies the type of conflict for better error messages
   */
  private classifyConflict(existingSlot: InventorySlot, requestedStart: Date, requestedEnd: Date): ConflictType {
    if (requestedStart.getTime() === existingSlot.startTime.getTime() && requestedEnd.getTime() === existingSlot.endTime.getTime()) {
      return ConflictType.EXACT_OVERLAP;
    }

    if (requestedStart >= existingSlot.startTime && requestedEnd <= existingSlot.endTime) {
      return ConflictType.CONTAINED_WITHIN;
    }

    if (requestedStart < existingSlot.startTime) {
      return ConflictType.PARTIAL_START_OVERLAP;
    }

    return ConflictType.PARTIAL_END_OVERLAP;
  }

  /**
   * Finds alternative available time slots using in-memory calculation
   *
   * Algorithm:
   * 1. Calculate requested duration
   * 2. Get availability map for ±3 hours from requested time
   * 3. Filter slots matching requested duration
   * 4. Sort by proximity to requested time
   * 5. Return top N suggestions
   */
  private async findAlternatives(facilityId: string, requestedStart: Date, requestedEnd: Date, maxSuggestions: number = 5): Promise<TimeSlot[]> {
    const requestedDuration = requestedEnd.getTime() - requestedStart.getTime();

    // Search window: ±3 hours from requested time
    const searchStart = new Date(requestedStart.getTime() - 3 * 60 * 60 * 1000);
    const searchEnd = new Date(requestedEnd.getTime() + 3 * 60 * 60 * 1000);

    // Get in-memory availability map (no database bloat!)
    const availabilityMap = await this.availabilityCalculator.calculateAvailability(
      facilityId,
      searchStart,
      searchEnd,
      InventoryType.HOURLY // TODO: Get from facility metadata
    );

    // Find slots matching requested duration
    const alternatives = availabilityMap.availableSlots
      .filter((slot) => slot.endTime.getTime() - slot.startTime.getTime() >= requestedDuration)
      .map((slot) => ({
        startTime: slot.startTime,
        endTime: new Date(slot.startTime.getTime() + requestedDuration),
        price: slot.price,
        proximity: Math.abs(slot.startTime.getTime() - requestedStart.getTime()),
      }))
      .sort((a, b) => a.proximity - b.proximity)
      .slice(0, maxSuggestions);

    return alternatives;
  }
}

/**
 * Enum for conflict classification
 */
export enum ConflictType {
  EXACT_OVERLAP = 'exact_overlap', // Requested time exactly matches existing
  CONTAINED_WITHIN = 'contained_within', // Requested time fully inside existing
  PARTIAL_START_OVERLAP = 'partial_start', // Requested start overlaps existing
  PARTIAL_END_OVERLAP = 'partial_end', // Requested end overlaps existing
}
```

### 2. Availability Calculator

**⚠️ ARCHITECTURAL PRINCIPLE:** This calculator generates availability **in-memory** by:

1. Creating all possible time slots from Facility operating hours (NOT from database)
2. Fetching ONLY occupied slots (BOOKED, BLOCKED, MAINTENANCE) from database
3. Subtracting occupied slots from generated slots
4. Returning available slots

**Result:** Zero database bloat. A facility operating 15 hours/day with 1-hour slots generates
only ~50 database rows per year (actual bookings), NOT 5,475 rows (365 days × 15 hours).

```typescript
// libs/booking-engine/src/lib/availability-calculator.ts

export class AvailabilityCalculator {
  constructor(private readonly facilityRepository: Repository<Facility>, private readonly inventorySlotRepository: Repository<InventorySlot>, private readonly pricingEngine: PricingEngine) {}

  /**
   * Calculates real-time availability for a facility using in-memory generation
   *
   * @param facilityId - Target facility UUID
   * @param startDate - Query range start
   * @param endDate - Query range end
   * @param inventoryType - HOURLY (sports) or DAILY (chalets)
   * @returns AvailabilityMap with available and occupied slots
   */
  async calculateAvailability(facilityId: string, startDate: Date, endDate: Date, inventoryType: InventoryType): Promise<AvailabilityMap> {
    const facility = await this.facilityRepository.findOne({
      where: { id: facilityId },
    });

    if (!facility) {
      throw new Error(`Facility ${facilityId} not found`);
    }

    switch (inventoryType) {
      case InventoryType.HOURLY:
        return this.calculateHourlyAvailability(facility, startDate, endDate);

      case InventoryType.DAILY:
        return this.calculateDailyAvailability(facility, startDate, endDate);

      default:
        throw new Error(`Unsupported inventory type: ${inventoryType}`);
    }
  }

  /**
   * Hourly availability for sports facilities (Padel, Football)
   *
   * Algorithm:
   * 1. Generate all possible hourly slots from facility operating hours
   * 2. Query database for occupied slots (BOOKED, BLOCKED, MAINTENANCE)
   * 3. Subtract occupied from possible slots
   * 4. Calculate dynamic pricing for each available slot
   * 5. Return availability matrix
   */
  private async calculateHourlyAvailability(facility: Facility, startDate: Date, endDate: Date): Promise<AvailabilityMap> {
    // Extract facility configuration
    const operatingHours = facility.metadata.operatingHours; // { open: '08:00', close: '23:00' }
    const slotDuration = facility.metadata.slotDuration || 60; // minutes

    // Step 1: Generate ALL possible slots in-memory (no DB query!)
    const allPossibleSlots = this.generateHourlySlots(startDate, endDate, operatingHours, slotDuration);

    // Step 2: Fetch ONLY occupied slots from database
    const occupiedSlots = await this.inventorySlotRepository.createQueryBuilder('slot').where('slot.facilityId = :facilityId', { facilityId: facility.id }).andWhere('slot.startTime >= :startDate', { startDate }).andWhere('slot.startTime < :endDate', { endDate }).getMany();

    // Step 3: Subtract occupied slots from possible slots
    const availableSlots = this.subtractOccupiedSlots(allPossibleSlots, occupiedSlots);

    // Step 4: Calculate dynamic pricing for available slots
    const slotsWithPricing = availableSlots.map((slot) => ({
      ...slot,
      price: this.pricingEngine.calculatePrice(facility, slot.startTime, slot.endTime).total,
    }));

    return {
      facilityId: facility.id,
      facilityName: facility.name,
      dateRange: { start: startDate, end: endDate },
      totalSlots: allPossibleSlots.length,
      availableSlots: slotsWithPricing,
      occupiedSlots: occupiedSlots.map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        notes: slot.notes,
      })),
      occupancyRate: (occupiedSlots.length / allPossibleSlots.length) * 100,
    };
  }

  /**
   * Generates all possible hourly time slots in-memory
   * NO DATABASE OPERATIONS - pure computation
   *
   * Example:
   * - Date: 2025-12-05
   * - Operating Hours: 08:00 - 23:00
   * - Slot Duration: 60 minutes
   * - Result: 15 slots [08:00-09:00, 09:00-10:00, ..., 22:00-23:00]
   */
  private generateHourlySlots(startDate: Date, endDate: Date, operatingHours: { open: string; close: string }, slotDuration: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const [openHour, openMinute] = operatingHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = operatingHours.close.split(':').map(Number);

    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0); // Start of day

    while (currentDate < endDate) {
      // Generate slots for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(openHour, openMinute, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(closeHour, closeMinute, 0, 0);

      let slotStart = new Date(dayStart);

      while (slotStart < dayEnd) {
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);

        if (slotEnd <= dayEnd) {
          slots.push({
            startTime: new Date(slotStart),
            endTime: new Date(slotEnd),
          });
        }

        slotStart = new Date(slotEnd);
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  /**
   * Subtracts occupied slots from possible slots
   * Pure in-memory operation using time range overlap logic
   */
  private subtractOccupiedSlots(possibleSlots: TimeSlot[], occupiedSlots: InventorySlot[]): TimeSlot[] {
    return possibleSlots.filter((possible) => {
      // Check if this possible slot overlaps with ANY occupied slot
      const hasConflict = occupiedSlots.some((occupied) => possible.startTime < occupied.endTime && possible.endTime > occupied.startTime);

      return !hasConflict; // Keep only non-conflicting slots
    });
  }

  /**
   * Daily availability for chalets/resorts
   * Similar in-memory generation but operates on day-level granularity
   *
   * Algorithm:
   * 1. Generate all possible days in date range
   * 2. Query occupied days (BOOKED, BLOCKED, MAINTENANCE)
   * 3. Subtract occupied from possible days
   * 4. Apply minimum stay requirements
   * 5. Calculate dynamic pricing
   */
  private async calculateDailyAvailability(facility: Facility, startDate: Date, endDate: Date): Promise<AvailabilityMap> {
    // Generate all possible days (in-memory)
    const allPossibleDays = this.generateDailySlots(startDate, endDate);

    // Fetch occupied days (database query)
    const occupiedDays = await this.inventorySlotRepository.createQueryBuilder('slot').where('slot.facilityId = :facilityId', { facilityId: facility.id }).andWhere('slot.startTime >= :startDate', { startDate }).andWhere('slot.startTime < :endDate', { endDate }).andWhere('slot.type = :type', { type: InventoryType.DAILY }).getMany();

    // Subtract occupied from possible
    const availableDays = this.subtractOccupiedSlots(allPossibleDays, occupiedDays);

    // Apply minimum stay requirements (e.g., 2-night minimum)
    const minStay = facility.metadata.minimumStay || 1;
    const availableStays = this.findAvailableStayRanges(availableDays, minStay);

    // Calculate pricing
    const staysWithPricing = availableStays.map((stay) => ({
      ...stay,
      price: this.pricingEngine.calculatePrice(facility, stay.startTime, stay.endTime).total,
    }));

    return {
      facilityId: facility.id,
      facilityName: facility.name,
      dateRange: { start: startDate, end: endDate },
      totalSlots: allPossibleDays.length,
      availableSlots: staysWithPricing,
      occupiedSlots: occupiedDays.map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        notes: slot.notes,
      })),
      occupancyRate: (occupiedDays.length / allPossibleDays.length) * 100,
    };
  }

  /**
   * Generates daily time slots (for chalets)
   * Pure in-memory operation
   */
  private generateDailySlots(startDate: Date, endDate: Date): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate < endDate) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      slots.push({
        startTime: dayStart,
        endTime: dayEnd,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  /**
   * Finds consecutive available days that meet minimum stay requirements
   */
  private findAvailableStayRanges(availableDays: TimeSlot[], minStay: number): TimeSlot[] {
    // Group consecutive days into stay ranges
    // Filter ranges that meet minimum stay requirement
    // Implementation details omitted for brevity
    return availableDays; // Simplified for documentation
  }
}

/**
 * Availability map response structure
 */
export interface AvailabilityMap {
  facilityId: string;
  facilityName: string;
  dateRange: { start: Date; end: Date };
  totalSlots: number;
  availableSlots: Array<TimeSlot & { price: number }>;
  occupiedSlots: Array<{
    startTime: Date;
    endTime: Date;
    status: SlotStatus;
    notes?: string;
  }>;
  occupancyRate: number; // Percentage
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}
```

### 3. Pricing Engine

```typescript
// libs/booking-engine/src/lib/pricing-engine.ts

export class PricingEngine {
  /**
   * Calculates dynamic pricing based on multiple factors
   * - Base price (from facility settings)
   * - Time of day (peak hours)
   * - Day of week (weekend premium)
   * - Seasonal adjustments
   * - Duration discounts
   */
  calculatePrice(facility: Facility, bookingStart: Date, bookingEnd: Date): PriceBreakdown {
    let basePrice = facility.metadata.basePrice;
    const duration = this.calculateDuration(bookingStart, bookingEnd);

    // Apply time-of-day multiplier
    const timeMultiplier = this.getTimeMultiplier(bookingStart);

    // Apply day-of-week multiplier
    const dayMultiplier = this.getDayMultiplier(bookingStart);

    // Apply duration discount
    const durationDiscount = this.getDurationDiscount(duration);

    const subtotal = basePrice * timeMultiplier * dayMultiplier;
    const discount = subtotal * durationDiscount;
    const total = subtotal - discount;

    return {
      basePrice,
      timeMultiplier,
      dayMultiplier,
      durationDiscount,
      subtotal,
      discount,
      total,
      currency: 'SAR',
    };
  }

  private getTimeMultiplier(time: Date): number {
    const hour = time.getHours();

    // Peak hours: 17:00-22:00 → 1.5x
    if (hour >= 17 && hour < 22) return 1.5;

    // Standard hours: 08:00-17:00 → 1.0x
    if (hour >= 8 && hour < 17) return 1.0;

    // Late night: 22:00-00:00 → 1.2x
    return 1.2;
  }

  private getDayMultiplier(date: Date): number {
    const dayOfWeek = date.getDay();

    // Weekend (Thu-Fri in MENA): 1.3x
    if (dayOfWeek === 4 || dayOfWeek === 5) return 1.3;

    // Weekday: 1.0x
    return 1.0;
  }
}
```

---

## 🔐 Multi-Tenancy Implementation

### Tenant Isolation Strategy

```typescript
// apps/api/src/app/core/tenant-context.service.ts

@Injectable()
export class TenantContextService {
  private currentTenant: Tenant;

  /**
   * Extracts tenant from subdomain or JWT
   * e.g., elite-padel.khana.com → Tenant ID
   */
  async resolveTenant(request: Request): Promise<Tenant> {
    // Strategy 1: Subdomain extraction
    const subdomain = this.extractSubdomain(request.hostname);

    if (subdomain) {
      return this.tenantRepository.findBySubdomain(subdomain);
    }

    // Strategy 2: JWT claim
    const token = this.extractToken(request);
    const decoded = this.jwtService.verify(token);

    return this.tenantRepository.findById(decoded.tenantId);
  }

  /**
   * Injects tenant context into all database queries
   * Ensures data isolation between tenants
   */
  applyTenantFilter(queryBuilder: SelectQueryBuilder<any>): void {
    if (this.currentTenant) {
      queryBuilder.andWhere('entity.tenantId = :tenantId', {
        tenantId: this.currentTenant.id,
      });
    }
  }
}
```

### Request Lifecycle

```
1. Request arrives → extract tenant context (subdomain/JWT)
2. Validate tenant → check active status & permissions
3. Set tenant context → thread-local storage
4. Execute business logic → all queries auto-filtered by tenant
5. Return response → tenant-specific data only
```

---

## 🚀 Performance Optimizations

### Database Indexing Strategy

**⚠️ INDEXING PHILOSOPHY:** Since we only store OCCUPIED slots (BOOKED, BLOCKED, MAINTENANCE),
our indexes are optimized for fast conflict detection, not availability queries.
Availability is calculated in-memory, so we don't need indexes for AVAILABLE status.

```sql
-- Critical indexes for conflict detection and booking queries

-- Index for fast conflict detection (overlap queries)
-- Used by: ConflictDetector.detectConflicts()
CREATE INDEX idx_inventory_overlap_detection
  ON inventory_slots (facility_id, start_time, end_time);

-- Booking reference lookup (external API calls)
-- Used by: GET /bookings/:reference
CREATE INDEX idx_bookings_reference
  ON bookings (booking_reference);

-- Tenant-scoped booking queries (multi-tenancy isolation)
-- Used by: Dashboard booking list
CREATE INDEX idx_bookings_tenant_timeline
  ON bookings (tenant_id, status, created_at DESC);

-- Facility-specific booking timeline (availability calculation)
-- Used by: AvailabilityCalculator.calculateHourlyAvailability()
CREATE INDEX idx_bookings_facility_time
  ON bookings (facility_id, start_time, end_time);

-- Inventory slot status filtering (maintenance, blocked periods)
-- Used by: Admin dashboard, maintenance scheduling
CREATE INDEX idx_inventory_status
  ON inventory_slots (facility_id, status, start_time);

-- Customer booking history
-- Used by: Customer dashboard, booking history
CREATE INDEX idx_bookings_customer
  ON bookings (customer_id, created_at DESC);

-- ⚠️ REMOVED: No partial index for AVAILABLE slots
-- Reason: We don't store AVAILABLE slots in database
-- Old (incorrect): CREATE INDEX idx_active_slots ON inventory_slots (facility_id, start_time) WHERE status = 'AVAILABLE';
```

**Performance Characteristics:**

- Conflict detection: <10ms for facilities with 1000+ bookings
- Availability calculation: <50ms (in-memory generation + single DB query)
- Booking creation: <100ms (conflict check + insert + slot creation)
- Database growth: Linear with actual bookings (~50 rows/year per facility), NOT linear with time slots

### Caching Strategy

```typescript
// apps/api/src/app/core/caching.service.ts

@Injectable()
export class CachingService {
  /**
   * Cache availability queries for 60 seconds
   * Invalidate on booking creation
   */
  @Cacheable({ ttl: 60, key: 'availability' })
  async getAvailability(facilityId: string, date: Date) {
    return this.availabilityCalculator.calculate(facilityId, date);
  }

  /**
   * Cache facility metadata for 5 minutes
   * Invalidate on facility updates
   */
  @Cacheable({ ttl: 300, key: 'facility' })
  async getFacility(facilityId: string) {
    return this.facilityRepository.findById(facilityId);
  }
}
```

---

## 🧪 Testing Strategy

### Test Pyramid

```
        /\
       /  \  E2E Tests (10%)
      /____\
     /      \ Integration Tests (30%)
    /________\
   /          \ Unit Tests (60%)
  /____________\
```

### Critical Test Cases

```typescript
// libs/booking-engine/src/lib/conflict-detector.spec.ts

describe('ConflictDetector', () => {
  describe('detectConflicts', () => {
    it('should detect exact time overlap', async () => {
      // Given: Existing booking 14:00-15:00
      // When: Request 14:00-15:00
      // Then: Conflict detected
    });

    it('should detect partial overlap (start)', async () => {
      // Given: Existing booking 14:00-15:00
      // When: Request 13:30-14:30
      // Then: Conflict detected
    });

    it('should detect partial overlap (end)', async () => {
      // Given: Existing booking 14:00-15:00
      // When: Request 14:30-15:30
      // Then: Conflict detected
    });

    it('should detect containment', async () => {
      // Given: Existing booking 14:00-16:00
      // When: Request 14:30-15:30
      // Then: Conflict detected
    });

    it('should allow adjacent bookings', async () => {
      // Given: Existing booking 14:00-15:00
      // When: Request 15:00-16:00
      // Then: No conflict (exact boundary)
    });
  });
});
```

---

## 🔒 Security Considerations

### Authentication & Authorization

```typescript
// apps/api/src/app/auth/auth.guard.ts

@Injectable()
export class TenantAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Validate JWT token
    const token = this.extractToken(request);
    const payload = await this.jwtService.verifyAsync(token);

    // 2. Resolve tenant context
    const tenant = await this.tenantService.findById(payload.tenantId);

    // 3. Validate tenant is active
    if (!tenant.isActive) {
      throw new ForbiddenException('Tenant account is suspended');
    }

    // 4. Check role permissions
    const requiredRole = this.reflector.get('role', context.getHandler());
    if (!payload.roles.includes(requiredRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // 5. Inject tenant context
    request.tenant = tenant;
    request.user = payload;

    return true;
  }
}
```

### Data Isolation

```typescript
// Automatic tenant filtering at repository level
@Injectable()
export class BaseRepository<T> {
  createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(alias);

    // Auto-inject tenant filter
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (tenantId) {
      qb.andWhere(`${alias}.tenantId = :tenantId`, { tenantId });
    }

    return qb;
  }
}
```

---

## 📊 Monitoring & Observability

### Key Metrics to Track

```typescript
// Performance Metrics
- Booking creation latency (p50, p95, p99)
- Availability query response time
- Database query performance
- API endpoint response times

// Business Metrics
- Bookings per minute
- Conflict detection rate
- Cancellation rate
- Revenue per facility

// System Health
- CPU/Memory utilization
- Database connection pool
- Error rates by endpoint
- Active tenant count
```

### Logging Strategy

```typescript
@Injectable()
export class LoggerService {
  logBookingCreated(booking: Booking) {
    this.logger.info({
      event: 'booking.created',
      tenantId: booking.tenant.id,
      facilityId: booking.inventorySlot.facility.id,
      bookingReference: booking.bookingReference,
      amount: booking.totalAmount,
      timestamp: new Date(),
    });
  }

  logConflictDetected(facilityId: string, requestedTime: TimeRange) {
    this.logger.warn({
      event: 'booking.conflict_detected',
      facilityId,
      requestedTime,
      timestamp: new Date(),
    });
  }
}
```

---

## 🔄 Deployment Strategy

### Phase 1: MVP Deployment

```yaml
Environment: AWS / DigitalOcean
Architecture: Monolithic (simplicity for MVP)
Database: PostgreSQL (managed instance)
Frontend: Vercel / Netlify (static hosting)
Backend: Docker container on single VM

Tech Stack:
  - Node.js 20+
  - PostgreSQL 16+
  - Nginx (reverse proxy)
  - PM2 (process manager)
```

### Phase 2: Scaled Deployment

```yaml
Environment: AWS with auto-scaling
Architecture: Microservices (booking, payment, CRM)
Database: PostgreSQL with read replicas
Cache: Redis for availability queries
CDN: CloudFront for static assets

Tech Stack:
  - ECS Fargate (containers)
  - RDS PostgreSQL (multi-AZ)
  - ElastiCache Redis
  - S3 for file storage
  - CloudWatch for monitoring
```

---

## 🔮 Future Technical Enhancements

### Phase 3+ Technical Roadmap

1. **GraphQL API** (2026 Q2)

   - Replace REST with GraphQL for mobile app
   - Real-time subscriptions for availability updates

2. **Event-Driven Architecture** (2026 Q3)

   - Implement event sourcing for bookings
   - Apache Kafka for event streaming
   - CQRS pattern for read/write separation

3. **AI-Powered Recommendations** (2027)

   - Machine learning for pricing optimization
   - Predictive availability forecasting
   - Personalized booking recommendations

4. **Blockchain Integration** (Future)
   - Immutable booking records
   - Smart contracts for payment escrow
   - Decentralized identity management

---

## 📚 Technical References

### Design Patterns Used

- **Repository Pattern**: Data access abstraction
- **Service Layer Pattern**: Business logic encapsulation
- **Factory Pattern**: Entity creation
- **Strategy Pattern**: Pricing calculations
- **Observer Pattern**: Event notifications

### SOLID Principles Application

- **Single Responsibility**: Each service has one clear purpose
- **Open/Closed**: Extensible through interfaces (InventoryType)
- **Liskov Substitution**: Polymorphic inventory engine
- **Interface Segregation**: Focused interfaces for each concern
- **Dependency Inversion**: Depend on abstractions, not concretions

---

## 🎓 Onboarding Checklist

### For New Developers

- [ ] Clone Nx monorepo
- [ ] Install dependencies (`npm install`)
- [ ] Set up local PostgreSQL database
- [ ] Run database migrations
- [ ] Start dev server (`nx serve api`)
- [ ] Read this architecture document
- [ ] Review booking engine tests
- [ ] Understand multi-tenancy implementation
- [ ] Complete first ticket: Simple CRUD feature

---

## 🔥 Critical Architectural Decisions

### Decision 1: No Pre-Generated Inventory Slots

**Problem:** Initial design suggested pre-generating InventorySlot rows for every available time (e.g., all hours in a day).

**Why This is Wrong:**

- **Database Bloat:** A single court with 15 operating hours/day would generate 5,475 rows per year (365 × 15)
- **10 courts:** 54,750 rows/year of mostly empty data
- **Write Overhead:** Every slot update requires database writes
- **Query Performance:** More rows = slower queries, even with indexes
- **Scaling Failure:** 100 facilities × 5,475 = 547,500 rows/year of noise

**Correct Solution:**

- **Store ONLY occupied slots** (BOOKED, BLOCKED, MAINTENANCE)
- **Generate availability in-memory** from Facility operating hours
- **Subtract occupied slots** using overlap logic
- **Result:** 10 courts with 80% occupancy = ~4,380 rows/year (actual bookings only)

**Performance Gains:**

- 92% reduction in database size
- <50ms availability queries (in-memory generation + single DB query)
- <10ms conflict detection (querying only occupied slots)
- Linear scaling with bookings, not with time

---

### Decision 2: DTO Separation to Prevent Coupling

**Problem:** Initial monorepo structure had Frontend importing Backend entities with ORM decorators.

**Why This is Wrong:**

- **Build Errors:** TypeORM decorators (`@Entity`, `@Column`) require Node.js dependencies
- **Angular Browser Target:** Cannot bundle Node.js-only dependencies
- **Coupling:** Frontend tightly coupled to backend ORM implementation
- **Security Risk:** Exposing database schema details to frontend
- **Refactoring Hell:** Changing ORM requires frontend changes

**Correct Solution:**

```
┌─────────────────────────────────────────────────────┐
│                  BACKEND (NestJS)                   │
│  libs/data-access/                                  │
│  ├── entities/         (TypeORM decorators)         │
│  ├── repositories/     (Database layer)             │
│  └── ⚠️ NEVER imported by frontend                  │
└─────────────────────────────────────────────────────┘
                          │
                          │ Maps to
                          ↓
┌─────────────────────────────────────────────────────┐
│              SHARED (No decorators)                 │
│  libs/shared-dtos/                                  │
│  ├── booking.dto.ts    (Pure interfaces)            │
│  ├── facility.dto.ts   (No ORM decorators)          │
│  └── ✅ Safe for Angular AND NestJS                 │
└─────────────────────────────────────────────────────┘
                          │
                          │ Imported by
                          ↓
┌─────────────────────────────────────────────────────┐
│                 FRONTEND (Angular)                  │
│  apps/manager-dashboard/                            │
│  ├── features/bookings/ (Uses DTOs)                 │
│  └── ✅ Zero ORM dependencies                       │
└─────────────────────────────────────────────────────┘
```

**Implementation Pattern:**

```typescript
// ❌ WRONG: libs/data-access/entities/booking.entity.ts
@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  // Angular CANNOT import this!
}

// ✅ CORRECT: libs/shared-dtos/booking.dto.ts
export interface BookingDto {
  id: string;
  bookingReference: string;
  facilityId: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  status: BookingStatus;
}
// Safe for Angular AND NestJS

// ✅ CORRECT: Backend maps Entity → DTO
@Controller('bookings')
export class BookingsController {
  @Get(':id')
  async getBooking(@Param('id') id: string): Promise<BookingDto> {
    const booking = await this.repository.findOne(id);
    return this.mapToDto(booking); // Explicit mapping
  }
}
```

**Benefits:**

- ✅ Clean separation of concerns
- ✅ Frontend independent of ORM implementation
- ✅ No build errors from decorator dependencies
- ✅ Backend can refactor database layer without breaking frontend
- ✅ Enhanced security (frontend never sees database schema)

---

### Decision 3: Denormalized Booking Schema

**Problem:** Original design had Booking → InventorySlot → Facility hierarchy, requiring joins for simple queries.

**Why We Denormalized:**

```typescript
// Before: 3-table join for availability check
SELECT * FROM bookings
JOIN inventory_slots ON bookings.inventory_slot_id = inventory_slots.id
JOIN facilities ON inventory_slots.facility_id = facilities.id
WHERE facilities.id = ? AND inventory_slots.start_time < ? AND inventory_slots.end_time > ?

// After: Single table query
SELECT * FROM bookings
WHERE facility_id = ? AND start_time < ? AND end_time > ?
```

**Trade-offs:**

- **Pro:** 3x faster queries (single table, no joins)
- **Pro:** Simpler conflict detection logic
- **Pro:** Better index utilization
- **Con:** Duplicated data (start_time, end_time in both bookings and inventory_slots)
- **Con:** Must maintain consistency (create both records on booking)

**Verdict:** Worth it. Query performance is critical for real-time availability.

---

### Decision 4: Polymorphic Inventory Engine

**Design Goal:** Support both hourly (sports) and daily (chalets) bookings with the same codebase.

**Implementation:**

```typescript
enum InventoryType {
  HOURLY, // Sports facilities (60-min slots)
  DAILY, // Chalets (24-hour slots)
  CUSTOM, // Future: Flexible durations
}

// Same availability calculator, different time units
calculateAvailability(facilityId, start, end, InventoryType.HOURLY);
calculateAvailability(facilityId, start, end, InventoryType.DAILY);
```

**Why This Works:**

- **Abstraction:** Time slots are just `{ startTime, endTime }` pairs
- **Overlap Logic:** Same algorithm for hourly and daily conflicts
- **Pricing:** Dynamic calculation works for any duration
- **Scaling:** Add new inventory types without core logic changes

**Result:** Phase 1 (sports) and Phase 3 (chalets) share 90% of booking engine code.

---

## 📐 Architectural Principles Applied

### 1. **Sparse Data Structures**

- Store only what exists (occupied slots), not what's possible (all slots)
- Generate computed data on-demand in-memory
- Result: 92% reduction in database rows

### 2. **Separation of Concerns**

- Backend entities (ORM) ≠ Frontend DTOs (interfaces)
- Database layer isolated from API consumers
- Result: Zero coupling, independent evolution

### 3. **Performance-First Design**

- Denormalize for read performance (bookings table)
- Optimize for most common queries (conflict detection)
- Cache computed results (availability maps)
- Result: <100ms booking creation, <50ms availability queries

### 4. **Scalable Abstractions**

- Polymorphic inventory types (HOURLY, DAILY, CUSTOM)
- Shared booking engine logic across all facility types
- Result: New verticals require zero core logic changes

---

**Last Updated:** December 2025
**Version:** 0.2.0-alpha (Architecture Refactor)
**Maintainer:** Technical Team

_"Engineered for scale, built for MENA."_
