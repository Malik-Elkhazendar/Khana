import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password used to verify the account owner.',
    minLength: 8,
    example: 'OldSecret123!',
  })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password that will replace the current one.',
    minLength: 8,
    example: 'NewSecret123!',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
