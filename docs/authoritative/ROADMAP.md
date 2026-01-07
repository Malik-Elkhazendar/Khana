# Khana Project Roadmap

**Status**: ACTIVE
**Phase**: Phase 1 (Foundation) - IN PLANNING
**Last Updated**: 2026-01-06

---

## ROADMAP OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION (20-30h) ← WE ARE HERE             │
│ Build: Auth, User System, Permissions                   │
│ Unblocks: ALL user-facing features                      │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ PHASE 2: FEATURES (12-16h)                              │
│ Build: Booking features with auth integration           │
│ Unblocks: Production deployment                         │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ PHASE 3: ADVANCED (16-20h)                              │
│ Build: Payments, Notifications, Analytics               │
│ Unblocks: Premium features                              │
└─────────────────────────────────────────────────────────┘
```

**Total Timeline**: 4-6 weeks to production
**Current Status**: Phase 1 not started (blocks everything)

---

## PHASE 1: FOUNDATION (CRITICAL PATH)

**Goal**: Build authentication and user management system

**Status**: ❌ NOT STARTED
**Priority**: 🔴 CRITICAL (blocks all features)
**Estimated Effort**: 20-30 hours

### Task Breakdown:

#### 1.1 Backend Auth System (10-12h)

- [ ] Install dependencies (@nestjs/passport, @nestjs/jwt, bcrypt)
- [ ] Create User entity with roles (User, Manager, Admin)
- [ ] Implement JWT strategy
- [ ] Create auth module with login/logout
- [ ] Add password hashing with bcrypt
- [ ] Create auth guards (JwtAuthGuard, RolesGuard)
- [ ] Add permission decorators (@Roles, @Public)
- [ ] Write auth service tests

**Deliverable**: Working auth API endpoints

#### 1.2 Frontend Auth Integration (6-8h)

- [ ] Create auth service (login, logout, token storage)
- [ ] Create auth guards for routes
- [ ] Create login component
- [ ] Add auth interceptor for API calls
- [ ] Implement token refresh logic
- [ ] Create user state store (SignalStore)
- [ ] Add auth error handling
- [ ] Write auth service tests

**Deliverable**: Working login/logout flow

#### 1.3 Permission System (4-6h)

- [ ] Define role enum (ADMIN, MANAGER, USER)
- [ ] Implement role-based guards
- [ ] Add permission middleware
- [ ] Create permission decorators
- [ ] Add role assignment logic
- [ ] Test permission checks

**Deliverable**: Role-based access control

#### 1.4 Basic Audit Logging (2-4h)

- [ ] Create AuditLog entity
- [ ] Add audit logging interceptor
- [ ] Log all create/update/delete operations
- [ ] Add audit log retrieval endpoint

**Deliverable**: Audit trail for compliance

### Phase 1 Completion Criteria:

```
✅ User can register/login/logout
✅ JWT tokens issued and validated
✅ Protected routes require authentication
✅ Role-based permissions work
✅ Users have roles assigned
✅ Basic audit logging captures mutations
✅ All auth tests pass (target: 50+ tests)
```

**What Phase 1 Unblocks**:

- ✅ booking-calendar can be shipped
- ✅ booking-preview can be shipped
- ✅ booking-list can be shipped
- ✅ User profile features
- ✅ Admin dashboard

---

## PHASE 2: FEATURE INTEGRATION (BLOCKED BY PHASE 1)

**Goal**: Integrate auth with existing booking features

**Status**: ⏸️ WAITING (blocked by Phase 1)
**Priority**: 🟠 HIGH
**Estimated Effort**: 12-16 hours

### Task Breakdown:

#### 2.1 booking-calendar Auth Integration (4-5h)

- [ ] Add auth guard to calendar route
- [ ] Scope bookings to current user
- [ ] Add user ID to booking creation
- [ ] Validate user can view/modify booking
- [ ] Update tests for auth scenarios
- [ ] Verify permissions work

**Deliverable**: Authenticated booking calendar

#### 2.2 booking-preview Auth Integration (3-4h)

- [ ] Add auth guard to preview route
- [ ] Validate user can preview slots
- [ ] Add user context to preview requests
- [ ] Update tests for auth
- [ ] Verify user scoping

**Deliverable**: Authenticated booking preview

#### 2.3 booking-list Auth Integration (3-4h)

- [ ] Add auth guard to list route
- [ ] Filter bookings by current user
- [ ] Add role-based action visibility
- [ ] Update tests for user scoping
- [ ] Verify data privacy

**Deliverable**: User-scoped booking list

#### 2.4 Integration Testing (2-3h)

- [ ] End-to-end auth flow tests
- [ ] Cross-feature permission tests
- [ ] Data privacy verification
- [ ] Performance testing with auth

**Deliverable**: Full test coverage

### Phase 2 Completion Criteria:

```
✅ All routes require authentication
✅ Users only see their own bookings
✅ Permissions validated on all actions
✅ Tests pass with auth (target: 100+ total tests)
✅ No unauthorized data access possible
✅ Performance acceptable (<500ms with auth)
```

**What Phase 2 Unblocks**:

- ✅ Production deployment
- ✅ Real user testing
- ✅ Beta launch

---

## PHASE 3: ADVANCED FEATURES (BLOCKED BY PHASE 1 + 2)

**Goal**: Add payment integration and advanced features

**Status**: ⏸️ FUTURE (Phase 2 dependency)
**Priority**: 🟡 MEDIUM
**Estimated Effort**: 16-20 hours

### Task Breakdown:

#### 3.1 Payment Integration (8-10h)

- [ ] Choose payment gateway (Stripe/Tap/Mada)
- [ ] Install payment SDK
- [ ] Create payment service
- [ ] Add payment endpoints
- [ ] Integrate with booking flow
- [ ] Add refund logic
- [ ] Handle payment webhooks
- [ ] Test payment scenarios

**Deliverable**: Working payment system

#### 3.2 Email Notifications (4-6h)

- [ ] Choose email service (SendGrid/AWS SES)
- [ ] Create email templates
- [ ] Add notification service
- [ ] Send booking confirmations
- [ ] Send payment receipts
- [ ] Send cancellation notices

**Deliverable**: Automated email notifications

#### 3.3 Advanced Audit & Analytics (4-6h)

- [ ] Enhanced audit logging
- [ ] User activity tracking
- [ ] Booking analytics dashboard
- [ ] Performance monitoring

**Deliverable**: Business intelligence

### Phase 3 Completion Criteria:

```
✅ Payments processed successfully
✅ Email notifications sent
✅ Analytics dashboard working
✅ All advanced tests pass
```

---

## CRITICAL PATH ANALYSIS

**Longest Dependency Chain**:

```
Auth System (20-30h)
  ↓
Feature Integration (12-16h)
  ↓
Production Deployment
  ↓
Payment Integration (8-10h)
  ↓
Full Feature Set

Total: 40-56 hours critical path
```

**Parallelizable Work**:

- Email templates (can start anytime)
- Analytics design (can start after Phase 1)
- Performance optimization (ongoing)

---

## RISK MITIGATION

### Risk 1: Phase 1 Takes Longer Than Expected

**Mitigation**: Phase 1 is well-defined with clear tasks. If delayed:

- Prioritize auth core (login/logout) first
- Defer audit logging to Phase 2
- Timeline buffer: 20-30h range accounts for unknowns

### Risk 2: Auth Integration Breaks Existing Features

**Mitigation**:

- Comprehensive test coverage (79+ existing tests)
- Add auth tests BEFORE integration
- Use feature flags for gradual rollout

### Risk 3: Security Vulnerabilities in Auth

**Mitigation**:

- Use battle-tested libraries (@nestjs/passport)
- Follow OWASP guidelines
- Security audit before production
- Penetration testing

---

## TIMELINE ESTIMATE

**Optimistic** (1 developer, full-time):

- Phase 1: 2 weeks
- Phase 2: 1 week
- Phase 3: 1.5 weeks
- **Total: 4.5 weeks**

**Realistic** (1 developer, part-time or learning curve):

- Phase 1: 3 weeks
- Phase 2: 1.5 weeks
- Phase 3: 2 weeks
- **Total: 6.5 weeks**

**Conservative** (includes delays, testing, reviews):

- Phase 1: 4 weeks
- Phase 2: 2 weeks
- Phase 3: 2.5 weeks
- **Total: 8.5 weeks**

---

## DECISION GATE: When Can We Ship?

**Minimum Viable Product (MVP)**:

```
✅ Phase 1 complete (auth works)
✅ Phase 2 complete (features integrated)
✅ Security audit passed
✅ All tests green
✅ Performance acceptable

= READY FOR PRODUCTION
```

**Full Feature Set**:

```
✅ MVP requirements
✅ Phase 3 complete (payments + advanced)
✅ Email notifications working
✅ Analytics dashboard live

= READY FOR SCALE
```

Current status: **~5 weeks from MVP, ~7 weeks from full feature set**
