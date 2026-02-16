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
import { CreateUserDto } from '@khana/shared-dtos';
import {
  PasswordStrengthResult,
  PasswordStrengthService,
} from './services/password-strength.service';
import { PasswordStrengthIndicatorComponent } from '../shared';

@Component({
  selector: 'khana-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PasswordStrengthIndicatorComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordStrengthService = inject(PasswordStrengthService);

  readonly authStore = inject(AuthStore);

  readonly passwordFocused = signal(false);
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
    () => this.passwordFocused() || this.passwordValue().length > 0
  );

  readonly registerForm = this.fb.nonNullable.group(
    {
      email: [
        '',
        [Validators.required, Validators.email],
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          this.passwordPolicyValidator.bind(this),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [this.optionalPhoneValidator.bind(this)]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    { validators: [this.passwordMatchValidator.bind(this)] }
  );

  ngOnInit(): void {
    this.passwordControl?.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.passwordValue.set(value ?? '');
      });

    this.emailControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.emailControl?.hasError('duplicate')) {
          const errors = { ...(this.emailControl.errors ?? {}) };
          delete errors['duplicate'];
          this.emailControl.setErrors(
            Object.keys(errors).length > 0 ? errors : null
          );
        }
      });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { email, password, name, phone } = this.registerForm.getRawValue();

    const payload: CreateUserDto = {
      email: email.trim(),
      password,
      name: name.trim(),
      phone: phone?.trim() || undefined,
    };

    this.authService.register(payload).subscribe({
      next: () => {
        const returnUrl = sessionStorage.getItem('returnUrl') || '/dashboard';
        sessionStorage.removeItem('returnUrl');
        this.router.navigateByUrl(returnUrl);
      },
      error: (error) => {
        if (error?.status === 409) {
          this.emailControl?.setErrors({
            ...(this.emailControl.errors ?? {}),
            duplicate: true,
          });
        }
      },
    });
  }

  validateEmail(): Observable<boolean> {
    return of(true);
  }

  validatePassword(password: string): PasswordStrengthResult {
    return this.passwordStrengthService.calculateStrength(password);
  }

  getPasswordStrengthMessage(): string {
    return this.passwordStrengthService.getStrengthMessage(
      this.passwordStrength()
    );
  }

  onPasswordFocus(): void {
    this.passwordFocused.set(true);
  }

  onPasswordBlur(): void {
    this.passwordFocused.set(false);
  }

  onCancel(): void {
    this.router.navigateByUrl('/login');
  }

  get emailControl() {
    return this.registerForm.get('email');
  }

  get passwordControl() {
    return this.registerForm.get('password');
  }

  get confirmPasswordControl() {
    return this.registerForm.get('confirmPassword');
  }

  get nameControl() {
    return this.registerForm.get('name');
  }

  get phoneControl() {
    return this.registerForm.get('phone');
  }

  get termsControl() {
    return this.registerForm.get('acceptTerms');
  }

  get passwordMismatch(): boolean {
    return (
      this.registerForm.hasError('passwordMismatch') &&
      !!this.confirmPasswordControl?.touched
    );
  }

  private passwordMatchValidator(
    control: AbstractControl
  ): ValidationErrors | null {
    const password = control.get('password')?.value as string | undefined;
    const confirmPassword = control.get('confirmPassword')?.value as
      | string
      | undefined;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
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
