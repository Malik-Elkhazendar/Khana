import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@khana/shared-dtos';

export class UserDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'manager@example.test' })
  email!: string;

  @ApiProperty({ example: 'Abeer Alotaibi' })
  name!: string;

  @ApiPropertyOptional({ example: '+966500000000' })
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.MANAGER })
  role!: UserRole;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: true })
  onboardingCompleted!: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-03-11T08:30:00.000Z',
  })
  lastLoginAt?: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-01T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-11T08:30:00.000Z',
  })
  updatedAt!: string;
}

export class InviteUserResponseDoc {
  @ApiProperty({
    example: 'Invitation created successfully.',
  })
  message!: string;

  @ApiProperty({ type: () => UserDoc })
  user!: UserDoc;
}
