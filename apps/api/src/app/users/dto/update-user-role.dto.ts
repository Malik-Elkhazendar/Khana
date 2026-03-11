import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '@khana/shared-dtos';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'Updated role for the tenant user.',
    enum: UserRole,
    example: UserRole.MANAGER,
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
