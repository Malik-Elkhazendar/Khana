import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LogoutDeviceDto {
  @ApiProperty({
    description: 'Session identifier for the device that should be revoked.',
    format: 'uuid',
  })
  @IsUUID()
  sessionId!: string;
}
