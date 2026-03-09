import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { OnboardingBusinessType, UserRole } from '@khana/shared-dtos';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const FACILITY_TYPE_OPTIONS = [
  'PADEL',
  'FOOTBALL',
  'CHALET',
  'RESORT',
  'CAMP',
  'PADEL_COURT',
  'FOOTBALL_FIELD',
  'BASKETBALL_COURT',
  'TENNIS_COURT',
  'RESORT_UNIT',
  'OTHER',
] as const;

export const BUSINESS_TYPE_OPTIONS: ReadonlyArray<OnboardingBusinessType> = [
  'SPORTS',
  'RENTAL',
];

export const ASSIGNABLE_ROLES: ReadonlyArray<
  Exclude<UserRole, UserRole.OWNER>
> = [UserRole.MANAGER, UserRole.STAFF, UserRole.VIEWER];

const ONBOARDING_STEPS = [
  { titleKey: 'ONBOARDING.STEPS.BUSINESS' },
  { titleKey: 'ONBOARDING.STEPS.FACILITY' },
  { titleKey: 'ONBOARDING.STEPS.INVITE' },
  { titleKey: 'ONBOARDING.STEPS.CONFIRM' },
] as const;

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

export type OnboardingStepState = 'completed' | 'current' | 'upcoming';

export type InviteResult = {
  email: string;
  role: Exclude<UserRole, UserRole.OWNER>;
  success: boolean;
  message: string;
};

export type OnboardingStepViewModel = {
  index: number;
  titleKey: string;
  state: OnboardingStepState;
  stateKey: string;
  isCurrent: boolean;
};

export const operatingHoursValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const openTime = `${control.get('openTime')?.value ?? ''}`;
  const closeTime = `${control.get('closeTime')?.value ?? ''}`;

  if (!HH_MM_24H_REGEX.test(openTime) || !HH_MM_24H_REGEX.test(closeTime)) {
    return null;
  }

  return toMinutes(openTime) < toMinutes(closeTime)
    ? null
    : { invalidOperatingHours: true };
};

export function buildOnboardingSteps(
  currentStep: number
): ReadonlyArray<OnboardingStepViewModel> {
  return ONBOARDING_STEPS.map((step, idx) => {
    const index = idx + 1;
    const state = resolveStepState(index, currentStep);

    return {
      index,
      titleKey: step.titleKey,
      state,
      stateKey: `ONBOARDING.STEP_STATE.${state.toUpperCase()}`,
      isCurrent: state === 'current',
    };
  });
}

export function formatFacilityType(type: string): string {
  return type
    .split('_')
    .map((segment) =>
      segment.length > 0
        ? segment[0].toUpperCase() + segment.slice(1).toLowerCase()
        : segment
    )
    .join(' ');
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

function resolveStepState(
  stepIndex: number,
  currentStep: number
): OnboardingStepState {
  if (stepIndex < currentStep) {
    return 'completed';
  }

  if (stepIndex === currentStep) {
    return 'current';
  }

  return 'upcoming';
}
