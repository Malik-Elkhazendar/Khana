import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Facility, User } from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';
import { FacilitiesService } from './facilities.service';
import { CreateFacilityDto, UpdateFacilityDto } from './dto';
import { FacilitiesMutationService } from './internal/facilities.mutation.service';
import { FacilitiesQueryService } from './internal/facilities.query.service';

describe('FacilitiesService', () => {
  const tenantId = 'tenant-1';
  const now = new Date('2026-02-01T10:00:00.000Z');

  let service: FacilitiesService;
  let queryService: FacilitiesQueryService;
  let mutationService: FacilitiesMutationService;
  let facilityRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const ownerUser = {
    id: 'owner-1',
    role: UserRole.OWNER,
    tenantId,
  } as unknown as User;

  const staffUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    tenantId,
  } as unknown as User;

  const buildFacility = (
    overrides: Partial<Facility> = {},
    id = 'facility-1'
  ): Facility => {
    return {
      id,
      name: 'Court 1',
      type: 'PADEL_COURT',
      isActive: true,
      config: {
        pricePerHour: 200,
        openTime: '08:00',
        closeTime: '23:00',
      },
      tenant: { id: tenantId } as never,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as unknown as Facility;
  };

  beforeEach(() => {
    facilityRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((payload: Partial<Facility>) =>
        buildFacility(payload, 'facility-new')
      ),
      save: jest.fn(async (payload: Partial<Facility>) => ({
        ...payload,
        tenant: payload.tenant ?? { id: tenantId },
        createdAt: payload.createdAt ?? now,
        updatedAt: now,
      })),
    };

    auditLogRepository = {
      create: jest.fn((payload: Record<string, unknown>) => payload),
      save: jest.fn(async (payload: Record<string, unknown>) => payload),
    };

    queryService = new FacilitiesQueryService(facilityRepository as never);
    mutationService = new FacilitiesMutationService(
      facilityRepository as never,
      auditLogRepository as never,
      appLogger as never
    );
    service = new FacilitiesService(queryService, mutationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists active facilities only for staff even when includeInactive=true', async () => {
    const activeFacility = buildFacility();
    facilityRepository.find.mockResolvedValue([activeFacility]);

    const result = await service.listFacilities(tenantId, staffUser, true);

    expect(facilityRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant: { id: tenantId }, isActive: true },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(activeFacility.id);
  });

  it('lists all facilities for owner when includeInactive=true', async () => {
    const activeFacility = buildFacility();
    const inactiveFacility = buildFacility(
      { name: 'Court 2', isActive: false },
      'facility-2'
    );
    facilityRepository.find.mockResolvedValue([
      activeFacility,
      inactiveFacility,
    ]);

    const result = await service.listFacilities(tenantId, ownerUser, true);

    expect(facilityRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant: { id: tenantId } },
      })
    );
    expect(result).toHaveLength(2);
  });

  it('creates facility for owner and writes audit log', async () => {
    const dto: CreateFacilityDto = {
      name: 'Court 7',
      type: 'PADEL_COURT',
      config: {
        pricePerHour: 275,
        openTime: '09:00',
        closeTime: '22:00',
      },
    };

    const result = await service.createFacility(dto, tenantId, ownerUser);

    expect(facilityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Court 7',
        type: 'PADEL_COURT',
        isActive: true,
      })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId: ownerUser.id,
        action: AuditAction.CREATE,
        entityType: 'Facility',
      })
    );
    expect(result.name).toBe('Court 7');
  });

  it('rejects create for staff role', async () => {
    const dto: CreateFacilityDto = {
      name: 'Court 5',
      type: 'PADEL_COURT',
      config: {
        pricePerHour: 190,
        openTime: '08:00',
        closeTime: '23:00',
      },
    };

    await expect(
      service.createFacility(dto, tenantId, staffUser)
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates a facility config and writes audit log', async () => {
    const activeFacility = buildFacility();
    facilityRepository.findOne.mockResolvedValue(activeFacility);

    const dto: UpdateFacilityDto = {
      config: { pricePerHour: 320 },
      isActive: false,
    };

    const result = await service.updateFacility(
      activeFacility.id,
      dto,
      tenantId,
      ownerUser
    );

    expect(facilityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: activeFacility.id,
        isActive: false,
        config: expect.objectContaining({ pricePerHour: 320 }),
      })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityId: activeFacility.id,
      })
    );
    expect(result.isActive).toBe(false);
    expect(result.config.pricePerHour).toBe(320);
  });

  it('deactivates an active facility and writes delete audit log', async () => {
    const activeFacility = buildFacility();
    facilityRepository.findOne.mockResolvedValue({ ...activeFacility });

    const result = await service.deactivateFacility(
      activeFacility.id,
      tenantId,
      ownerUser
    );

    expect(facilityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: activeFacility.id, isActive: false })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        entityId: activeFacility.id,
      })
    );
    expect(result.isActive).toBe(false);
  });

  it('hides inactive facility detail from staff', async () => {
    const inactiveFacility = buildFacility(
      { name: 'Court 2', isActive: false },
      'facility-2'
    );
    facilityRepository.findOne.mockResolvedValue(inactiveFacility);

    await expect(
      service.getFacilityById(inactiveFacility.id, tenantId, staffUser)
    ).rejects.toThrow(NotFoundException);
  });

  it('validates operating hours when creating facilities', async () => {
    const dto: CreateFacilityDto = {
      name: 'Invalid Court',
      type: 'PADEL_COURT',
      config: {
        pricePerHour: 200,
        openTime: '23:00',
        closeTime: '22:00',
      },
    };

    await expect(
      service.createFacility(dto, tenantId, ownerUser)
    ).rejects.toThrow(BadRequestException);
  });
});
