import { ApiProperty } from '@nestjs/swagger';

export class TodaySnapshotDoc {
  @ApiProperty({ example: 12 })
  bookingsToday!: number;

  @ApiProperty({ example: 1840 })
  revenueToday!: number;

  @ApiProperty({ example: 3 })
  unpaidCount!: number;

  @ApiProperty({ example: 540 })
  unpaidAmount!: number;

  @ApiProperty({ example: 1 })
  expiringHoldsCount!: number;

  @ApiProperty({ example: 4 })
  waitlistToday!: number;

  @ApiProperty({ example: 1 })
  notifiedWaitlistCount!: number;

  @ApiProperty({ example: 0 })
  noShowCount!: number;
}
