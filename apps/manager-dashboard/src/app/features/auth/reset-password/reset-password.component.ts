import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';
import {
  PasswordStrengthResult,
  PasswordStrengthService,
} from '../register/services/password-strength.service';
import { PasswordStrengthIndicatorComponent } from '../shared';

@Component({
  selector: 'khana-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    PasswordStrengthIndicatorComponent,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordStrengthService = inject(PasswordStrengthService);

  readonly authStore = inject(AuthStore);
  readonly successMessage = signal<string | null>(null);
  readonly passwordFocused = signal(false);
  readonly passwordValue = signal('');
  readonly resetToken = signal<string | null>(null);
  readonly resetLinkError = signal<string | null>(null);
  readonly hasValidResetToken = computed(() => !!this.resetToken());

  readonly resetPasswordForm = this.fb.nonNullable.group(
    {
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          this.passwordPolicyValidator.bind(this),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [this.passwordMatchValidator.bind(this)],
    }
  );

  readonly passwordStrength = computed<PasswordStrengthResult>(() =>
    this.passwordStrengthService.calculateStrength(this.passwordValue())
  );

  readonly passwordStrengthPercent = computed(() => {
    const value = this.passwordValue().trim();
    if (!value) {
      return 0;
    }
    return (this.passwordStrength().score + 1) * 25;
  });

  readonly showPasswordStrength = computed(
    () => this.passwordFocused() || this.passwordValue().length > 0
  );

  constructor() {
    this.initializeResetToken();

    this.newPasswordControl?.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.passwordValue.set(value ?? '');
      });

    this.resetPasswordForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.successMessage()) {
          this.successMessage.set(null);
        }
      });
  }

  onSubmit(): void {
    const token = this.resetToken();
    if (!token) {
      this.resetLinkError.set(
        this.translateService.instant('AUTH.RESET_PASSWORD.RESET_LINK_INVALID')
      );
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const { newPassword } = this.resetPasswordForm.getRawValue();
    this.authService.resetPassword(token, newPassword).subscribe({
      next: (response) => {
        this.successMessage.set(response.message);
        this.resetPasswordForm.reset(
          {
            newPassword: '',
            confirmPassword: '',
          },
          { emitEvent: false }
        );
        this.resetPasswordForm.markAsPristine();
        this.resetPasswordForm.markAsUntouched();
        void this.router.navigate(['/login']).catch(() => undefined);
      },
      error: () => {
        // Error handled by AuthStore
      },
    });
  }

  onPasswordFocus(): void {
    this.passwordFocused.set(true);
  }

  onPasswordBlur(): void {
    this.passwordFocused.set(false);
  }

  getPasswordStrengthMessage(): string {
    return this.passwordStrengthService.getStrengthMessage(
      this.passwordStrength()
    );
  }

  get newPasswordControl() {
    return this.resetPasswordForm.get('newPassword');
  }

  get confirmPasswordControl() {
    return this.resetPasswordForm.get('confirmPassword');
  }

  get passwordMismatch(): boolean {
    return (
      this.resetPasswordForm.hasError('passwordMismatch') &&
      !!this.confirmPasswordControl?.touched
    );
  }

  private initializeResetToken(): void {
    const queryToken = this.route.snapshot.queryParamMap.get('token')?.trim();

    if (!queryToken) {
      this.resetLinkError.set(
        this.translateService.instant('AUTH.RESET_PASSWORD.RESET_LINK_INVALID')
      );
      return;
    }

    this.resetToken.set(queryToken);
  }

  private passwordMatchValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value as string | undefined;
    const confirmPassword = control.get('confirmPassword')?.value as
      | string
      | undefined;

    if (!newPassword || !confirmPassword) {
      return null;
    }

    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  private passwordPolicyValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const value = (control.value ?? '') as string;
    if (!value) {
      return null;
    }

    const requirements =
      this.passwordStrengthService.calculateStrength(value).requirements;
    const errors: ValidationErrors = {};

    if (!requirements.hasUpperCase) {
      errors['uppercase'] = true;
    }
    if (!requirements.hasLowerCase) {
      errors['lowercase'] = true;
    }
    if (!requirements.hasNumber) {
      errors['number'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }
}
