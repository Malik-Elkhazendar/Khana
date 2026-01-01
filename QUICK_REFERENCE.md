# Khana Quick Reference

**One-page guide for rapid context loading.**

---

## 🎯 Project Essence (30-second read)

**What:** B2B SaaS booking platform for sports facilities & chalets in MENA.

**Problem:** Chaotic WhatsApp bookings → double-bookings → lost revenue.

**Solution:** Real-time inventory management with conflict detection algorithms.

**Unique Value:** Flexible "Inventory Engine" that works for both hourly (sports) and daily (chalets) bookings with the same codebase.

---

## 🚀 4-Phase Scaling Plan

| Phase             | Target                      | Product                       | Revenue Model               | Status             |
| ----------------- | --------------------------- | ----------------------------- | --------------------------- | ------------------ |
| **1. Wedge**      | Padel/Football courts       | Manager Dashboard             | SaaS subscription           | ✅ In Progress     |
| **2. Layering**   | Same clients                | Add Payment Gateway           | Transaction fees (2-3%)     | 📋 Planned Q1 2026 |
| **3. Horizontal** | Chalets/Resorts             | Same product, DAILY inventory | SaaS + Transactions         | 📋 Planned Q2 2026 |
| **4. Network**    | End users (players/renters) | Marketplace App               | Commission + Discovery fees | 📋 Planned Q3 2026 |

---

## 🏗️ Tech Stack (Why it Scales)

| Component    | Technology          | Reason                                |
| ------------ | ------------------- | ------------------------------------- |
| **Backend**  | NestJS (TypeScript) | Enterprise-grade, microservices-ready |
| **Frontend** | Angular             | Consistent with backend, mobile-ready |
| **Database** | PostgreSQL          | ACID compliance, millions of bookings |
| **Monorepo** | Nx                  | Share booking logic across apps       |
| **Hosting**  | AWS/DigitalOcean    | Auto-scaling for traffic spikes       |

**Key Architectural Decision:** Polymorphic Inventory Engine

```typescript
enum InventoryType {
  HOURLY, // Phase 1: Sports (60-min slots)
  DAILY, // Phase 3: Chalets (full days)
  CUSTOM, // Future: Flexible units
}
```

---

## 🗄️ Database Core (5 Tables)

```
Tenant ─┐
        ├─→ Facility ─┐
                      ├─→ InventorySlot ─┐
                                         ├─→ Booking
Customer ───────────────────────────────┘
```

**Critical Entities:**

1. **Tenant:** Multi-tenancy (each client is isolated)
2. **Facility:** Courts, Chalets, Fields
3. **InventorySlot:** Time/day blocks with pricing
4. **Booking:** Reservation records
5. **Customer:** CRM data

---

## ⚙️ Core Algorithms

### 1. Conflict Detection

```
Input: Requested time range
Process: Check for overlaps in existing bookings
Output: Conflict result + alternative suggestions
Performance: <50ms for 10,000 bookings
```

### 2. Availability Calculator

```
Input: Facility ID, date range, inventory type (HOURLY/DAILY)
Process: Generate slots → filter booked → return matrix
Output: Real-time availability grid
Performance: <100ms with caching
```

### 3. Pricing Engine

```
Factors: Base price × Time multiplier × Day multiplier - Duration discount
Example: SAR 200 × 1.5 (peak) × 1.3 (weekend) - 10% (2hr booking) = SAR 351
```

---

## 📦 Project Structure (Nx Monorepo)

```
khana-workspace/
├── apps/
│   ├── api/                    # NestJS backend
│   ├── manager-dashboard/      # Angular owner UI
│   └── customer-app/           # Future mobile app
│
├── libs/
│   ├── booking-engine/         # Core logic (shared!)
│   ├── data-access/            # Database entities
│   ├── payment-gateway/        # Phase 2
│   └── ui-components/          # Shared Angular components
```

**Key Benefit:** The `booking-engine` lib is shared between owner dashboard and future customer app. Write once, use everywhere.

---

## 🔐 Multi-Tenancy Strategy

**Tenant Isolation:**

```
Subdomain → Tenant ID → Auto-filter all queries

Example:
elite-padel.khana.com → Tenant: "elite-padel" → Only see their data
royal-chalet.khana.com → Tenant: "royal-chalet" → Isolated data
```

**Security:**

- JWT tokens with tenant claims
- Database queries auto-filtered by tenant ID
- No cross-tenant data leakage possible

---

## 📊 Success Metrics (KPIs)

### Phase 1 Goals (Sports Facilities)

- ✅ 50+ facilities onboarded by Q2 2026
- ✅ <5% double-booking rate
- ✅ 30%+ revenue increase for clients (vs. WhatsApp)
- ✅ <2s dashboard load time

### Phase 2 Goals (Financials)

- ✅ 80% payment adoption rate
- ✅ SAR 1M+ transaction volume/month
- ✅ 2-3% transaction fees = recurring revenue

### Phase 4 Goals (Marketplace)

- ✅ 10,000+ end users
- ✅ 40% of bookings via marketplace
- ✅ Network effect activated (more venues = more users = more venues)

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Start backend API
nx serve api

# Start manager dashboard
nx serve manager-dashboard

# Run all tests
nx test

# Build for production
nx build api --prod
nx build manager-dashboard --prod

# Database migrations
npm run migration:generate
npm run migration:run
```

---

## 🔥 Critical Business Rules

1. **No Double-Bookings:** Conflict detection is non-negotiable. If algorithm fails, rollback transaction.

2. **Tenant Isolation:** All database queries MUST be tenant-filtered. Security vulnerability if violated.

3. **Real-Time Availability:** Caching allowed for 60 seconds max. Stale data = angry customers.

4. **Payment Integrity:** All financial transactions logged immutably. Audit trail required.

5. **Performance SLA:** Booking creation <1 second. Dashboard load <2 seconds. API response <200ms.

---

## 🌍 MENA Market Context

**Why MENA?**

- Sports culture boom (Padel especially)
- Domestic tourism growth (chalets/camps)
- High mobile penetration (ready for apps)
- Underserved market (no localized competitors)

**Localization Needs:**

- Arabic & English support
- Right-to-left (RTL) UI
- Local payment methods (Mada, STC Pay)
- Weekend: Thursday-Friday (not Saturday-Sunday)
- Prayer time considerations for sports bookings

---

## 💡 Key Insights

### Technical Insights

1. **Polymorphic Design:** Same code serves sports (hourly) and chalets (daily) by changing one enum.
2. **Shared Logic:** Nx monorepo prevents duplication between owner and customer apps.
3. **Conflict Algorithm:** Core IP. Handles edge cases (overlaps, containment, boundaries).

### Business Insights

1. **Start Narrow:** Master sports facilities before expanding to chalets.
2. **Payment = Moat:** Once you handle money, switching cost becomes high.
3. **Data = Power:** Controlling real-time inventory creates network effects.

### Scaling Insights

1. **Multi-Tenancy:** Database designed for 10,000 tenants from day one.
2. **Horizontal Scaling:** Add inventory types without code rewrites.
3. **Vertical Integration:** From booking → payment → marketplace = unbeatable.

---

## 🚨 Risks & Mitigations

| Risk                    | Impact | Mitigation                               |
| ----------------------- | ------ | ---------------------------------------- |
| Double-booking bug      | High   | 80%+ test coverage on conflict detection |
| Payment gateway failure | High   | Fallback to manual payment tracking      |
| Slow adoption           | Medium | Free pilot program for first 10 clients  |
| Competition             | Medium | First-mover advantage + superior tech    |
| Database scaling        | Low    | PostgreSQL + read replicas + caching     |

---

## 📚 Essential Reading

### For Developers

1. **ARCHITECTURE.md** - Technical deep dive
2. **README.md** - Full vision and strategy
3. NestJS docs: https://nestjs.com
4. Nx docs: https://nx.dev

### For Business

1. **README.md** - Market opportunity and scaling plan
2. MENA sports facility market research
3. Network effects in marketplace businesses

---

## 🎯 Current Sprint Focus

**Phase 1 MVP (Current):**

- ✅ Database schema finalized
- 🔄 Conflict detection algorithm (in progress)
- 🔄 Manager dashboard UI (in progress)
- 📋 Availability calculator (next)
- 📋 Pricing engine (next)

**Next Milestone:**
First 10 pilot clients by Q1 2026.

---

## 📞 Quick Contacts

**Project Phase:** Phase 1 (MVP Development)
**Current Version:** 0.1.0-alpha
**Last Updated:** December 2025

---

**TL;DR:** Build a flexible booking engine for sports facilities (Phase 1), add payments (Phase 2), pivot to chalets (Phase 3), launch marketplace (Phase 4). Same codebase, multiple markets, network effects. NestJS + Angular + PostgreSQL + Nx = scalability.

---

_"From chaos to clarity—one booking at a time."_ 🚀
