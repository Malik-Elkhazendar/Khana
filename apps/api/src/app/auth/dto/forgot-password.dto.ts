import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address for the password reset request.',
    example: 'owner@example.test',
  })
  @IsEmail()
  email!: string;
}
