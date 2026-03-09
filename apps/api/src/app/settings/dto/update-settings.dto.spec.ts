import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationPreferencesDto } from '@khana/shared-dtos';
import { UpdateSettingsDto } from './update-settings.dto';

const validNotificationPreferences: NotificationPreferencesDto = {
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

describe('UpdateSettingsDto', () => {
  it('accepts a valid IANA timezone', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      timezone: 'Europe/Istanbul',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid notification preferences', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      notificationPreferences: validNotificationPreferences,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid timezone', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      timezone: 'Invalid/Timezone',
    });

    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints).toHaveProperty('isIanaTimeZone');
  });

  it('rejects invalid notification send times', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      notificationPreferences: {
        ...validNotificationPreferences,
        morningDigest: {
          ...validNotificationPreferences.morningDigest,
          sendTime: '7:00',
        },
      },
    });

    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects invalid weekly summary weekday', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      notificationPreferences: {
        ...validNotificationPreferences,
        weeklySummary: {
          ...validNotificationPreferences.weeklySummary,
          dayOfWeek: 7,
        },
      },
    });

    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('allows empty payloads', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {});

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
