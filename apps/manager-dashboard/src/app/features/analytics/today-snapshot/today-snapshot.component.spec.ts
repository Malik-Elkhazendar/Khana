import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserRole, WaitlistStatus } from '@khana/shared-dtos';
import { AuthStore } from '../../../shared/state/auth.store';
import { TodaySnapshotComponent } from './today-snapshot.component';

const EN_TRANSLATIONS = {
  DASHBOARD: {
    PAGES: {
      ANALYTICS: {
        SNAPSHOT: {
          TITLE: 'Today snapshot',
          GREETING_MORNING: 'Good morning, {{name}}',
          GREETING_AFTERNOON: 'Good afternoon, {{name}}',
          GREETING_EVENING: 'Good evening, {{name}}',
          GREETING_ANONYMOUS_MORNING: 'Good morning',
          GREETING_ANONYMOUS_AFTERNOON: 'Good afternoon',
          GREETING_ANONYMOUS_EVENING: 'Good evening',
          BOOKINGS_TODAY: 'Bookings today',
          EXPECTED_REVENUE: 'Expected revenue',
          UNPAID_BOOKINGS: '{{count}} unpaid ({{amount}})',
          EXPIRING_HOLDS: '{{count}} expiring holds',
          WAITLIST_WAITING: '{{count}} waiting in waitlist',
          NOTIFIED_NOT_CONVERTED: '{{count}} notified not converted',
          NO_SHOWS: '{{count}} no-shows',
          NO_URGENT_ITEMS: 'No urgent items for today ✓',
        },
      },
    },
  },
};

describe('TodaySnapshotComponent', () => {
  let fixture: ComponentFixture<TodaySnapshotComponent>;
  let component: TodaySnapshotComponent;
  let router: Router;

  const authStoreMock = {
    user: signal({
      id: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Ahmad Malik',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-04T08:00:00.000Z'));

    await TestBed.configureTestingModule({
      imports: [TodaySnapshotComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');

    fixture = TestBed.createComponent(TodaySnapshotComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('computes greeting and urgency state from snapshot', () => {
    fixture.componentRef.setInput('snapshot', {
      bookingsToday: 8,
      revenueToday: 1400,
      unpaidCount: 2,
      unpaidAmount: 320,
      expiringHoldsCount: 1,
      waitlistToday: 0,
      notifiedWaitlistCount: 0,
      noShowCount: 0,
    });
    fixture.detectChanges();

    expect(component.firstName()).toBe('Ahmad');
    expect(component.greetingPeriod()).toBe('MORNING');
    expect(component.hasUrgentItems()).toBe(true);
    expect(component.isAllClear()).toBe(false);
  });

  it('renders no-urgent state when only informational signals remain', () => {
    fixture.componentRef.setInput('snapshot', {
      bookingsToday: 4,
      revenueToday: 800,
      unpaidCount: 0,
      unpaidAmount: 0,
      expiringHoldsCount: 0,
      waitlistToday: 2,
      notifiedWaitlistCount: 0,
      noShowCount: 0,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No urgent items for today');
    expect(component.isAllClear()).toBe(true);
  });

  it('navigates to deep links for action badges', () => {
    component.goToUnpaidBookings();
    component.goToExpiringHolds();
    component.goToWaitlistWaiting();
    component.goToNotifiedWaitlist();
    component.goToNoShows();

    expect(router.navigate).toHaveBeenNthCalledWith(
      1,
      ['/dashboard/bookings'],
      {
        queryParams: { paymentStatus: 'PENDING' },
      }
    );
    expect(router.navigate).toHaveBeenNthCalledWith(
      2,
      ['/dashboard/bookings'],
      {
        queryParams: { status: 'PENDING' },
      }
    );
    expect(router.navigate).toHaveBeenNthCalledWith(
      3,
      ['/dashboard/waitlist'],
      {
        queryParams: { date: 'today' },
      }
    );
    expect(router.navigate).toHaveBeenNthCalledWith(
      4,
      ['/dashboard/waitlist'],
      {
        queryParams: { status: WaitlistStatus.NOTIFIED },
      }
    );
    expect(router.navigate).toHaveBeenNthCalledWith(
      5,
      ['/dashboard/bookings'],
      {
        queryParams: { status: 'NO_SHOW' },
      }
    );
  });

  it('renders loading skeleton while snapshot is loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector(
      '.today-snapshot__skeleton'
    );
    expect(skeleton).toBeTruthy();
  });

  it('keeps native button semantics for action items', () => {
    fixture.componentRef.setInput('snapshot', {
      bookingsToday: 6,
      revenueToday: 900,
      unpaidCount: 1,
      unpaidAmount: 120,
      expiringHoldsCount: 1,
      waitlistToday: 1,
      notifiedWaitlistCount: 1,
      noShowCount: 1,
    });
    fixture.detectChanges();

    const actionContainer = fixture.nativeElement.querySelector(
      '.today-snapshot__actions'
    ) as HTMLElement;
    const actions = Array.from(
      fixture.nativeElement.querySelectorAll('.today-snapshot__action')
    ) as HTMLElement[];

    expect(actionContainer.getAttribute('role')).toBeNull();
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.getAttribute('role')).toBeNull();
    }
  });
});
