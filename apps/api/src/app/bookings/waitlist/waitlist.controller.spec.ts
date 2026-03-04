import { User } from '@khana/data-access';
import { UserRole, WaitlistStatus } from '@khana/shared-dtos';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let service: jest.Mocked<WaitlistService>;

  const tenantId = 'tenant-1';
  const user = {
    id: 'user-1',
    role: UserRole.OWNER,
  } as User;

  beforeEach(() => {
    service = {
      joinWaitlist: jest.fn(),
      getStatus: jest.fn(),
      listEntries: jest.fn(),
      notifyNextForSlot: jest.fn(),
      expireEntry: jest.fn(),
    } as unknown as jest.Mocked<WaitlistService>;
    controller = new WaitlistController(service);
  });

  it('delegates joinWaitlist to service', async () => {
    const dto = {
      facilityId: 'facility-1',
      desiredTimeSlot: {
        startTime: '2026-03-01T10:00:00.000Z',
        endTime: '2026-03-01T11:00:00.000Z',
      },
    };
    service.joinWaitlist.mockResolvedValue({
      entryId: 'entry-1',
      status: WaitlistStatus.WAITING,
      queuePosition: 1,
      desiredTimeSlot: dto.desiredTimeSlot,
      createdAt: '2026-03-01T09:00:00.000Z',
    });

    const result = await controller.joinWaitlist(dto, tenantId, user);

    expect(service.joinWaitlist).toHaveBeenCalledWith(dto, tenantId, user);
    expect(result.entryId).toBe('entry-1');
  });

  it('delegates listWaitlistEntries to service', async () => {
    service.listEntries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      summary: { waiting: 0, notified: 0, expired: 0, fulfilled: 0 },
    });

    const result = await controller.listWaitlistEntries(
      {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-07T00:00:00.000Z',
      },
      tenantId,
      user
    );

    expect(service.listEntries).toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it('delegates notifyNext to service', async () => {
    service.notifyNextForSlot.mockResolvedValue({
      notified: true,
      entryId: 'entry-1',
      status: WaitlistStatus.NOTIFIED,
    });

    const result = await controller.notifyNext(
      {
        facilityId: 'facility-1',
        desiredStartTime: '2026-03-01T10:00:00.000Z',
        desiredEndTime: '2026-03-01T11:00:00.000Z',
      },
      tenantId,
      user
    );

    expect(service.notifyNextForSlot).toHaveBeenCalled();
    expect(result.notified).toBe(true);
  });

  it('delegates expireEntry to service', async () => {
    service.expireEntry.mockResolvedValue({
      entryId: 'entry-1',
      status: WaitlistStatus.EXPIRED,
      expiredAt: '2026-03-01T12:00:00.000Z',
    });

    const result = await controller.expireEntry('entry-1', tenantId, user);

    expect(service.expireEntry).toHaveBeenCalledWith('entry-1', tenantId, user);
    expect(result.status).toBe(WaitlistStatus.EXPIRED);
  });
});
