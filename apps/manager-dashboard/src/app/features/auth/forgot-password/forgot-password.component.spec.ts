import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';

const EN_TRANSLATIONS = {
  AUTH: {
    ACCESSIBILITY: {
      SKIP_TO_MAIN_CONTENT: 'Skip to main content',
      REQUIRED_FIELD: 'required',
    },
    FORGOT_PASSWORD: {
      TITLE: 'Forgot Password',
      SUBTITLE:
        'Enter your account email to receive a secure password reset link',
      EMAIL_LABEL: 'Email',
      EMAIL_PLACEHOLDER: 'you@example.com',
      SUBMIT_BUTTON: 'Send Reset Link',
      LOADING_BUTTON: 'Sending...',
      BACK_TO_LOGIN: 'Remembered your password?',
      BACK_TO_LOGIN_LINK: 'Back to login',
    },
    VALIDATION: {
      EMAIL_REQUIRED: 'Email is required',
      EMAIL_INVALID: 'Please enter a valid email address',
    },
  },
};

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authService: jest.Mocked<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let translateService: TranslateService;

  beforeEach(async () => {
    authService = {
      forgotPassword: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent,
        RouterTestingModule.withRoutes([]),
        TranslateModule.forRoot(),
      ],
      providers: [{ provide: AuthService, useValue: authService }, AuthStore],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    authStore = TestBed.inject(AuthStore);
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit when form is invalid', () => {
    component.onSubmit();

    expect(authService.forgotPassword).not.toHaveBeenCalled();
    expect(component.forgotPasswordForm.touched).toBe(true);
  });

  it('should call authService.forgotPassword with valid email', () => {
    authService.forgotPassword.mockReturnValue(
      of({ message: 'If that email exists, a reset link has been sent' })
    );

    component.forgotPasswordForm.setValue({ email: 'user@example.com' });
    component.onSubmit();

    expect(authService.forgotPassword).toHaveBeenCalledWith('user@example.com');
  });

  it('should set success message on success', () => {
    authService.forgotPassword.mockReturnValue(
      of({ message: 'If that email exists, a reset link has been sent' })
    );

    component.forgotPasswordForm.setValue({ email: 'user@example.com' });
    component.onSubmit();

    expect(component.successMessage()).toBe(
      'If that email exists, a reset link has been sent'
    );
  });

  it('should keep success message unset on error', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({ status: 400 }))
    );

    component.forgotPasswordForm.setValue({ email: 'user@example.com' });
    component.onSubmit();

    expect(component.successMessage()).toBeNull();
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
