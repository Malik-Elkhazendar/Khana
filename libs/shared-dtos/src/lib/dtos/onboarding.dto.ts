export type OnboardingBusinessType = 'SPORTS' | 'RENTAL';

export interface CompleteOnboardingFacilityDto {
  name: string;
  type: string;
  pricePerHour: number;
  openTime: string;
  closeTime: string;
}

export interface CompleteOnboardingRequestDto {
  businessName: string;
  businessType: OnboardingBusinessType;
  contactEmail?: string;
  contactPhone?: string;
  facility: CompleteOnboardingFacilityDto;
}

export interface CompleteOnboardingResponseDto {
  onboardingCompleted: true;
  tenantId: string;
  facilityId: string;
  redirectTo: '/dashboard';
}
