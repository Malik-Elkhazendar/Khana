# Strategic Decision Framework

**Status**: ACTIVE
**Last Updated**: 2026-01-06
**Authority**: Principal Architect

---

## PURPOSE

This document defines the HARD CONSTRAINTS and decision-making rules that guide all technical recommendations. The staff-engineer agent MUST validate all recommendations against this framework before output.

---

## CRITICAL CONSTRAINTS (BLOCKING RULES)

### 🔴 CONSTRAINT 1: No Auth = No Production

**Rule**: NO feature can be shipped to production without a complete authentication system.

**Rationale**:

- User identification is required for data privacy
- Cannot track who performed actions (audit requirement)
- Cannot enforce permissions (security requirement)
- GDPR compliance requires user identification

**Validation Check**:

```
IF recommendation includes "ship" OR "deploy" OR "production":
  THEN check: Does auth system exist?
    - @nestjs/passport installed? ❌
    - JWT strategy implemented? ❌
    - Auth guards on routes? ❌
    - User entity in database? ❌
  IF any NO: REJECT recommendation with reason
```

**Blocking Impact**:

- ❌ booking-calendar (cannot ship)
- ❌ booking-preview (cannot ship)
- ❌ booking-list (cannot ship)
- ❌ Any user-facing feature (cannot ship)

---

### 🔴 CONSTRAINT 2: No User Identification = No Multi-Tenant Safety

**Rule**: ALL data must be scoped to authenticated users. No global data access.

**Rationale**:

- Users must only see their own bookings
- Facility managers must only see their facility's data
- Cross-user data leaks are critical security violations

**Validation Check**:

```
IF recommendation involves data access:
  THEN check: Is data scoped to current user?
    - BookingStore filtered by userId? ❌
    - API endpoints require auth? ❌
    - Permission middleware exists? ❌
  IF any NO: REJECT recommendation
```

**Blocking Impact**:

- ❌ All booking features (cannot deploy safely)
- ❌ User profile features
- ❌ Dashboard features

---

### 🔴 CONSTRAINT 3: No Permission Checks = No Role-Based Access

**Rule**: ALL operations must validate user permissions before execution.

**Rationale**:

- Regular users should not access admin features
- Facility managers should only manage their facilities
- Role-based access control is security foundation

**Validation Check**:

```
IF recommendation involves user actions:
  THEN check: Are permissions validated?
    - Role-based guards exist? ❌
    - Permission decorators used? ❌
    - Authorization middleware? ❌
  IF any NO: REJECT recommendation
```

---

### 🟠 CONSTRAINT 4: No Audit Trail = No Production (Compliance)

**Rule**: ALL data mutations must be logged for audit purposes.

**Rationale**:

- GDPR requires tracking who modified what
- Business compliance requires audit trails
- Debugging requires change history

**Validation Check**:

```
IF recommendation involves create/update/delete:
  THEN check: Is audit logging present?
    - Audit log table exists? ❌
    - Mutation logging implemented? ❌
  IF NO: WARN (not blocking, but required for compliance)
```

---

## PHASE GATE SYSTEM

### Phase 1: FOUNDATION (REQUIRED BEFORE ALL)

**Status**: ❌ NOT STARTED

**Required Components**:

1. **Authentication System**

   - @nestjs/passport integration
   - JWT strategy implementation
   - Login/logout endpoints
   - Auth guards on protected routes
   - Session management

2. **User Database**

   - User entity with roles
   - User repository
   - Password hashing (bcrypt)
   - User CRUD operations

3. **Permission System**

   - Role enum (ADMIN, MANAGER, USER)
   - Permission guards
   - Role-based decorators

4. **Basic Audit System**
   - Audit log entity
   - Mutation logging interceptor

**Estimated Effort**: 20-30 hours

**Unblocks**: ALL user-facing features

**Validation**:

```
Phase 1 Complete IF:
  ✅ User can log in/out
  ✅ JWT tokens issued and validated
  ✅ Routes protected with guards
  ✅ Users have roles assigned
  ✅ Basic audit logging works
```

---

### Phase 2: FEATURES (AFTER PHASE 1)

**Status**: ⏸️ BLOCKED by Phase 1

**Required Components**:

1. **booking-calendar** with auth integration

   - Auth guards on component routes
   - User-scoped booking display
   - Permission checks on actions

2. **booking-preview** with auth integration

   - Auth guards on preview endpoint
   - User permission validation

3. **booking-list** with auth integration
   - User-scoped data filtering
   - Role-based action availability

**Estimated Effort**: 12-16 hours (after Phase 1 complete)

**Unblocks**: Production deployment

**Validation**:

```
Phase 2 Complete IF:
  ✅ All features have auth guards
  ✅ Users only see their own data
  ✅ Actions validated by permissions
  ✅ All tests pass with auth
```

---

### Phase 3: ADVANCED (AFTER PHASE 2)

**Status**: ⏸️ BLOCKED by Phase 1 + Phase 2

**Optional Components**:

1. Payment integration (Stripe/Tap)
2. Email notification system
3. Advanced audit logging
4. Performance optimization

**Estimated Effort**: 16-20 hours

---

## BLOCKER MATRIX

| Feature          | Critical Blockers                 | Status     | Impact       |
| ---------------- | --------------------------------- | ---------- | ------------ |
| booking-calendar | Auth system, User DB, Permissions | ❌ BLOCKED | Cannot ship  |
| booking-preview  | Auth system, User DB, Permissions | ❌ BLOCKED | Cannot ship  |
| booking-list     | Auth system, User DB, Permissions | ❌ BLOCKED | Cannot ship  |
| Payment features | Auth + Payment gateway            | ❌ BLOCKED | Future phase |

---

## DECISION RULES FOR AGENT

### Rule 1: Blocker Check (MANDATORY)

**Before ANY recommendation, agent MUST:**

```
1. Check Phase 1 completion status
2. If Phase 1 incomplete:
   - Do NOT recommend shipping ANY feature
   - Do NOT recommend "ready for production"
   - DO recommend: "Build Phase 1 first"
3. List all blocking work with effort estimates
```

### Rule 2: Risk Assessment (MANDATORY)

**For recommendations involving "ship" or "production":**

```
1. Security Risk Check:
   - Is auth implemented? NO → CRITICAL risk
   - Are permissions checked? NO → CRITICAL risk
   - Is data user-scoped? NO → CRITICAL risk

2. If ANY CRITICAL risk:
   - Recommendation = "DO NOT SHIP"
   - Explain: What must be built first
   - Provide: Roadmap to resolve
```

### Rule 3: Dependency Chain (MANDATORY)

**Before recommending a feature:**

```
1. Identify: What does this feature require?
2. Check: Are requirements met?
3. If NO: List blocking work first
4. Provide: Full dependency chain
```

### Rule 4: Reasoning Transparency (MANDATORY)

**Every recommendation MUST include:**

```
1. ANALYSIS: Code quality scores
2. BLOCKERS: What prevents deployment
3. RISKS: Security/privacy/compliance
4. RECOMMENDATION: Clear action with reasoning
5. ROADMAP: Phase-by-phase plan if blocked
```

---

## RECOMMENDATION OUTPUT TEMPLATE

When agent is asked "Can I ship X?" or "What next?":

```
## ANALYSIS
Code Quality: [score]/100
Tests: [count] cases
Accessibility: [score]/25
Type Safety: [violations]

## CRITICAL BLOCKERS IDENTIFIED
❌ Authentication system (NOT BUILT)
   - Impact: Cannot identify users
   - Risk: CRITICAL security violation
   - Effort: 20-30 hours

❌ User database (NOT BUILT)
   - Impact: Cannot store user data
   - Risk: CRITICAL (no user management)
   - Effort: 8-10 hours

❌ Permission checks (NOT BUILT)
   - Impact: Cannot validate access
   - Risk: CRITICAL privacy violation
   - Effort: 6-8 hours

## RISK ASSESSMENT
Security: 🔴 CRITICAL (no auth)
Privacy: 🔴 CRITICAL (no user scoping)
Compliance: 🟠 HIGH (no audit trail)

## RECOMMENDATION
❌ DO NOT SHIP [feature] to production

REASON: Critical blockers prevent safe deployment

ACTION REQUIRED:
1. Complete Phase 1: Auth system (20-30h)
2. Integrate auth with features (12-16h)
3. Validate security & permissions (4-6h)
4. THEN ship to production

ROADMAP:
Phase 1 (Week 1-2): Auth foundation
Phase 2 (Week 3): Feature integration
Phase 3 (Week 4): Production deployment

Total timeline: 4-5 weeks to production-ready
```

---

## VALIDATION CHECKLIST

Agent must pass this checklist before any "ship" recommendation:

```
SECURITY VALIDATION:
[ ] Auth system exists and works
[ ] JWT tokens issued and validated
[ ] All routes protected with guards
[ ] Users cannot access other users' data
[ ] Role-based permissions enforced

DATA PRIVACY VALIDATION:
[ ] Data scoped to authenticated users
[ ] No global data access possible
[ ] Permission checks on all mutations
[ ] Sensitive data protected

COMPLIANCE VALIDATION:
[ ] User identification works
[ ] Audit trail for mutations
[ ] GDPR compliance possible

DEPLOYMENT READINESS:
[ ] All tests pass
[ ] No critical security risks
[ ] No critical blockers
[ ] Phase gates satisfied
```

If ANY checkbox is unchecked: **DO NOT RECOMMEND SHIPPING**

---

## EMERGENCY OVERRIDE

**Only for testing/staging environments:**

If user explicitly says "deploy to staging for testing only":

- Agent can recommend deployment WITH warnings
- Must clearly state: "STAGING ONLY - NOT PRODUCTION READY"
- Must list all production blockers

**Never override for production deployments.**
