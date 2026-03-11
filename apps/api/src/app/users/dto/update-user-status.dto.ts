import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'Whether the tenant user remains active and able to sign in.',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;
}
