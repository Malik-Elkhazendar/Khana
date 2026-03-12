import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SignupOwnerDto {
  @ApiProperty({
    description: 'Tenant workspace name created during owner signup.',
    minLength: 2,
    maxLength: 120,
    example: 'Khana Padel Club',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  workspaceName!: string;

  @ApiPropertyOptional({
    description: 'Optional public workspace slug. Generated when omitted.',
    minLength: 3,
    maxLength: 50,
    example: 'khana-padel-club',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(SLUG_REGEX)
  workspaceSlug?: string;

  @ApiProperty({
    description: 'Owner display name.',
    minLength: 2,
    maxLength: 120,
    example: 'Malek Elkhazendar',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Owner email used for login.',
    maxLength: 255,
    example: 'owner@example.test',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'Initial password for the owner account.',
    minLength: 8,
    maxLength: 255,
    example: 'example-password-not-real',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;

  @ApiPropertyOptional({
    description: 'Optional owner contact phone number.',
    maxLength: 20,
    example: '+966500000000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
