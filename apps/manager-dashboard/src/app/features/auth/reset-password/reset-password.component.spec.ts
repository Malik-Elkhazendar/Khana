import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';

const EN_TRANSLATIONS = {
  AUTH: {
    ACCESSIBILITY: {
      SKIP_TO_MAIN_CONTENT: 'Skip to main content',
      REQUIRED_FIELD: 'required',
    },
    RESET_PASSWORD: {
      TITLE: 'Reset Password',
      SUBTITLE: 'Choose your new password to complete the reset',
      NEW_PASSWORD_LABEL: 'New Password',
      NEW_PASSWORD_PLACEHOLDER: '********',
      CONFIRM_PASSWORD_LABEL: 'Confirm New Password',
      CONFIRM_PASSWORD_PLACEHOLDER: '********',
      SUBMIT_BUTTON: 'Reset Password',
      LOADING_BUTTON: 'Resetting...',
      BACK_TO_LOGIN: 'Back to account login?',
      BACK_TO_LOGIN_LINK: 'Sign in',
      REQUEST_NEW_LINK: 'Request a new reset link',
      RESET_LINK_INVALID:
        'Reset link is missing or invalid. Please request a new password reset email.',
    },
    VALIDATION: {
      NEW_PASSWORD_REQUIRED: 'New password is required',
      PASSWORD_MINLENGTH: 'Password must be at least 8 characters',
      PASSWORD_STRENGTH:
        'Password must include uppercase, lowercase, and a number',
      CONFIRM_PASSWORD_REQUIRED: 'Confirmation is required',
      PASSWORD_MISMATCH: 'Passwords do not match',
    },
  },
};

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: jest.Mocked<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let translateService: TranslateService;

  beforeEach(async () => {
    authService = {
      resetPassword: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    await TestBed.configureTestingModule({
      imports: [
        ResetPasswordComponent,
        RouterTestingModule.withRoutes([]),
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'query-token-123' }),
            },
          },
        },
        AuthStore,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prefill token from query params', () => {
    expect(component.resetToken()).toBe('query-token-123');
  });

  it('should not submit when form is invalid', () => {
    component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.resetPasswordForm.touched).toBe(true);
  });

  it('should validate password mismatch', () => {
    component.newPasswordControl?.setValue('Password123');
    component.confirmPasswordControl?.setValue('Password321');
    component.confirmPasswordControl?.markAsTouched();
    fixture.detectChanges();

    expect(component.passwordMismatch).toBe(true);
  });

  it('should call authService.resetPassword with valid form values', () => {
    authService.resetPassword.mockReturnValue(
      of({ message: 'Password has been reset successfully' })
    );

    component.resetPasswordForm.setValue({
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    });
    component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'query-token-123',
      'Password123'
    );
  });

  it('should set success message on success', () => {
    authService.resetPassword.mockReturnValue(
      of({ message: 'Password has been reset successfully' })
    );

    component.resetPasswordForm.setValue({
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    });
    component.onSubmit();

    expect(component.successMessage()).toBe(
      'Password has been reset successfully'
    );
    expect(component.newPasswordControl?.value).toBe('');
    expect(component.confirmPasswordControl?.value).toBe('');
  });

  it('should navigate to login on successful reset', () => {
    authService.resetPassword.mockReturnValue(
      of({ message: 'Password has been reset successfully' })
    );

    component.resetPasswordForm.setValue({
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    });
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should keep success message unset on error', () => {
    authService.resetPassword.mockReturnValue(
      throwError(() => ({ status: 400 }))
    );

    component.resetPasswordForm.setValue({
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    });
    component.onSubmit();

    expect(component.successMessage()).toBeNull();
  });

  it('should block submit when reset token is missing', () => {
    component.resetToken.set(null);
    component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.resetLinkError()).toContain('missing or invalid');
  });

  it('should disable submit button while loading', () => {
    authStore.setLoading(true);
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]'
    );
    expect(submitButton.disabled).toBe(true);
  });
});
