import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerSummaryDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Fahad Alharbi' })
  name!: string;

  @ApiProperty({ example: '+966500000000' })
  phone!: string;

  @ApiProperty({ example: 12 })
  totalBookings!: number;

  @ApiProperty({ example: 3240 })
  totalSpend!: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-03-10T18:00:00.000Z',
  })
  lastBookingDate?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['VIP', 'Corporate'],
  })
  tags?: string[];
}
