import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  CompleteOnboardingRequestDto,
  OnboardingBusinessType,
  UserRole,
} from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { FacilityContextStore } from '../../../shared/state';
import {
  ASSIGNABLE_ROLES,
  buildOnboardingSteps,
  BUSINESS_TYPE_OPTIONS,
  FACILITY_TYPE_OPTIONS,
  formatFacilityType,
  InviteResult,
  OnboardingStepViewModel,
  operatingHoursValidator,
  TOTAL_ONBOARDING_STEPS,
} from './onboarding.route.models';

/**
 * Route state for the onboarding wizard. The root component inherits the forms,
 * signals, and presentation helpers while action workflows live in the facade.
 */
export abstract class OnboardingRouteState {
  protected readonly formBuilder = inject(FormBuilder);
  protected readonly api = inject(ApiService);
  protected readonly authService = inject(AuthService);
  protected readonly facilityContextStore = inject(FacilityContextStore);
  protected readonly router = inject(Router);

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
    () => buildOnboardingSteps(this.currentStep())
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
        [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
      ],
      closeTime: [
        '23:00',
        [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
      ],
    },
    { validators: [operatingHoursValidator] }
  );

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: [
      UserRole.STAFF as Exclude<UserRole, UserRole.OWNER>,
      Validators.required,
    ],
  });

  formatFacilityType(type: string): string {
    return formatFacilityType(type);
  }

  protected buildCompleteRequest(): CompleteOnboardingRequestDto {
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

  protected resolveErrorMessage(err: unknown, fallbackMessage: string): string {
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
}
