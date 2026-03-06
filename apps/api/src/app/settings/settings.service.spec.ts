import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Tenant } from '@khana/data-access';
import { DEFAULT_TENANT_TIMEZONE } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let tenantRepository: jest.Mocked<
    Pick<Repository<Tenant>, 'findOne' | 'save'>
  >;

  const goalsService = {
    getGoalSettings: jest.fn(),
    updateGoalSettings: jest.fn(),
  };

  beforeEach(() => {
    tenantRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    service = new SettingsService(
      tenantRepository as unknown as Repository<Tenant>,
      goalsService as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns tenant timezone settings', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    tenantRepository.findOne.mockResolvedValueOnce({
      id: 'tenant-1',
      timezone: 'Asia/Riyadh',
      updatedAt,
    } as Tenant);

    const result = await service.getSettings('tenant-1');

    expect(tenantRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: ['id', 'timezone', 'updatedAt'],
    });
    expect(result).toEqual({
      timezone: 'Asia/Riyadh',
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('falls back to default timezone when tenant timezone is missing', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    tenantRepository.findOne.mockResolvedValueOnce({
      id: 'tenant-1',
      timezone: '',
      updatedAt,
    } as Tenant);

    const result = await service.getSettings('tenant-1');

    expect(result.timezone).toBe(DEFAULT_TENANT_TIMEZONE);
  });

  it('updates timezone for owner/manager settings patch payload', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    const tenant = {
      id: 'tenant-1',
      timezone: 'Asia/Riyadh',
      updatedAt,
    } as Tenant;

    tenantRepository.findOne.mockResolvedValueOnce(tenant);
    tenantRepository.save.mockResolvedValueOnce({
      ...tenant,
      timezone: 'Europe/Istanbul',
    } as Tenant);

    const result = await service.updateSettings('tenant-1', {
      timezone: 'Europe/Istanbul',
    });

    expect(tenantRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tenant-1', timezone: 'Europe/Istanbul' })
    );
    expect(result.timezone).toBe('Europe/Istanbul');
  });

  it('does not persist when timezone key is absent', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    tenantRepository.findOne.mockResolvedValueOnce({
      id: 'tenant-1',
      timezone: 'Asia/Riyadh',
      updatedAt,
    } as Tenant);

    const result = await service.updateSettings('tenant-1', {});

    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(result.timezone).toBe('Asia/Riyadh');
  });

  it('throws not found when tenant is missing', async () => {
    tenantRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.getSettings('tenant-1')).rejects.toThrow(
      NotFoundException
    );
  });

  it('throws forbidden when tenant id is empty', async () => {
    await expect(service.getSettings('')).rejects.toThrow(ForbiddenException);
    expect(tenantRepository.findOne).not.toHaveBeenCalled();
  });
});
