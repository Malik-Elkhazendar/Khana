import { ApiProperty } from '@nestjs/swagger';

export class CompleteOnboardingResponseDoc {
  @ApiProperty({ type: Boolean, example: true })
  onboardingCompleted!: boolean;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  facilityId!: string;

  @ApiProperty({ enum: ['/dashboard'], example: '/dashboard' })
  redirectTo!: '/dashboard';
}
