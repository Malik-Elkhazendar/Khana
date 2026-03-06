import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSettingsDto } from './update-settings.dto';

describe('UpdateSettingsDto', () => {
  it('accepts a valid IANA timezone', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      timezone: 'Europe/Istanbul',
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

  it('allows empty payloads', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {});

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
