import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let dataSource: jest.Mocked<DataSource>;
  const goalsService = {
    getGoalProgress: jest.fn().mockResolvedValue({
      period: {
        monthStart: '2026-02-01T00:00:00.000Z',
        monthEnd: '2026-02-28T23:59:59.999Z',
        timeZone: 'Asia/Riyadh',
      },
      revenue: { target: null, actual: 0, pct: null, reached: false },
      occupancy: { target: null, actual: 0, pct: null, reached: false },
    }),
    listMilestones: jest.fn().mockResolvedValue([]),
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    service = new AnalyticsService(
      dataSource,
      logger as never,
      goalsService as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('computes summary KPIs and period comparison', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          totalBookings: '10',
          totalCancellations: '2',
          totalRevenue: '4500',
        },
      ])
      .mockResolvedValueOnce([
        {
          totalBookings: '8',
          totalCancellations: '1',
          totalRevenue: '4000',
        },
      ]);

    const result = await service.getSummary(
      {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-10T23:59:59.999Z',
      },
      'tenant-1'
    );

    expect(result.totalBookings).toBe(10);
    expect(result.totalCancellations).toBe(2);
    expect(result.totalRevenue).toBe(4500);
    expect(result.cancellationRate).toBe(20);
    expect(result.avgBookingValue).toBe(450);
    expect(result.revenueComparison.currentPeriodValue).toBe(4500);
    expect(result.revenueComparison.previousPeriodValue).toBe(4000);
    expect(result.revenueComparison.percentageChange).toBe(12.5);
    expect(result.bookingsComparison.currentPeriodValue).toBe(10);
    expect(result.bookingsComparison.previousPeriodValue).toBe(8);
    expect(result.bookingsComparison.percentageChange).toBe(25);
  });

  it('rejects invalid date ranges', async () => {
    await expect(
      service.getSummary(
        {
          from: '2026-02-10T00:00:00.000Z',
          to: '2026-02-01T00:00:00.000Z',
        },
        'tenant-1'
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('returns occupancy grouped by facility with overall rate', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        facilityId: 'facility-a',
        facilityName: 'Court A',
        date: '2026-02-01',
        availableMinutes: '900',
        occupiedMinutes: '450',
        bookingCount: '4',
      },
      {
        facilityId: 'facility-a',
        facilityName: 'Court A',
        date: '2026-02-02',
        availableMinutes: '900',
        occupiedMinutes: '300',
        bookingCount: '3',
      },
    ]);

    const result = await service.getOccupancy(
      {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-02T23:59:59.999Z',
      },
      'tenant-1'
    );

    expect(result.facilities).toHaveLength(1);
    expect(result.facilities[0].facilityName).toBe('Court A');
    expect(result.facilities[0].occupiedMinutes).toBe(750);
    expect(result.facilities[0].availableMinutes).toBe(1800);
    expect(result.facilities[0].occupancyRate).toBeCloseTo(41.67, 2);
    expect(result.overallOccupancyRate).toBeCloseTo(41.67, 2);
  });

  it('returns revenue trend and facility performance', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          periodStart: '2026-02-01T00:00:00.000Z',
          periodLabel: '2026-02-01',
          bookings: '3',
          revenue: '900',
        },
      ])
      .mockResolvedValueOnce([
        {
          facilityId: 'facility-a',
          facilityName: 'Court A',
          totalBookings: '3',
          totalCancellations: '1',
          revenue: '900',
          occupancyRate: '50',
        },
      ]);

    const result = await service.getRevenue(
      {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-07T23:59:59.999Z',
        groupBy: 'day',
      },
      'tenant-1'
    );

    expect(result.groupBy).toBe('day');
    expect(result.trend).toHaveLength(1);
    expect(result.trend[0].revenue).toBe(900);
    expect(result.trend[0].bookings).toBe(3);
    expect(result.facilityPerformance).toHaveLength(1);
    expect(result.facilityPerformance[0].cancellationRate).toBeCloseTo(
      33.33,
      2
    );
  });

  it('returns deterministic peak hours and top facility', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        { hourOfDay: 19, bookingCount: 5 },
        { hourOfDay: 20, bookingCount: 4 },
        { hourOfDay: 10, bookingCount: 2 },
      ])
      .mockResolvedValueOnce([
        {
          facilityName: 'Court B',
          bookingCount: 6,
        },
      ]);

    const result = await service.getPeakHours(
      {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-07T23:59:59.999Z',
      },
      'tenant-1'
    );

    expect(result.peakTimeRange).toBe('19:00-21:00');
    expect(result.mostBookedFacility).toBe('Court B');
    expect(result.mostBookedCourt).toBeNull();
  });

  it('rejects unknown facility filters outside tenant scope', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await expect(
      service.getSummary(
        {
          from: '2026-02-01T00:00:00.000Z',
          to: '2026-02-02T23:59:59.999Z',
          facilityId: '11111111-1111-1111-1111-111111111111',
        },
        'tenant-1'
      )
    ).rejects.toThrow(NotFoundException);
  });
});
