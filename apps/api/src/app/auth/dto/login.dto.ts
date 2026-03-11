import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email used for authentication.',
    example: 'owner@khana.sa',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Plain-text password submitted for login.',
    minLength: 8,
    example: 'Secret123!',
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
