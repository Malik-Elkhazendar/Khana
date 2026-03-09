import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  LocalTimeString,
  NotificationWeekday,
  UpdateTenantSettingsRequestDto,
} from '@khana/shared-dtos';
import { IsIanaTimeZone } from './is-iana-time-zone.decorator';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

class NotificationChannelPreferenceInputDto {
  @IsBoolean()
  enabled!: boolean;
}

class NotificationDeliveryPreferencesInputDto {
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceInputDto)
  whatsapp!: NotificationChannelPreferenceInputDto;

  @ValidateNested()
  @Type(() => NotificationChannelPreferenceInputDto)
  email!: NotificationChannelPreferenceInputDto;
}

class ScheduledNotificationPreferenceInputDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Matches(HH_MM_24H_REGEX)
  sendTime!: LocalTimeString;

  @ValidateNested()
  @Type(() => NotificationDeliveryPreferencesInputDto)
  channels!: NotificationDeliveryPreferencesInputDto;
}

class WeeklySummaryPreferenceInputDto extends ScheduledNotificationPreferenceInputDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: NotificationWeekday;
}

class RealtimeNotificationPreferenceInputDto {
  @IsBoolean()
  enabled!: boolean;

  @ValidateNested()
  @Type(() => NotificationDeliveryPreferencesInputDto)
  channels!: NotificationDeliveryPreferencesInputDto;
}

class HoldExpiringAlertPreferenceInputDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(1)
  leadMinutes!: number;

  @ValidateNested()
  @Type(() => NotificationDeliveryPreferencesInputDto)
  channels!: NotificationDeliveryPreferencesInputDto;
}

class NotificationPreferencesInputDto {
  @ValidateNested()
  @Type(() => ScheduledNotificationPreferenceInputDto)
  morningDigest!: ScheduledNotificationPreferenceInputDto;

  @ValidateNested()
  @Type(() => WeeklySummaryPreferenceInputDto)
  weeklySummary!: WeeklySummaryPreferenceInputDto;

  @ValidateNested()
  @Type(() => RealtimeNotificationPreferenceInputDto)
  bookingCreated!: RealtimeNotificationPreferenceInputDto;

  @ValidateNested()
  @Type(() => RealtimeNotificationPreferenceInputDto)
  bookingCancelled!: RealtimeNotificationPreferenceInputDto;

  @ValidateNested()
  @Type(() => HoldExpiringAlertPreferenceInputDto)
  holdExpiring!: HoldExpiringAlertPreferenceInputDto;
}

export class UpdateSettingsDto implements UpdateTenantSettingsRequestDto {
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @IsOptional()
  @IsIanaTimeZone({
    message: 'timezone must be a valid IANA timezone identifier',
  })
  timezone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferencesInputDto)
  notificationPreferences?: NotificationPreferencesInputDto;
}
