import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email used for authentication.',
    example: 'owner@example.test',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Plain-text password submitted for login.',
    minLength: 8,
    example: 'example-password-not-real',
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description: 'Optional tenant subdomain hint for public login flows.',
    example: 'riyadh-club',
  })
  @IsOptional()
  @IsString()
  subdomain?: string;
}
