import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address for the password reset request.',
    example: 'owner@khana.sa',
  })
  @IsEmail()
  email!: string;
}
