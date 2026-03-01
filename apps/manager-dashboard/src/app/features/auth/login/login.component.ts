import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';
import { LanguageService } from '../../../shared/services/language.service';
import { LoginResponseDto, UserRole } from '@khana/shared-dtos';

/**
 * LoginComponent
 *
 * User authentication page with email/password login.
 *
 * Features:
 * - Desert Night theme styling
 * - RTL support (CSS Logical Properties)
 * - WCAG 2.1 AA accessibility
 * - Form validation with error messages
 * - Loading states and error handling
 * - Responsive mobile-first design
 */
@Component({
  selector: 'khana-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslateModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  public readonly languageService = inject(LanguageService);

  readonly authStore = inject(AuthStore);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const email = this.emailControl?.value ?? '';
    const password = this.passwordControl?.value ?? '';
    if (!email || !password) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.authService.login(email, password).subscribe({
      next: (response) => {
        const targetUrl = this.resolvePostAuthRedirect(response);
        this.router.navigateByUrl(targetUrl);
      },
      error: () => {
        // Error handled by AuthStore
      },
    });
  }

  get emailControl() {
    return this.loginForm.get('email');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  private resolvePostAuthRedirect(
    response: LoginResponseDto | null | undefined
  ): string {
    const returnUrl = sessionStorage.getItem('returnUrl');
    if (returnUrl) {
      sessionStorage.removeItem('returnUrl');
      if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
        return returnUrl;
      }
    }

    const user = response?.user;
    if (!user) {
      return '/dashboard';
    }

    if (user.role === UserRole.OWNER && user.onboardingCompleted !== true) {
      return '/onboarding';
    }

    return '/dashboard';
  }
}
