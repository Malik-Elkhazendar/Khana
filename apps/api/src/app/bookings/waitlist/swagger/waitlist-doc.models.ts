import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaitlistStatus } from '@khana/shared-dtos';

export class WaitlistDesiredTimeSlotDoc {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T18:00:00.000Z',
  })
  startTime!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T19:00:00.000Z',
  })
  endTime!: string;
}

export class JoinWaitlistResponseDoc {
  @ApiProperty({ format: 'uuid' })
  entryId!: string;

  @ApiProperty({ enum: WaitlistStatus, example: WaitlistStatus.WAITING })
  status!: WaitlistStatus;

  @ApiProperty({ example: 1 })
  queuePosition!: number;

  @ApiProperty({ type: () => WaitlistDesiredTimeSlotDoc })
  desiredTimeSlot!: WaitlistDesiredTimeSlotDoc;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-11T08:30:00.000Z',
  })
  createdAt!: string;
}

export class WaitlistStatusResponseDoc {
  @ApiProperty({ example: true })
  isOnWaitlist!: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  entryId?: string;

  @ApiPropertyOptional({ enum: WaitlistStatus })
  status?: WaitlistStatus;

  @ApiPropertyOptional({ example: 1 })
  queuePosition?: number;
}

export class WaitlistEntryListItemDoc {
  @ApiProperty({ format: 'uuid' })
  entryId!: string;

  @ApiProperty({ format: 'uuid' })
  facilityId!: string;

  @ApiProperty({ example: 'Court 1' })
  facilityName!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'Malek Elkhazendar' })
  userName!: string;

  @ApiProperty({ example: 'owner@khana.sa' })
  userEmail!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  desiredStartTime!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  desiredEndTime!: string;

  @ApiProperty({ enum: WaitlistStatus, example: WaitlistStatus.WAITING })
  status!: WaitlistStatus;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  queuePosition!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  notifiedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiredAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  fulfilledByBookingId!: string | null;
}

export class WaitlistSummaryCountsDoc {
  @ApiProperty({ example: 3 })
  waiting!: number;

  @ApiProperty({ example: 1 })
  notified!: number;

  @ApiProperty({ example: 0 })
  expired!: number;

  @ApiProperty({ example: 2 })
  fulfilled!: number;
}

export class WaitlistListResponseDoc {
  @ApiProperty({ type: () => WaitlistEntryListItemDoc, isArray: true })
  items!: WaitlistEntryListItemDoc[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ type: () => WaitlistSummaryCountsDoc })
  summary!: WaitlistSummaryCountsDoc;
}

export class NotifyNextWaitlistResponseDoc {
  @ApiProperty({ example: true })
  notified!: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  entryId?: string;

  @ApiPropertyOptional({
    enum: WaitlistStatus,
    example: WaitlistStatus.NOTIFIED,
  })
  status?: WaitlistStatus;
}

export class ExpireWaitlistEntryResponseDoc {
  @ApiProperty({ format: 'uuid' })
  entryId!: string;

  @ApiProperty({ enum: WaitlistStatus, example: WaitlistStatus.EXPIRED })
  status!: WaitlistStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  expiredAt!: string;
}
