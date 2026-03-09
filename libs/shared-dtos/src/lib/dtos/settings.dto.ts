import { NotificationPreferencesDto } from './notification-preferences.dto';

export interface TenantSettingsResponseDto {
  timezone: string;
  notificationPreferences?: NotificationPreferencesDto | null;
  updatedAt: string;
}

export interface UpdateTenantSettingsRequestDto {
  timezone?: string;
  notificationPreferences?: NotificationPreferencesDto;
}
