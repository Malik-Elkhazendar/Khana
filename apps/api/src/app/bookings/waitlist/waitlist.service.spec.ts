import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLog, Facility, User, WaitingListEntry } from '@khana/data-access';
import { UserRole, WaitlistStatus } from '@khana/shared-dtos';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  let service: WaitlistService;

  const tenantId = 'tenant-1';
  const facilityId = 'facility-1';
  const userId = 'user-1';
  const createFutureSlotWindow = () => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  };
  const { start: startTime, end: endTime } = createFutureSlotWindow();

  const waitlistRepository = {
    manager: {
      transaction: jest.fn(),
    },
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const bookingRepository = {
    createQueryBuilder: jest.fn(),
  };

  const facilityRepository = {
    findOne: jest.fn(),
  };

  const userRepository = {
    findOne: jest.fn(),
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const emailService = {
    sendWaitlistSlotAvailableEmail: jest.fn(),
  };

  const whatsAppService = {
    sendWaitlistSlotAvailable: jest.fn(),
  };

  const auditRepository = {
    create: jest.fn((payload: unknown) => payload),
    save: jest.fn(),
  };

  const createCountQueryBuilder = (count: number) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ count: String(count) }),
  });

  const createBookingConflictQueryBuilder = (count: number) => ({
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
  });

  const createListQueryBuilder = (
    entries: WaitingListEntry[],
    total: number
  ) => {
    const builder = {
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([entries, total]),
      getRawMany: jest.fn().mockResolvedValue([
        { status: WaitlistStatus.WAITING, count: '2' },
        { status: WaitlistStatus.NOTIFIED, count: '1' },
      ]),
      getRawOne: jest.fn().mockResolvedValue({ count: '1' }),
      clone: jest.fn(),
    };
    builder.clone.mockReturnValue(builder);
    return builder;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    facilityRepository.findOne.mockResolvedValue({
      id: facilityId,
      name: 'Court A',
      tenant: { id: tenantId },
    } as Facility);

    waitlistRepository.manager.transaction.mockImplementation(
      async (
        cb: (manager: {
          getRepository: (entity: unknown) => unknown;
        }) => unknown
      ) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === WaitingListEntry) return waitlistRepository;
            if (entity === AuditLog) return auditRepository;
            return null;
          },
        })
    );

    waitlistRepository.createQueryBuilder.mockReturnValue(
      createCountQueryBuilder(1)
    );
    bookingRepository.createQueryBuilder.mockReturnValue(
      createBookingConflictQueryBuilder(1)
    );
    waitlistRepository.create.mockImplementation((payload: unknown) => payload);
    waitlistRepository.save.mockImplementation(
      async (payload: Partial<WaitingListEntry>) => ({
        id: 'waitlist-1',
        createdAt: new Date('2026-03-01T12:00:00.000Z'),
        ...payload,
      })
    );

    service = new WaitlistService(
      waitlistRepository as never,
      bookingRepository as never,
      facilityRepository as never,
      userRepository as never,
      appLogger as never,
      emailService as never,
      whatsAppService as never
    );
  });

  describe('joinWaitlist', () => {
    it('creates waitlist entry and returns queue position for unavailable slot', async () => {
      waitlistRepository.findOne.mockResolvedValue(null);

      const result = await service.joinWaitlist(
        {
          facilityId,
          desiredTimeSlot: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(result.entryId).toBe('waitlist-1');
      expect(result.status).toBe(WaitlistStatus.WAITING);
      expect(result.queuePosition).toBe(1);
      expect(waitlistRepository.save).toHaveBeenCalled();
      expect(auditRepository.save).toHaveBeenCalled();
    });

    it('rejects join for viewer role', async () => {
      await expect(
        service.joinWaitlist(
          {
            facilityId,
            desiredTimeSlot: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
          },
          tenantId,
          { id: userId, role: UserRole.VIEWER } as User
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns existing active entry idempotently', async () => {
      waitlistRepository.findOne.mockResolvedValue({
        id: 'waitlist-existing',
        status: WaitlistStatus.WAITING,
        facilityId,
        desiredStartTime: startTime,
        desiredEndTime: endTime,
        createdAt: new Date('2026-03-01T08:00:00.000Z'),
      } as WaitingListEntry);

      const result = await service.joinWaitlist(
        {
          facilityId,
          desiredTimeSlot: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(result.entryId).toBe('waitlist-existing');
      expect(waitlistRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when slot is available', async () => {
      bookingRepository.createQueryBuilder.mockReturnValue(
        createBookingConflictQueryBuilder(0)
      );

      await expect(
        service.joinWaitlist(
          {
            facilityId,
            desiredTimeSlot: {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            },
          },
          tenantId,
          { id: userId, role: UserRole.STAFF } as User
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatus', () => {
    it('returns active waitlist status and queue position', async () => {
      waitlistRepository.findOne
        .mockResolvedValueOnce({
          id: 'waitlist-1',
          status: WaitlistStatus.WAITING,
          facilityId,
          desiredStartTime: startTime,
          desiredEndTime: endTime,
          createdAt: new Date('2026-03-01T09:00:00.000Z'),
        } as WaitingListEntry)
        .mockResolvedValueOnce(null);
      waitlistRepository.createQueryBuilder.mockReturnValue(
        createCountQueryBuilder(2)
      );

      const status = await service.getStatus(
        {
          facilityId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(status).toEqual({
        isOnWaitlist: true,
        entryId: 'waitlist-1',
        status: WaitlistStatus.WAITING,
        queuePosition: 2,
      });
    });

    it('normalizes invalid active queue positions to one', async () => {
      waitlistRepository.findOne.mockReset();
      waitlistRepository.findOne.mockResolvedValue({
        id: 'waitlist-1',
        status: WaitlistStatus.WAITING,
        facilityId,
        desiredStartTime: startTime,
        desiredEndTime: endTime,
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
      } as WaitingListEntry);
      waitlistRepository.createQueryBuilder.mockReturnValue(
        createCountQueryBuilder(0)
      );

      const status = await service.getStatus(
        {
          facilityId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(status).toEqual({
        isOnWaitlist: true,
        entryId: 'waitlist-1',
        status: WaitlistStatus.WAITING,
        queuePosition: 1,
      });
    });

    it('returns false when user is not on waitlist', async () => {
      waitlistRepository.findOne.mockResolvedValue(null);

      const status = await service.getStatus(
        {
          facilityId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(status).toEqual({ isOnWaitlist: false });
    });
  });

  describe('listEntries', () => {
    it('returns paginated waitlist entries and summary counts', async () => {
      const entry = {
        id: 'waitlist-list-1',
        facilityId,
        userId,
        status: WaitlistStatus.WAITING,
        desiredStartTime: startTime,
        desiredEndTime: endTime,
        createdAt: new Date('2026-03-01T06:00:00.000Z'),
        notifiedAt: null,
        expiredAt: null,
        fulfilledByBookingId: null,
        facility: { id: facilityId, name: 'Court A' },
        user: { id: userId, name: 'Agent', email: 'agent@khana.dev' },
      } as unknown as WaitingListEntry;
      const listQueryBuilder = createListQueryBuilder([entry], 1);
      const summaryQueryBuilder = createListQueryBuilder([], 0);
      waitlistRepository.createQueryBuilder
        .mockReturnValueOnce(listQueryBuilder)
        .mockReturnValueOnce(createCountQueryBuilder(1))
        .mockReturnValue(summaryQueryBuilder);

      const result = await service.listEntries(
        {
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-15T00:00:00.000Z',
          page: 1,
          pageSize: 20,
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(result.total).toBe(1);
      expect(result.items[0]?.entryId).toBe('waitlist-list-1');
      expect(result.summary.waiting).toBe(2);
      expect(result.summary.notified).toBe(1);
    });

    it('normalizes invalid active queue positions to one in list items', async () => {
      const entry = {
        id: 'waitlist-list-1',
        facilityId,
        userId,
        status: WaitlistStatus.WAITING,
        desiredStartTime: startTime,
        desiredEndTime: endTime,
        createdAt: new Date('2026-03-01T06:00:00.000Z'),
        notifiedAt: null,
        expiredAt: null,
        fulfilledByBookingId: null,
        facility: { id: facilityId, name: 'Court A' },
        user: { id: userId, name: 'Agent', email: 'agent@khana.dev' },
      } as unknown as WaitingListEntry;
      const listQueryBuilder = createListQueryBuilder([entry], 1);
      const summaryQueryBuilder = createListQueryBuilder([], 0);
      waitlistRepository.createQueryBuilder
        .mockReturnValueOnce(listQueryBuilder)
        .mockReturnValueOnce(createCountQueryBuilder(0))
        .mockReturnValue(summaryQueryBuilder);

      const result = await service.listEntries(
        {
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-15T00:00:00.000Z',
          page: 1,
          pageSize: 20,
        },
        tenantId,
        { id: userId, role: UserRole.STAFF } as User
      );

      expect(result.items[0]?.queuePosition).toBe(1);
    });
  });

  describe('notifyNextForSlot', () => {
    it('returns notified false when queue has no candidate', async () => {
      const notifySpy = jest
        .spyOn(service, 'notifyFirstForSlot')
        .mockResolvedValue({ notified: false });

      const result = await service.notifyNextForSlot(
        {
          facilityId,
          desiredStartTime: startTime.toISOString(),
          desiredEndTime: endTime.toISOString(),
        },
        tenantId,
        { id: userId, role: UserRole.MANAGER } as User
      );

      expect(result).toEqual({ notified: false });
      expect(notifySpy).toHaveBeenCalled();
    });

    it('blocks staff role from manual notify action', async () => {
      await expect(
        service.notifyNextForSlot(
          {
            facilityId,
            desiredStartTime: startTime.toISOString(),
            desiredEndTime: endTime.toISOString(),
          },
          tenantId,
          { id: userId, role: UserRole.STAFF } as User
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('expireEntry', () => {
    it('expires an active waitlist entry', async () => {
      const expireCandidate = {
        id: 'waitlist-expire-1',
        status: WaitlistStatus.WAITING,
        expiredAt: null,
      } as unknown as WaitingListEntry;

      const expireQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(expireCandidate),
      };

      waitlistRepository.manager.transaction.mockImplementationOnce(
        async (
          cb: (manager: {
            getRepository: (entity: unknown) => unknown;
          }) => unknown
        ) =>
          cb({
            getRepository: (entity: unknown) => {
              if (entity === WaitingListEntry) {
                return {
                  createQueryBuilder: jest
                    .fn()
                    .mockReturnValue(expireQueryBuilder),
                  save: jest.fn().mockResolvedValue({
                    ...expireCandidate,
                    status: WaitlistStatus.EXPIRED,
                    expiredAt: new Date('2026-03-01T12:00:00.000Z'),
                  }),
                };
              }
              if (entity === AuditLog) return auditRepository;
              return null;
            },
          })
      );

      const result = await service.expireEntry('waitlist-expire-1', tenantId, {
        id: userId,
        role: UserRole.OWNER,
      } as User);

      expect(result.entryId).toBe('waitlist-expire-1');
      expect(result.status).toBe(WaitlistStatus.EXPIRED);
    });
  });
});
