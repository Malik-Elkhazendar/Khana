import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@khana/shared-dtos';

export class AuthTenantContextDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Khana Padel Club' })
  name!: string;

  @ApiProperty({ example: 'khana-padel-club' })
  slug!: string;

  @ApiProperty({ example: 'Asia/Riyadh' })
  timezone!: string;
}

export class AuthUserDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'owner@example.test' })
  email!: string;

  @ApiProperty({ example: 'Malek Elkhazendar' })
  name!: string;

  @ApiPropertyOptional({ example: '+966500000000' })
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OWNER })
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

export class AuthRefreshResponseDoc {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh' })
  refreshToken!: string;

  @ApiProperty({
    description: 'Access-token expiry in seconds.',
    example: 900,
  })
  expiresIn!: number;
}

export class AuthLoginResponseDoc extends AuthRefreshResponseDoc {
  @ApiProperty({ type: () => AuthUserDoc })
  user!: AuthUserDoc;

  @ApiPropertyOptional({ type: () => AuthTenantContextDoc })
  tenant?: AuthTenantContextDoc;
}

export class AuthMessageResponseDoc {
  @ApiProperty({
    example: 'If the account exists, password reset instructions were sent.',
  })
  message!: string;
}
