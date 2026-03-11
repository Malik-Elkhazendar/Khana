import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '@khana/shared-dtos';

export class InviteUserDto {
  @ApiProperty({
    description: 'Email address for the invited team member.',
    example: 'staff@khana.sa',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Role granted to the invited team member.',
    enum: UserRole,
    example: UserRole.STAFF,
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
