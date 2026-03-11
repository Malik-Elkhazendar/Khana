import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FacilityManagementConfigDoc {
  @ApiProperty({ example: 180 })
  pricePerHour!: number;

  @ApiProperty({ example: '08:00' })
  openTime!: string;

  @ApiProperty({ example: '23:00' })
  closeTime!: string;
}

export class FacilityManagementItemDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  tenantId?: string;

  @ApiProperty({ example: 'Court 1' })
  name!: string;

  @ApiProperty({ example: 'PADEL' })
  type!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: () => FacilityManagementConfigDoc })
  config!: FacilityManagementConfigDoc;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
