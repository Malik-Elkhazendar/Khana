import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, map, switchMap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import {
  CompleteOnboardingRequestDto,
  InviteUserRequestDto,
  OnboardingBusinessType,
  UserRole,
} from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { FacilityContextStore } from '../../shared/state';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FACILITY_TYPE_OPTIONS = [
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
const BUSINESS_TYPE_OPTIONS: ReadonlyArray<OnboardingBusinessType> = [
  'SPORTS',
  'RENTAL',
];
const ASSIGNABLE_ROLES: ReadonlyArray<Exclude<UserRole, UserRole.OWNER>> = [
  UserRole.MANAGER,
  UserRole.STAFF,
  UserRole.VIEWER,
];
const ONBOARDING_STEPS = [
  { titleKey: 'ONBOARDING.STEPS.BUSINESS' },
  { titleKey: 'ONBOARDING.STEPS.FACILITY' },
  { titleKey: 'ONBOARDING.STEPS.INVITE' },
  { titleKey: 'ONBOARDING.STEPS.CONFIRM' },
] as const;
const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

type OnboardingStepState = 'completed' | 'current' | 'upcoming';

type InviteResult = {
  email: string;
  role: Exclude<UserRole, UserRole.OWNER>;
  success: boolean;
  message: string;
};

type OnboardingStepViewModel = {
  index: number;
  titleKey: string;
  state: OnboardingStepState;
  stateKey: string;
  isCurrent: boolean;
};

const operatingHoursValidator: ValidatorFn = (
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

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly facilityContextStore = inject(FacilityContextStore);
  private readonly router = inject(Router);

  readonly currentStep = signal(1);
  readonly inviteLoading = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly inviteResults = signal<InviteResult[]>([]);
  readonly completionLoading = signal(false);
  readonly completionError = signal<string | null>(null);
  readonly totalSteps = TOTAL_ONBOARDING_STEPS;

  readonly businessTypes = BUSINESS_TYPE_OPTIONS;
  readonly facilityTypes = FACILITY_TYPE_OPTIONS;
  readonly assignableRoles = ASSIGNABLE_ROLES;
  readonly onboardingSteps = computed<ReadonlyArray<OnboardingStepViewModel>>(
    () => {
      const current = this.currentStep();

      return ONBOARDING_STEPS.map((step, idx) => {
        const index = idx + 1;
        const state = this.resolveStepState(index, current);

        return {
          index,
          titleKey: step.titleKey,
          state,
          stateKey: `ONBOARDING.STEP_STATE.${state.toUpperCase()}`,
          isCurrent: state === 'current',
        };
      });
    }
  );

  readonly successfulInviteCount = computed(
    () => this.inviteResults().filter((item) => item.success).length
  );

  readonly businessForm = this.formBuilder.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(120)]],
    businessType: ['SPORTS' as OnboardingBusinessType, Validators.required],
    contactEmail: ['', [Validators.email, Validators.maxLength(255)]],
    contactPhone: ['', [this.optionalPhoneValidator.bind(this)]],
  });

  readonly facilityForm = this.formBuilder.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      type: ['PADEL_COURT', [Validators.required, Validators.maxLength(80)]],
      pricePerHour: [100, [Validators.required, Validators.min(0.01)]],
      openTime: [
        '08:00',
        [Validators.required, Validators.pattern(HH_MM_24H_REGEX)],
      ],
      closeTime: [
        '23:00',
        [Validators.required, Validators.pattern(HH_MM_24H_REGEX)],
      ],
    },
    {
      validators: [operatingHoursValidator],
    }
  );

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: [
      UserRole.STAFF as Exclude<UserRole, UserRole.OWNER>,
      Validators.required,
    ],
  });

  previousStep(): void {
    const step = this.currentStep();
    if (step > 1) {
      this.currentStep.set(step - 1);
    }
  }

  nextStep(): void {
    const step = this.currentStep();

    if (step === 1) {
      this.businessForm.markAllAsTouched();
      if (this.businessForm.invalid) {
        return;
      }
    }

    if (step === 2) {
      this.facilityForm.markAllAsTouched();
      if (this.facilityForm.invalid) {
        return;
      }
    }

    if (step < 4) {
      this.currentStep.set(step + 1);
    }
  }

  skipInvites(): void {
    if (this.currentStep() === 3) {
      this.currentStep.set(4);
    }
  }

  sendInvite(): void {
    if (this.inviteLoading()) {
      return;
    }

    this.inviteForm.markAllAsTouched();
    if (this.inviteForm.invalid) {
      return;
    }

    const formValue = this.inviteForm.getRawValue();
    const request: InviteUserRequestDto = {
      email: formValue.email.trim().toLowerCase(),
      role: formValue.role,
    };

    this.inviteLoading.set(true);
    this.inviteError.set(null);

    this.api
      .inviteUser(request)
      .pipe(finalize(() => this.inviteLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.inviteResults.update((current) => [
            ...current,
            {
              email: request.email,
              role: request.role,
              success: true,
              message: response.message,
            },
          ]);
          this.inviteForm.reset({
            email: '',
            role: UserRole.STAFF,
          });
          this.inviteForm.markAsPristine();
          this.inviteForm.markAsUntouched();
        },
        error: (err) => {
          const message = this.resolveErrorMessage(
            err,
            'Unable to send invitation.'
          );
          this.inviteError.set(message);
          this.inviteResults.update((current) => [
            ...current,
            {
              email: request.email,
              role: request.role,
              success: false,
              message,
            },
          ]);
        },
      });
  }

  completeOnboarding(): void {
    if (this.completionLoading()) {
      return;
    }

    this.businessForm.markAllAsTouched();
    this.facilityForm.markAllAsTouched();

    if (this.businessForm.invalid) {
      this.currentStep.set(1);
      return;
    }

    if (this.facilityForm.invalid) {
      this.currentStep.set(2);
      return;
    }

    this.completionLoading.set(true);
    this.completionError.set(null);

    const request = this.buildCompleteRequest();

    this.api
      .completeOnboarding(request)
      .pipe(
        switchMap((response) =>
          this.authService.getCurrentUser().pipe(map(() => response))
        ),
        finalize(() => this.completionLoading.set(false))
      )
      .subscribe({
        next: (response) => {
          this.facilityContextStore.refreshFacilities();
          this.router.navigateByUrl(response.redirectTo);
        },
        error: (err) => {
          this.completionError.set(
            this.resolveErrorMessage(err, 'Unable to complete onboarding.')
          );
        },
      });
  }

  formatFacilityType(type: string): string {
    return type
      .split('_')
      .map((segment) =>
        segment.length > 0
          ? segment[0].toUpperCase() + segment.slice(1).toLowerCase()
          : segment
      )
      .join(' ');
  }

  private buildCompleteRequest(): CompleteOnboardingRequestDto {
    const business = this.businessForm.getRawValue();
    const facility = this.facilityForm.getRawValue();

    return {
      businessName: business.businessName.trim(),
      businessType: business.businessType,
      contactEmail: business.contactEmail.trim().toLowerCase() || undefined,
      contactPhone: business.contactPhone.trim() || undefined,
      facility: {
        name: facility.name.trim(),
        type: facility.type.trim().toUpperCase(),
        pricePerHour: Number(facility.pricePerHour),
        openTime: facility.openTime,
        closeTime: facility.closeTime,
      },
    };
  }

  private resolveErrorMessage(err: unknown, fallbackMessage: string): string {
    if (err instanceof HttpErrorResponse) {
      if (typeof err.error?.message === 'string') {
        return err.error.message;
      }

      if (Array.isArray(err.error?.message)) {
        return err.error.message.join(', ');
      }

      if (typeof err.message === 'string' && err.message.trim()) {
        return err.message;
      }
    }

    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }

    return fallbackMessage;
  }

  private optionalPhoneValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const value = (control.value ?? '').toString().trim();

    if (!value) {
      return null;
    }

    const phonePattern = /^[+]?[0-9\s()-]{7,}$/;
    return phonePattern.test(value) ? null : { phone: true };
  }

  private resolveStepState(
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
}
