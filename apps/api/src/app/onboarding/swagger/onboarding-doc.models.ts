import { ApiProperty } from '@nestjs/swagger';

export class CompleteOnboardingResponseDoc {
  @ApiProperty({ enum: [true], example: true })
  onboardingCompleted!: true;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  facilityId!: string;

  @ApiProperty({ enum: ['/dashboard'], example: '/dashboard' })
  redirectTo!: '/dashboard';
}
