import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Tenant } from '@khana/data-access';
import {
  DEFAULT_TENANT_TIMEZONE,
  NotificationPreferencesDto,
} from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notification-preferences.defaults';

const notificationPreferences: NotificationPreferencesDto = {
  morningDigest: {
    enabled: true,
    sendTime: '07:00',
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: true },
    },
  },
  weeklySummary: {
    enabled: true,
    dayOfWeek: 0,
    sendTime: '19:00',
    channels: {
      whatsapp: { enabled: false },
      email: { enabled: true },
    },
  },
  bookingCreated: {
    enabled: true,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
  bookingCancelled: {
    enabled: true,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
  holdExpiring: {
    enabled: true,
    leadMinutes: 30,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
};

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
      notificationPreferences,
      updatedAt,
    } as Tenant);

    const result = await service.getSettings('tenant-1');

    expect(tenantRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: ['id', 'timezone', 'notificationPreferences', 'updatedAt'],
    });
    expect(result).toEqual({
      timezone: 'Asia/Riyadh',
      notificationPreferences,
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('falls back to default timezone when tenant timezone is missing', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    tenantRepository.findOne.mockResolvedValueOnce({
      id: 'tenant-1',
      timezone: '',
      notificationPreferences: null,
      updatedAt,
    } as Tenant);

    const result = await service.getSettings('tenant-1');

    expect(result.timezone).toBe(DEFAULT_TENANT_TIMEZONE);
    expect(result.notificationPreferences).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it('updates timezone for owner/manager settings patch payload', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    const tenant = {
      id: 'tenant-1',
      timezone: 'Asia/Riyadh',
      notificationPreferences: null,
      updatedAt,
    } as Tenant;

    tenantRepository.findOne.mockResolvedValueOnce(tenant);
    tenantRepository.save.mockResolvedValueOnce({
      ...tenant,
      timezone: 'Europe/Istanbul',
      updatedAt,
    } as Tenant);

    const result = await service.updateSettings('tenant-1', {
      timezone: 'Europe/Istanbul',
    });

    expect(tenantRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tenant-1', timezone: 'Europe/Istanbul' })
    );
    expect(result.timezone).toBe('Europe/Istanbul');
    expect(result.notificationPreferences).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it('updates notification preferences when present in patch payload', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    const tenant = {
      id: 'tenant-1',
      timezone: 'Asia/Riyadh',
      notificationPreferences: null,
      updatedAt,
    } as Tenant;

    tenantRepository.findOne.mockResolvedValueOnce(tenant);
    tenantRepository.save.mockResolvedValueOnce({
      ...tenant,
      notificationPreferences,
      updatedAt,
    } as Tenant);

    const result = await service.updateSettings('tenant-1', {
      notificationPreferences,
    });

    expect(tenantRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tenant-1',
        notificationPreferences,
      })
    );
    expect(result.notificationPreferences).toEqual(notificationPreferences);
  });

  it('does not persist when settings keys are absent', async () => {
    const updatedAt = new Date('2026-03-06T12:00:00.000Z');
    tenantRepository.findOne.mockResolvedValueOnce({
      id: 'tenant-1',
      timezone: 'Asia/Riyadh',
      notificationPreferences,
      updatedAt,
    } as Tenant);

    const result = await service.updateSettings('tenant-1', {});

    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(result.timezone).toBe('Asia/Riyadh');
    expect(result.notificationPreferences).toEqual(notificationPreferences);
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
