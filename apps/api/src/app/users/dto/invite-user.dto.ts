import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '@khana/shared-dtos';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
