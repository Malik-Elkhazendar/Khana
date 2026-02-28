import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AuditAction,
  AuditLog,
  Facility,
  Tenant,
  User,
} from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';
import { CompleteOnboardingDto, OnboardingBusinessTypeDto } from './dto';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const tenantId = 'tenant-1';
  const now = new Date('2026-03-01T10:00:00.000Z');

  let service: OnboardingService;
  let dataSource: jest.Mocked<DataSource>;
  let tenantRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let facilityRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const ownerActor = {
    id: 'owner-1',
    tenantId,
    role: UserRole.OWNER,
  } as unknown as User;

  const onboardingDto: CompleteOnboardingDto = {
    businessName: 'Elite Sports Hub',
    businessType: OnboardingBusinessTypeDto.SPORTS,
    contactEmail: 'owner@khana.dev',
    contactPhone: '+966500000000',
    facility: {
      name: 'Court 1',
      type: 'PADEL_COURT',
      pricePerHour: 180,
      openTime: '08:00',
      closeTime: '23:00',
    },
  };

  const buildTenant = (overrides: Partial<Tenant> = {}): Tenant =>
    ({
      id: tenantId,
      name: 'Old Tenant Name',
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      businessType: null,
      contactEmail: null,
      contactPhone: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as Tenant);

  beforeEach(() => {
    tenantRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    facilityRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload: Partial<Facility>) => payload),
      save: jest.fn(),
    };

    auditRepository = {
      create: jest.fn((payload: Record<string, unknown>) => payload),
      save: jest.fn(async (payload: Record<string, unknown>) => payload),
    };

    const entityManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Tenant) return tenantRepository;
        if (entity === Facility) return facilityRepository;
        if (entity === AuditLog) return auditRepository;
        throw new Error('Unknown entity');
      }),
    };

    dataSource = {
      transaction: jest.fn(async (cb: (manager: unknown) => unknown) =>
        cb(entityManager)
      ),
    } as unknown as jest.Mocked<DataSource>;

    service = new OnboardingService(dataSource, appLogger as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('completes onboarding transaction and creates first facility', async () => {
    const tenant = buildTenant();
    tenantRepository.findOne.mockResolvedValue(tenant);
    tenantRepository.save.mockImplementation(
      async (payload: Tenant) => payload
    );
    facilityRepository.findOne.mockResolvedValue(null);
    facilityRepository.save.mockImplementation(
      async (payload: Partial<Facility>) =>
        ({
          id: 'facility-1',
          createdAt: now,
          updatedAt: now,
          ...payload,
        } as Facility)
    );

    const result = await service.complete(onboardingDto, tenantId, ownerActor);

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(tenantRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: onboardingDto.businessName,
        onboardingCompleted: true,
        businessType: 'SPORTS',
      })
    );
    expect(facilityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: onboardingDto.facility.name,
        type: onboardingDto.facility.type,
      })
    );
    expect(auditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'Tenant',
      })
    );
    expect(result).toEqual({
      onboardingCompleted: true,
      tenantId,
      facilityId: 'facility-1',
      redirectTo: '/dashboard',
    });
  });

  it('propagates transactional failure when facility creation fails', async () => {
    tenantRepository.findOne.mockResolvedValue(buildTenant());
    tenantRepository.save.mockImplementation(
      async (payload: Tenant) => payload
    );
    facilityRepository.findOne.mockResolvedValue(null);
    facilityRepository.save.mockRejectedValue(
      new Error('facility persistence failed')
    );

    await expect(
      service.complete(onboardingDto, tenantId, ownerActor)
    ).rejects.toThrow('facility persistence failed');
  });

  it('rejects non-owner actor', async () => {
    const managerActor = {
      ...ownerActor,
      role: UserRole.MANAGER,
    } as unknown as User;

    await expect(
      service.complete(onboardingDto, tenantId, managerActor)
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns idempotent success when tenant is already onboarded', async () => {
    tenantRepository.findOne.mockResolvedValue(
      buildTenant({ onboardingCompleted: true, onboardingCompletedAt: now })
    );
    facilityRepository.findOne.mockResolvedValue({
      id: 'facility-existing',
      tenant: { id: tenantId },
    } as Facility);

    const result = await service.complete(onboardingDto, tenantId, ownerActor);

    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(facilityRepository.save).not.toHaveBeenCalled();
    expect(result).toEqual({
      onboardingCompleted: true,
      tenantId,
      facilityId: 'facility-existing',
      redirectTo: '/dashboard',
    });
  });

  it('throws when onboarding is marked complete but no facility exists', async () => {
    tenantRepository.findOne.mockResolvedValue(
      buildTenant({ onboardingCompleted: true, onboardingCompletedAt: now })
    );
    facilityRepository.findOne.mockResolvedValue(null);

    await expect(
      service.complete(onboardingDto, tenantId, ownerActor)
    ).rejects.toThrow(BadRequestException);
  });
});
