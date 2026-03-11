import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token issued by the forgot-password flow.',
    example: 'reset-token-value',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description: 'New password that will be saved for the account.',
    minLength: 8,
    example: 'NewSecret123!',
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
