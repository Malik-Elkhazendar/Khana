import { User } from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<DashboardService>;

  beforeEach(() => {
    service = {
      getTodaySnapshot: jest.fn(),
    } as unknown as jest.Mocked<DashboardService>;

    controller = new DashboardController(service);
  });

  it('delegates today snapshot request to service', async () => {
    const tenantId = 'tenant-1';
    const facilityId = 'facility-1';
    const user = {
      id: 'user-1',
      role: UserRole.OWNER,
    } as User;

    service.getTodaySnapshot.mockResolvedValue({
      bookingsToday: 6,
      revenueToday: 1250,
      unpaidCount: 1,
      unpaidAmount: 250,
      expiringHoldsCount: 2,
      waitlistToday: 3,
      notifiedWaitlistCount: 1,
      noShowCount: 1,
    });

    const result = await controller.getTodaySnapshot(
      tenantId,
      user,
      facilityId
    );

    expect(service.getTodaySnapshot).toHaveBeenCalledWith(tenantId, facilityId);
    expect(result.revenueToday).toBe(1250);
  });
});
