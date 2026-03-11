import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Email address for the new tenant user.',
    example: 'manager@khana.sa',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Initial password for the new user.',
    minLength: 8,
    example: 'Secret123!',
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'Display name for the new user.',
    minLength: 2,
    example: 'Abeer Alotaibi',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional contact phone number for the new user.',
    example: '+966500000000',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
