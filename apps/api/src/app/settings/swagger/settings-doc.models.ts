import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationChannelPreferenceDoc {
  @ApiProperty({ example: true })
  enabled!: boolean;
}

export class NotificationDeliveryPreferencesDoc {
  @ApiProperty({ type: () => NotificationChannelPreferenceDoc })
  whatsapp!: NotificationChannelPreferenceDoc;

  @ApiProperty({ type: () => NotificationChannelPreferenceDoc })
  email!: NotificationChannelPreferenceDoc;
}

export class ScheduledNotificationPreferenceDoc {
  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: '08:00' })
  sendTime!: string;

  @ApiProperty({ type: () => NotificationDeliveryPreferencesDoc })
  channels!: NotificationDeliveryPreferencesDoc;
}

export class WeeklySummaryPreferenceDoc extends ScheduledNotificationPreferenceDoc {
  @ApiProperty({ example: 1, minimum: 0, maximum: 6 })
  dayOfWeek!: number;
}

export class RealtimeNotificationPreferenceDoc {
  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ type: () => NotificationDeliveryPreferencesDoc })
  channels!: NotificationDeliveryPreferencesDoc;
}

export class HoldExpiringAlertPreferenceDoc {
  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 15 })
  leadMinutes!: number;

  @ApiProperty({ type: () => NotificationDeliveryPreferencesDoc })
  channels!: NotificationDeliveryPreferencesDoc;
}

export class NotificationPreferencesDoc {
  @ApiProperty({ type: () => ScheduledNotificationPreferenceDoc })
  morningDigest!: ScheduledNotificationPreferenceDoc;

  @ApiProperty({ type: () => WeeklySummaryPreferenceDoc })
  weeklySummary!: WeeklySummaryPreferenceDoc;

  @ApiProperty({ type: () => RealtimeNotificationPreferenceDoc })
  bookingCreated!: RealtimeNotificationPreferenceDoc;

  @ApiProperty({ type: () => RealtimeNotificationPreferenceDoc })
  bookingCancelled!: RealtimeNotificationPreferenceDoc;

  @ApiProperty({ type: () => HoldExpiringAlertPreferenceDoc })
  holdExpiring!: HoldExpiringAlertPreferenceDoc;
}

export class TenantSettingsResponseDoc {
  @ApiProperty({ example: 'Asia/Riyadh' })
  timezone!: string;

  @ApiPropertyOptional({
    type: () => NotificationPreferencesDoc,
    nullable: true,
  })
  notificationPreferences?: NotificationPreferencesDoc | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class GoalSettingsResponseDoc {
  @ApiPropertyOptional({ nullable: true, example: 25000 })
  monthlyRevenueTarget!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 72.5 })
  monthlyOccupancyTarget!: number | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  goalsNudgeShownAt!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  goalsNudgeDismissedAt!: string | null;

  @ApiProperty({ example: false })
  shouldShowNudge!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
