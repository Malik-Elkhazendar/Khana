import { expect, Page, test } from '@playwright/test';
import { ConflictType, WaitlistStatus } from '@khana/shared-dtos';
import { mockAuthRoutes, seedSessionTokens } from './fixtures/auth.fixtures';

const FACILITY = {
  id: 'facility-1',
  name: 'Court A',
  openTime: '08:00',
  closeTime: '22:00',
  slotDurationMinutes: 60,
  basePrice: 180,
  currency: 'SAR',
};

type WaitlistTestSlot = {
  dateInput: string;
  startIso: string;
  endIso: string;
};

function createFutureSlot(dayOffset: number): WaitlistTestSlot {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(10, 0, 0, 0);

  const end = new Date(start);
  end.setHours(11, 0, 0, 0);

  return {
    dateInput: formatDateInput(start),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildWaitlistListResponse(
  slot: WaitlistTestSlot,
  requestUrl: string
): {
  items: Array<{
    entryId: string;
    facilityId: string;
    facilityName: string;
    userId: string;
    userName: string;
    userEmail: string;
    desiredStartTime: string;
    desiredEndTime: string;
    status: WaitlistStatus;
    queuePosition: number;
    createdAt: string;
    notifiedAt: null;
    expiredAt: null;
    fulfilledByBookingId: null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  summary: {
    waiting: number;
    notified: number;
    expired: number;
    fulfilled: number;
  };
} {
  const url = new URL(requestUrl);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const facilityId = url.searchParams.get('facilityId');
  const status = url.searchParams.get('status');
  const slotStartMs = Date.parse(slot.startIso);
  const rangeStartMs = from ? Date.parse(from) : Number.NaN;
  const rangeEndMs = to ? Date.parse(to) : Number.NaN;

  const matchesRange =
    !Number.isNaN(rangeStartMs) &&
    !Number.isNaN(rangeEndMs) &&
    slotStartMs >= rangeStartMs &&
    slotStartMs <= rangeEndMs;
  const matchesFacility = !facilityId || facilityId === FACILITY.id;
  const matchesStatus = !status || status === WaitlistStatus.WAITING;

  const items =
    matchesRange && matchesFacility && matchesStatus
      ? [
          {
            entryId: 'entry-1',
            facilityId: FACILITY.id,
            facilityName: FACILITY.name,
            userId: 'user-123',
            userName: 'Test User',
            userEmail: 'test@example.com',
            desiredStartTime: slot.startIso,
            desiredEndTime: slot.endIso,
            status: WaitlistStatus.WAITING,
            queuePosition: 1,
            createdAt: new Date(slotStartMs - 60 * 60 * 1000).toISOString(),
            notifiedAt: null,
            expiredAt: null,
            fulfilledByBookingId: null,
          },
        ]
      : [];

  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    summary: {
      waiting: items.length,
      notified: 0,
      expired: 0,
      fulfilled: 0,
    },
  };
}

async function mockWaitlistRoutes(
  page: Page,
  slot: WaitlistTestSlot
): Promise<void> {
  await page.route('**/api/v1/bookings/facilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([FACILITY]),
    });
  });

  await page.route('**/api/v1/bookings/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        canBook: false,
        priceBreakdown: {
          basePrice: FACILITY.basePrice,
          timeMultiplier: 1,
          dayMultiplier: 1,
          durationDiscount: 0,
          subtotal: FACILITY.basePrice,
          discountAmount: 0,
          total: FACILITY.basePrice,
          currency: FACILITY.currency,
        },
        conflict: {
          hasConflict: true,
          conflictType: ConflictType.EXACT_OVERLAP,
          message: 'This exact time slot is already booked.',
          conflictingSlots: [
            {
              startTime: slot.startIso,
              endTime: slot.endIso,
              status: 'BOOKED',
              bookingReference: 'KHN-E2E001',
            },
          ],
        },
      }),
    });
  });

  await page.route(
    /\/api\/v1\/bookings\/waitlist\/status(?:\?.*)?$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isOnWaitlist: true,
          entryId: 'entry-1',
          status: WaitlistStatus.WAITING,
          queuePosition: 1,
        }),
      });
    }
  );

  await page.route(/\/api\/v1\/bookings\/waitlist(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildWaitlistListResponse(slot, route.request().url())
      ),
    });
  });
}

test.describe('Waitlist Operations Contract', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthRoutes(page);
    await seedSessionTokens(page);
  });

  test('direct waitlist navigation shows upcoming operational activity', async ({
    page,
  }) => {
    const slot = createFutureSlot(10);
    await mockWaitlistRoutes(page, slot);

    await page.goto('/dashboard/new');
    await expect(page).toHaveURL(/\/dashboard\/new$/);

    await page
      .locator('.sidebar__nav-link[href="/dashboard/waitlist"]')
      .click();

    await expect(page).toHaveURL(/\/dashboard\/waitlist$/);
    await expect(page.getByTestId('waitlist-upcoming')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Operations Report/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Summary cards reflect the current filters/i)
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Test User' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Court A' })).toBeVisible();
  });

  test('booking preview opens waitlist report with slot context', async ({
    page,
  }) => {
    const slot = createFutureSlot(10);
    await mockWaitlistRoutes(page, slot);

    await page.goto('/dashboard/new');
    await expect(page).toHaveURL(/\/dashboard\/new$/);

    await page.locator('#date').fill(slot.dateInput);
    await page.locator('#startTime').fill('10:00');
    await page.locator('#endTime').fill('11:00');
    await page.getByRole('button', { name: /Check Availability/i }).click();

    await expect(page.getByTestId('booking-preview-waitlist')).toBeVisible();
    await expect(
      page.getByTestId('booking-preview-waitlist-waiting')
    ).toContainText('position #1');

    await page
      .getByRole('button', { name: /View queue for this slot/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/waitlist\?/);
    await expect(page.getByTestId('waitlist-slot-context')).toBeVisible();
    const contextRow = page.getByTestId('waitlist-context-row');
    await expect(contextRow).toBeVisible();
    await expect(
      contextRow.getByRole('cell', { name: 'Test User' })
    ).toBeVisible();

    const url = new URL(page.url());
    expect(url.searchParams.get('facilityId')).toBe(FACILITY.id);
    expect(url.searchParams.get('status')).toBe(WaitlistStatus.WAITING);
    expect(url.searchParams.get('source')).toBe('booking-preview');
    expect(url.searchParams.get('slotStart')).toBeTruthy();
    expect(url.searchParams.get('slotEnd')).toBeTruthy();
  });
});
