# Khana (خانة)

**"The Operating System for Local Booking-Based Businesses."**

Khana is a specialized B2B SaaS platform designed to digitize the operations of sports facilities (Padel, Football) and short-term rental properties (Chalets, Resorts) in the MENA region.

Instead of relying on chaotic WhatsApp messages, paper notebooks, and bank transfers, Khana provides facility owners with a centralized digital command center. It automates inventory management, prevents double-booking conflicts via complex algorithms, manages customer data (CRM), and eventually handles financial reconciliation.

## Core Value Proposition

- **For Owners:** Zero operational headaches, higher revenue (no empty slots due to slow replies), and theft prevention.
- **For Customers:** Instant gratification (real-time availability) and seamless booking experience.

## Scaling Strategy ("Land and Expand")

Khana is built as a flexible "Inventory Engine" that scales to serve different clients over time:

### Phase 1: The Wedge (Sports Facilities)

- **Target:** Padel & Football courts.
- **Why:** High frequency, high pain point, recurring customers.
- **Product:** "Manager Dashboard" only (focus on scheduling).
- **Scalability:** Logic handles "Time Slots" (e.g., 60 mins, 90 mins).

### Phase 2: The Layering (Financials & Automation)

- **Target:** Existing clients + larger sports complexes.
- **Expansion:** Integrate "Khana Pay" (Payment Gateway).
- **Scalability:** Transition from tool to financial intermediary (taking a % of transactions).

### Phase 3: Horizontal Expansion (Pivot to Chalets)

- **Target:** Chalets, Camps (Istirahats), Private Resorts.
- **Shift:** Change "Unit of Inventory" from Hours to Days.
- **Scalability:** Polymorphic Booking Logic (NestJS) allows adding `InventoryType: DAILY` to capture a new market with the same codebase.

### Phase 4: The Network Effect (B2B -> B2B2C)

- **Target:** End Users (Players/Renters).
- **Expansion:** Launch "Khana Marketplace App" once 50+ venues are onboarded.
- **Scalability:** Controlling real-time inventory creates a competitive moat.

## Technical Scalability

Built with **NestJS + Angular + PostgreSQL + Nx**:

- **Multi-Tenancy:** Database schema supports 1 to 10,000 tenants seamlessly.
- **Modular Logic:** Nx allows sharing "Booking Validation Logic" between the Web Dashboard and future Mobile App.
- **Performance:** PostgreSQL handles high traffic volumes (e.g., seasonal spikes) efficiently.

## Development & Code Quality

All code contributions must pass automated quality checks before merging.

**Code Quality Standards:**

- **ESLint**: Static code analysis to catch bugs and enforce patterns
- **Prettier**: Automatic code formatting for consistency
- **TypeScript**: Strict type checking for safety
- **Jest & Playwright**: Comprehensive unit and E2E testing
- **Git Hooks**: Pre-commit validation prevents broken code from being committed

**Getting Started:**

```bash
# Install dependencies (includes all dev tools)
npm install

# Run all quality checks
npm run check

# Fix auto-fixable issues
npm run lint:fix && npm run format
```

**Current implementation docs:**

- [Repository Map](docs/current/repository-map.md)
- [Project Scripts](docs/current/scripts.md)
- [API Modules](docs/current/api-modules.md)
- [Frontend Modules](docs/current/frontend-modules.md)
- [Testing Guide](docs/testing/QUICK_START.md)
- [Secret Management Guide](docs/security-secrets.md)

Archived planning/authoritative docs are under `docs/archive/2026-03-cleanup/`.

## Database Migrations (TypeORM)

The repo now supports explicit TypeORM migrations for release environments.

- Local development (`NODE_ENV=development`): entity `synchronize` stays enabled for fast iteration.
- Staging/Production: `synchronize` is disabled; apply schema changes with migrations.

### Scripts

```bash
# TypeORM CLI wrapper (uses apps/api/src/typeorm/data-source.ts)
npm run typeorm -- <typeorm-command>

# Generate migration from current entity metadata
npm run migration:generate -- libs/data-access/src/lib/migrations/<MigrationName>

# Create empty migration file
npm run migration:create -- libs/data-access/src/lib/migrations/<MigrationName>

# Apply or rollback migrations
npm run migration:run
npm run migration:revert
```

### Workflow

1. Update entities under `libs/data-access/src/lib/entities`.
2. Generate migration:
   `npm run migration:generate -- libs/data-access/src/lib/migrations/<MigrationName>`
3. Review the generated SQL carefully.
4. Apply locally with `npm run migration:run`.
5. Deploy and run `npm run migration:run` in staging, then production.

Initial baseline migration:

- `libs/data-access/src/lib/migrations/1772130132263-InitialSchema.ts`
