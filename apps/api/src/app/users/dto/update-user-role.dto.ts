import { IsEnum } from 'class-validator';
import { UserRole } from '@khana/shared-dtos';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
