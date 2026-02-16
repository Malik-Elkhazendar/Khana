import {
  Component,
  DestroyRef,
  OnInit,
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
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, of, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';
import { ChangePasswordDto } from '@khana/shared-dtos';
import {
  PasswordStrengthResult,
  PasswordStrengthService,
} from '../register/services/password-strength.service';
import { PasswordStrengthIndicatorComponent } from '../shared';

@Component({
  selector: 'khana-change-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PasswordStrengthIndicatorComponent,
  ],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordStrengthService = inject(PasswordStrengthService);

  readonly authStore = inject(AuthStore);
  readonly successMessage = signal<string | null>(null);

  readonly newPasswordFocused = signal(false);
  readonly passwordValue = signal('');

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
    () => this.newPasswordFocused() || this.passwordValue().length > 0
  );

  readonly changePasswordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
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
      validators: [
        this.passwordMatchValidator.bind(this),
        this.newPasswordDifferentValidator.bind(this),
      ],
    }
  );

  ngOnInit(): void {
    this.newPasswordControl?.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.passwordValue.set(value ?? '');
      });

    this.currentPasswordControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.currentPasswordControl?.hasError('incorrect')) {
          const errors = { ...(this.currentPasswordControl.errors ?? {}) };
          delete errors['incorrect'];
          this.currentPasswordControl.setErrors(
            Object.keys(errors).length > 0 ? errors : null
          );
        }
      });

    this.changePasswordForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.successMessage()) {
          this.successMessage.set(null);
        }
      });
  }

  onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } =
      this.changePasswordForm.getRawValue();

    const payload: ChangePasswordDto = {
      currentPassword,
      newPassword,
    };

    this.authService.changePassword(payload).subscribe({
      next: () => {
        this.changePasswordForm.reset();
        this.successMessage.set(
          'Password changed successfully. Other sessions are now logged out.'
        );
      },
      error: (error) => {
        if (error?.status === 401) {
          this.currentPasswordControl?.setErrors({
            ...(this.currentPasswordControl.errors ?? {}),
            incorrect: true,
          });
        }
      },
    });
  }

  validateCurrentPassword(): Observable<boolean> {
    return of(true);
  }

  validatePasswordStrength(password: string): PasswordStrengthResult {
    return this.passwordStrengthService.calculateStrength(password);
  }

  getPasswordStrengthMessage(): string {
    return this.passwordStrengthService.getStrengthMessage(
      this.passwordStrength()
    );
  }

  onNewPasswordFocus(): void {
    this.newPasswordFocused.set(true);
  }

  onNewPasswordBlur(): void {
    this.newPasswordFocused.set(false);
  }

  onCancel(): void {
    this.router.navigateByUrl('/dashboard');
  }

  get currentPasswordControl() {
    return this.changePasswordForm.get('currentPassword');
  }

  get newPasswordControl() {
    return this.changePasswordForm.get('newPassword');
  }

  get confirmPasswordControl() {
    return this.changePasswordForm.get('confirmPassword');
  }

  get passwordMismatch(): boolean {
    return (
      this.changePasswordForm.hasError('passwordMismatch') &&
      !!this.confirmPasswordControl?.touched
    );
  }

  get passwordReuse(): boolean {
    return (
      this.changePasswordForm.hasError('passwordReuse') &&
      !!this.newPasswordControl?.touched
    );
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

  private newPasswordDifferentValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const currentPassword = control.get('currentPassword')?.value as
      | string
      | undefined;
    const newPassword = control.get('newPassword')?.value as string | undefined;

    if (!currentPassword || !newPassword) {
      return null;
    }

    return currentPassword === newPassword ? { passwordReuse: true } : null;
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
