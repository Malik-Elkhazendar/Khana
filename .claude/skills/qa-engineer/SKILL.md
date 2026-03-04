---
name: qa-engineer
description: >
  Testing and quality assurance for Khana: Jest unit tests for services and stores,
  Angular component tests, NestJS service tests, and Playwright E2E tests. Use when
  writing tests or reviewing test coverage for a feature.
# Claude Code extension:
disable-model-invocation: true
---

# QA Engineer — Testing & Quality Assurance

Implement tests and enforce quality gates for the Khana platform.

## Key References

- Architecture and test commands: `CLAUDE.md`
- Test scripts: `docs/current/scripts.md`
- Feature locations: `.claude/skills/project-index/SKILL.md`

---

## Test Locations

Tests live **next to** the file they test:

```
apps/api/src/app/bookings/
  bookings.service.ts
  bookings.service.spec.ts       ← service unit test

apps/manager-dashboard/src/app/features/booking-list/
  booking-list.component.ts
  booking-list.component.spec.ts ← component unit test

apps/manager-dashboard/src/app/state/bookings/
  booking.store.ts
  booking.store.spec.ts          ← store unit test

apps/api-e2e/src/api/
  api.spec.ts                    ← API integration tests

apps/manager-dashboard-e2e/src/
  *.e2e.spec.ts                  ← Playwright E2E tests
```

---

## NestJS Service Test Pattern

```ts
describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: jest.Mocked<Repository<Booking>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BookingService);
    bookingRepo = module.get(getRepositoryToken(Booking));
  });

  it('throws ForbiddenException when tenantId is missing', async () => {
    await expect(service.findAll('')).rejects.toThrow(ForbiddenException);
  });

  it('returns bookings filtered by tenantId', async () => {
    bookingRepo.find.mockResolvedValue([mockBooking]);
    const result = await service.findAll('tenant-123');
    expect(bookingRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-123' } }));
    expect(result).toHaveLength(1);
  });
});
```

---

## Angular Component Test Pattern

```ts
describe('BookingListComponent', () => {
  let component: BookingListComponent;
  let fixture: ComponentFixture<BookingListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingListComponent],
      providers: [
        { provide: BookingStore, useValue: mockBookingStore },
        { provide: ApiService, useValue: mockApiService },
        { provide: FacilityContextStore, useValue: mockFacilityContextStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the booking list', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="booking-list"]')).toBeTruthy();
  });

  it('should show loading state', () => {
    mockBookingStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="loading"]')).toBeTruthy();
  });
});
```

---

## SignalStore Test Pattern

```ts
describe('BookingStore', () => {
  let store: InstanceType<typeof BookingStore>;
  let mockApi: jest.Mocked<ApiService>;

  beforeEach(() => {
    mockApi = { getBookings: jest.fn() } as any;
    TestBed.configureTestingModule({
      providers: [BookingStore, { provide: ApiService, useValue: mockApi }],
    });
    store = TestBed.inject(BookingStore);
  });

  it('sets loading true then false on successful load', async () => {
    mockApi.getBookings.mockReturnValue(of([mockBooking]));
    store.loadBookings(null);
    await lastValueFrom(timer(0));
    expect(store.loading()).toBe(false);
    expect(store.bookings()).toHaveLength(1);
  });

  it('sets error on failed load', async () => {
    mockApi.getBookings.mockReturnValue(throwError(() => new Error('Network error')));
    store.loadBookings(null);
    await lastValueFrom(timer(0));
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });
});
```

---

## Playwright E2E Pattern

```ts
test.describe('Booking list', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager@tenant.com');
    await page.goto('/dashboard/bookings');
  });

  test('displays booking list', async ({ page }) => {
    await expect(page.getByTestId('booking-list')).toBeVisible();
  });

  test('filters by status', async ({ page }) => {
    await page.getByTestId('status-filter').selectOption('CONFIRMED');
    await expect(page.getByTestId('booking-row')).toHaveCount(2);
  });
});
```

E2E helpers live in `apps/manager-dashboard-e2e/src/helpers/`.

---

## Quality Gates

Every PR must pass:

```bash
npm run lint       # ESLint — zero errors
npm run test       # All unit tests pass
npm run build      # Build succeeds (both api and dashboard)
npm run check      # lint + test + build combined
```

Coverage target: **80%** for services and stores.

---

## Test Commands

```bash
npm run test                              # All affected tests
npm test -- --testPathPattern="booking"   # Specific pattern
npm test -- --testPathPattern="booking" --watch  # Watch mode
npm run test:all                          # Every project
npm run affected:test                     # Only changed projects
```

---

## Checklist: New Feature Tests

- [ ] Service unit test (NestJS): happy path + error cases + tenantId guard
- [ ] Store unit test (Angular): loading state + error state + success state
- [ ] Component smoke test: renders without crash, shows loading indicator
- [ ] E2E test for the critical user journey
- [ ] `npm run check` passes before PR

---

## Start

Tell me what to test (e.g., "analytics service", "waitlist store", "booking cancel flow E2E", "promo code component").
