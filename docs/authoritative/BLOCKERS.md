# Blocker Matrix & Dependency Tracking

**Status**: ACTIVE
**Last Updated**: 2026-01-06
**Purpose**: Track what blocks what and identify critical path

---

## CRITICAL BLOCKERS (Stop Everything)

### 🔴 BLOCKER 1: Authentication System

**Status**: ❌ NOT BUILT
**Priority**: CRITICAL
**Effort**: 20-30 hours
**Blocking**: ALL user-facing features

**What's Missing**:

- [ ] @nestjs/passport package
- [ ] @nestjs/jwt package
- [ ] bcrypt package
- [ ] User entity in database
- [ ] JWT strategy implementation
- [ ] Auth module (login/logout endpoints)
- [ ] Auth guards (JwtAuthGuard)
- [ ] Password hashing service

**Blocks These Features**:

1. booking-calendar (cannot ship without auth)
2. booking-preview (cannot ship without auth)
3. booking-list (cannot ship without auth)
4. User profile page (cannot build)
5. Admin dashboard (cannot build)
6. Any user-specific feature (cannot build)

**Impact if NOT Resolved**:

- 🔴 CRITICAL: Cannot deploy to production
- 🔴 CRITICAL: No user identification possible
- 🔴 CRITICAL: Data privacy violation
- 🔴 CRITICAL: Security vulnerability

**Resolution Checklist**:

```
✅ Install auth packages
✅ Create User entity
✅ Implement JWT strategy
✅ Create login/logout endpoints
✅ Add auth guards to routes
✅ Test auth flow end-to-end
✅ Verify tokens work
✅ Verify guards block unauthorized access
```

**Who Can Resolve**: Backend developer with NestJS experience
**When to Resolve**: IMMEDIATELY (blocks everything)

---

### 🔴 BLOCKER 2: User Database & Identification

**Status**: ⚠️ PARTIAL (User DTO exists, but no User entity/table)
**Priority**: CRITICAL
**Effort**: 8-10 hours
**Blocking**: All data scoping, multi-tenancy

**What Exists**:

- ✅ User DTO (`libs/shared-dtos/src/lib/dtos/user.dto.ts`)
- ✅ UserRole enum

**What's Missing**:

- [ ] User entity with TypeORM
- [ ] User database table
- [ ] User repository
- [ ] User service (CRUD operations)
- [ ] User-to-booking relationship
- [ ] User-to-facility relationship

**Blocks These Features**:

1. User-scoped bookings (cannot filter by user)
2. Multi-tenant safety (users can see each other's data)
3. Ownership validation (cannot check who owns what)
4. Audit trail (cannot track who did what)

**Impact if NOT Resolved**:

- 🔴 CRITICAL: Data privacy violation
- 🔴 CRITICAL: Users see other users' bookings
- 🔴 CRITICAL: Cannot comply with GDPR
- 🟠 HIGH: No audit trail for compliance

**Resolution Checklist**:

```
✅ Create User entity with TypeORM
✅ Run migration to create users table
✅ Create UserRepository
✅ Implement user CRUD service
✅ Add foreign key: booking.userId
✅ Test user-scoped queries
✅ Verify data isolation
```

---

### 🔴 BLOCKER 3: Permission & Authorization System

**Status**: ❌ NOT BUILT
**Priority**: CRITICAL
**Effort**: 6-8 hours
**Blocking**: Role-based access control

**What's Missing**:

- [ ] Role-based guards (RolesGuard)
- [ ] Permission decorators (@Roles, @RequirePermission)
- [ ] Permission validation middleware
- [ ] Role assignment logic
- [ ] Permission checking service

**Blocks These Features**:

1. Admin-only features (cannot restrict access)
2. Manager-only features (cannot validate roles)
3. Feature-specific permissions (cannot check)
4. Action-level permissions (cannot validate)

**Impact if NOT Resolved**:

- 🔴 CRITICAL: No role-based access control
- 🟠 HIGH: Users can access admin features
- 🟠 HIGH: Facility managers can access other facilities

**Resolution Checklist**:

```
✅ Create RolesGuard
✅ Create @Roles decorator
✅ Create permission middleware
✅ Implement role validation logic
✅ Add roles to User entity
✅ Test role restrictions
✅ Verify unauthorized access blocked
```

---

## HIGH-PRIORITY BLOCKERS

### 🟠 BLOCKER 4: Audit Logging System

**Status**: ❌ NOT BUILT
**Priority**: HIGH (compliance requirement)
**Effort**: 4-6 hours
**Blocking**: Production compliance

**What's Missing**:

- [ ] AuditLog entity
- [ ] Audit log table
- [ ] Audit logging interceptor
- [ ] Mutation tracking (create/update/delete)
- [ ] Audit log retrieval API

**Blocks These Features**:

1. GDPR compliance (cannot track who did what)
2. Debugging (cannot see change history)
3. Compliance reporting (cannot generate audit reports)

**Impact if NOT Resolved**:

- 🟠 HIGH: Cannot comply with regulations
- 🟠 HIGH: No change history
- 🟡 MEDIUM: Difficult debugging

---

### 🟠 BLOCKER 5: Environment Configuration

**Status**: ⚠️ PARTIAL (hardcoded localhost:3000)
**Priority**: HIGH
**Effort**: 2-3 hours
**Blocking**: Production deployment

**What Exists**:

- ✅ Hardcoded API URL in `api.service.ts`

**What's Missing**:

- [ ] Environment variable support
- [ ] environment.ts files
- [ ] Production API URL config
- [ ] Staging API URL config

**Resolution**: Per ADR-0004, implement environment-based API URL configuration

---

## MEDIUM-PRIORITY BLOCKERS

### 🟡 BLOCKER 6: Payment Gateway Integration

**Status**: ❌ NOT BUILT (Future Phase 2)
**Priority**: MEDIUM (future feature)
**Effort**: 8-10 hours
**Blocking**: Payment features

**What Exists**:

- ✅ PaymentStatus enum

**What's Missing**:

- [ ] Payment gateway SDK (Stripe/Tap/Mada)
- [ ] Payment service
- [ ] Payment endpoints
- [ ] Refund logic
- [ ] Webhook handling

**Blocks**: Premium features requiring payment

---

### 🟡 BLOCKER 7: Email Notification System

**Status**: ❌ NOT BUILT (Future Phase 3)
**Priority**: MEDIUM (nice-to-have)
**Effort**: 4-6 hours
**Blocking**: Automated notifications

**What's Missing**:

- [ ] Email service provider (SendGrid/AWS SES)
- [ ] Email templates
- [ ] Notification service
- [ ] Booking confirmation emails
- [ ] Payment receipt emails

**Blocks**: Automated user communications

---

## DEPENDENCY GRAPH

```
Authentication System (BLOCKER 1)
├─ Blocks: User Database (BLOCKER 2)
│  ├─ Blocks: booking-calendar (auth integration)
│  ├─ Blocks: booking-preview (auth integration)
│  └─ Blocks: booking-list (auth integration)
│
├─ Blocks: Permission System (BLOCKER 3)
│  ├─ Blocks: Admin features
│  └─ Blocks: Manager features
│
└─ Blocks: Audit Logging (BLOCKER 4)
   └─ Blocks: Compliance reporting

Environment Config (BLOCKER 5)
└─ Blocks: Production deployment

Payment Gateway (BLOCKER 6)
└─ Blocks: Payment features

Email System (BLOCKER 7)
└─ Blocks: Automated notifications
```

---

## BLOCKER RESOLUTION SEQUENCE (Critical Path)

**Week 1-2: Resolve Critical Blockers**

1. Build Authentication System (20-30h)
   - Unblocks: User Database, Permission System
2. Build User Database (8-10h)
   - Unblocks: User-scoped features
3. Build Permission System (6-8h)
   - Unblocks: Role-based features
4. Build Audit Logging (4-6h)
   - Unblocks: Compliance

**Week 3: Feature Integration** 5. Integrate auth with booking-calendar (4-5h) 6. Integrate auth with booking-preview (3-4h) 7. Integrate auth with booking-list (3-4h) 8. Add environment configuration (2-3h)

**Week 4-5: Advanced Features (Optional)** 9. Add payment gateway (8-10h) 10. Add email notifications (4-6h)

**Total Critical Path**: 40-50 hours

---

## BLOCKER VALIDATION CHECKLIST

Before agent recommends "ship", verify:

```
CRITICAL BLOCKERS RESOLVED:
[ ] Authentication system built and working
[ ] User database exists and populated
[ ] Permission system enforcing roles
[ ] Audit logging capturing mutations

HIGH-PRIORITY BLOCKERS RESOLVED:
[ ] Environment configuration working
[ ] Production API URL configured

OPTIONAL BLOCKERS:
[ ] Payment gateway (if payments needed)
[ ] Email system (if notifications needed)
```

**If ANY critical blocker unchecked**: DO NOT SHIP

---

## BLOCKER IMPACT MATRIX

| Blocker            | Features Affected      | Users Impacted   | Risk Level  |
| ------------------ | ---------------------- | ---------------- | ----------- |
| Auth System        | ALL features           | ALL users        | 🔴 CRITICAL |
| User Database      | ALL data access        | ALL users        | 🔴 CRITICAL |
| Permissions        | Admin/Manager features | Privileged users | 🔴 CRITICAL |
| Audit Logging      | Compliance             | Business/Legal   | 🟠 HIGH     |
| Environment Config | Deployment             | DevOps           | 🟠 HIGH     |
| Payment Gateway    | Payments               | Paying users     | 🟡 MEDIUM   |
| Email System       | Notifications          | ALL users        | 🟡 MEDIUM   |

---

## WHEN IS A BLOCKER CONSIDERED "RESOLVED"?

**Resolution Criteria**:

1. ✅ All checklist items complete
2. ✅ Tests written and passing
3. ✅ Code reviewed and approved
4. ✅ Documentation updated
5. ✅ Integration tested
6. ✅ Security validated (if applicable)
7. ✅ Performance acceptable

**Verification**:

- Run: `npm run test` (all tests pass)
- Run: `npm run lint` (no violations)
- Run: `npx tsc --noEmit` (no type errors)
- Manual: Test actual feature works end-to-end
