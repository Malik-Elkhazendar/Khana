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

**For detailed development guide with code examples, patterns, and troubleshooting:**
→ See [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)

**Key Resources:**

- [Component Creation Checklist](docs/DEVELOPMENT_GUIDE.md#component-creation-checklist)
- [Common ESLint Errors & Solutions](docs/DEVELOPMENT_GUIDE.md#common-eslint-errors--solutions)
- [Daily Development Workflow](docs/DEVELOPMENT_GUIDE.md#daily-development-workflow)
- [Testing Guide](docs/DEVELOPMENT_GUIDE.md#testing-guide)
- [Troubleshooting](docs/DEVELOPMENT_GUIDE.md#troubleshooting)
