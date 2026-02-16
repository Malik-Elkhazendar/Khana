import { IsUUID } from 'class-validator';

export class LogoutDeviceDto {
  @IsUUID()
  sessionId!: string;
}
