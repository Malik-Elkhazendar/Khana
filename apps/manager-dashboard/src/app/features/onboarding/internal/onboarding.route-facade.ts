import { Directive } from '@angular/core';
import { finalize, map, switchMap } from 'rxjs';
import { InviteUserRequestDto, UserRole } from '@khana/shared-dtos';
import { OnboardingRouteState } from './onboarding.route-state';

/**
 * Route-scoped action workflows for the onboarding wizard. The component keeps
 * its public template API while the shell itself stays minimal.
 */
@Directive()
export class OnboardingRouteFacade extends OnboardingRouteState {
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

    this.api
      .completeOnboarding(this.buildCompleteRequest())
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
}
