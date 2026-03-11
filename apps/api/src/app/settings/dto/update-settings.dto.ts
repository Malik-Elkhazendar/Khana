import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Whether this channel is enabled for the notification.',
    example: true,
  })
  @IsBoolean()
  enabled!: boolean;
}

class NotificationDeliveryPreferencesInputDto {
  @ApiProperty({
    description: 'WhatsApp delivery settings for the notification.',
    type: () => NotificationChannelPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceInputDto)
  whatsapp!: NotificationChannelPreferenceInputDto;

  @ApiProperty({
    description: 'Email delivery settings for the notification.',
    type: () => NotificationChannelPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceInputDto)
  email!: NotificationChannelPreferenceInputDto;
}

class ScheduledNotificationPreferenceInputDto {
  @ApiProperty({
    description: 'Whether the scheduled notification is enabled.',
    example: true,
  })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    description: 'Local send time in 24-hour HH:mm format.',
    example: '08:00',
  })
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  sendTime!: LocalTimeString;

  @ApiProperty({
    description: 'Delivery channel preferences for the scheduled notification.',
    type: () => NotificationDeliveryPreferencesInputDto,
  })
  @ValidateNested()
  @Type(() => NotificationDeliveryPreferencesInputDto)
  channels!: NotificationDeliveryPreferencesInputDto;
}

class WeeklySummaryPreferenceInputDto extends ScheduledNotificationPreferenceInputDto {
  @ApiProperty({
    description: 'Weekday used for the weekly summary, where 0 = Sunday.',
    minimum: 0,
    maximum: 6,
    example: 1,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: NotificationWeekday;
}

class RealtimeNotificationPreferenceInputDto {
  @ApiProperty({
    description: 'Whether the realtime notification is enabled.',
    example: true,
  })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    description: 'Delivery channel preferences for the realtime notification.',
    type: () => NotificationDeliveryPreferencesInputDto,
  })
  @ValidateNested()
  @Type(() => NotificationDeliveryPreferencesInputDto)
  channels!: NotificationDeliveryPreferencesInputDto;
}

class HoldExpiringAlertPreferenceInputDto {
  @ApiProperty({
    description: 'Whether hold-expiring alerts are enabled.',
    example: true,
  })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    description: 'Lead time in minutes before a hold expiration alert is sent.',
    minimum: 1,
    example: 15,
  })
  @IsInt()
  @Min(1)
  leadMinutes!: number;

  @ApiProperty({
    description: 'Delivery channel preferences for the hold-expiring alert.',
    type: () => NotificationDeliveryPreferencesInputDto,
  })
  @ValidateNested()
  @Type(() => NotificationDeliveryPreferencesInputDto)
  channels!: NotificationDeliveryPreferencesInputDto;
}

class NotificationPreferencesInputDto {
  @ApiProperty({
    description: 'Morning digest scheduling preferences.',
    type: () => ScheduledNotificationPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => ScheduledNotificationPreferenceInputDto)
  morningDigest!: ScheduledNotificationPreferenceInputDto;

  @ApiProperty({
    description: 'Weekly summary scheduling preferences.',
    type: () => WeeklySummaryPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => WeeklySummaryPreferenceInputDto)
  weeklySummary!: WeeklySummaryPreferenceInputDto;

  @ApiProperty({
    description: 'Realtime notification settings for booking-created events.',
    type: () => RealtimeNotificationPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => RealtimeNotificationPreferenceInputDto)
  bookingCreated!: RealtimeNotificationPreferenceInputDto;

  @ApiProperty({
    description: 'Realtime notification settings for booking-cancelled events.',
    type: () => RealtimeNotificationPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => RealtimeNotificationPreferenceInputDto)
  bookingCancelled!: RealtimeNotificationPreferenceInputDto;

  @ApiProperty({
    description: 'Alert settings for expiring booking holds.',
    type: () => HoldExpiringAlertPreferenceInputDto,
  })
  @ValidateNested()
  @Type(() => HoldExpiringAlertPreferenceInputDto)
  holdExpiring!: HoldExpiringAlertPreferenceInputDto;
}

export class UpdateSettingsDto implements UpdateTenantSettingsRequestDto {
  @ApiPropertyOptional({
    description: 'Tenant IANA timezone identifier.',
    example: 'Asia/Riyadh',
  })
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @IsOptional()
  @IsIanaTimeZone({
    message: 'timezone must be a valid IANA timezone identifier',
  })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Tenant notification preference overrides.',
    type: () => NotificationPreferencesInputDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferencesInputDto)
  notificationPreferences?: NotificationPreferencesInputDto;
}
