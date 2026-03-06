export interface TenantSettingsResponseDto {
  timezone: string;
  updatedAt: string;
}

export interface UpdateTenantSettingsRequestDto {
  timezone?: string;
}
