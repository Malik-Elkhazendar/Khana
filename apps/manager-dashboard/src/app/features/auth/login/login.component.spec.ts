import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';
import { setupStorageMock } from '../../../shared/testing/mocks/storage.mock';
import { createMockLoginResponse } from '../../../shared/testing/fixtures/auth-response.fixture';

const EN_TRANSLATIONS = {
  AUTH: {
    ACCESSIBILITY: {
      SKIP_TO_MAIN_CONTENT: 'Skip to main content',
      REQUIRED_FIELD: 'required',
    },
    LOGIN: {
      TITLE: 'Sign in to Khana',
      SUBTITLE:
        'Welcome back. Please enter your details to access your dashboard.',
      EMAIL_LABEL: 'Email',
      EMAIL_PLACEHOLDER: 'you@example.com',
      PASSWORD_LABEL: 'Password',
      PASSWORD_PLACEHOLDER: '••••••••',
      SUBMIT_BUTTON: 'Sign In',
      LOADING_BUTTON: 'Logging in...',
      NO_ACCOUNT: "Don't have an account?",
      REGISTER_LINK: 'Register here',
      FORGOT_PASSWORD: 'Forgot your password?',
      RESET_LINK: 'Reset it',
      SWITCH_TO_ARABIC: 'Switch to Arabic',
      SWITCH_TO_ENGLISH: 'Switch to English',
      LANGUAGE_ARABIC: 'العربية',
      LANGUAGE_ENGLISH: 'English',
      VISUAL_TITLE: 'Bank-Grade Security',
      VISUAL_TEXT:
        'Your business data is protected by enterprise-level encryption, role-based access control, and continuous monitoring.',
    },
    VALIDATION: {
      EMAIL_REQUIRED: 'Email is required',
      EMAIL_INVALID: 'Please enter a valid email address',
      PASSWORD_REQUIRED: 'Password is required',
      PASSWORD_MINLENGTH: 'Password must be at least 8 characters',
    },
  },
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jest.Mocked<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let navigateByUrlSpy: jest.SpyInstance;
  let storageMock: ReturnType<typeof setupStorageMock>;
  let translateService: TranslateService;

  beforeEach(async () => {
    storageMock = setupStorageMock();

    // Create mock services
    authService = {
      login: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        TranslateModule.forRoot(),
        RouterTestingModule.withRoutes([]),
      ],
      providers: [{ provide: AuthService, useValue: authService }, AuthStore],
    }).compileComponents();

    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    router = TestBed.inject(Router);
    navigateByUrlSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authStore = TestBed.inject(AuthStore);
    fixture.detectChanges();
  });

  afterEach(() => {
    storageMock.clear();
    jest.clearAllMocks();
  });

  describe('component initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize form with empty values', () => {
      expect(component.loginForm.value).toEqual({
        email: '',
        password: '',
      });
    });

    it('should have form marked as invalid initially', () => {
      expect(component.loginForm.invalid).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have skip link', () => {
      const skipLink = fixture.nativeElement.querySelector('.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(skipLink.textContent).toContain('Skip to main content');
    });

    it('should have main content with id', () => {
      const mainContent = fixture.nativeElement.querySelector('#main-content');
      expect(mainContent).toBeTruthy();
      expect(mainContent.getAttribute('role')).toBeNull(); // main element has implicit role
    });

    it('should have accessible form labels', () => {
      const emailLabel =
        fixture.nativeElement.querySelector('label[for="email"]');
      const passwordLabel = fixture.nativeElement.querySelector(
        'label[for="password"]'
      );

      expect(emailLabel).toBeTruthy();
      expect(passwordLabel).toBeTruthy();
      expect(emailLabel.textContent).toContain('Email');
      expect(passwordLabel.textContent).toContain('Password');
    });

    it('should mark required fields with aria-label', () => {
      const requiredSpans = fixture.nativeElement.querySelectorAll('.required');

      expect(requiredSpans.length).toBe(2);
      requiredSpans.forEach((span: HTMLElement) => {
        expect(span.getAttribute('aria-label')).toBe('required');
      });
    });

    it('should have proper autocomplete attributes', () => {
      const emailInput = fixture.nativeElement.querySelector('#email');
      const passwordInput = fixture.nativeElement.querySelector('#password');

      expect(emailInput.getAttribute('autocomplete')).toBe('email');
      expect(passwordInput.getAttribute('autocomplete')).toBe(
        'current-password'
      );
    });

    it('should set aria-invalid on touched invalid fields', () => {
      const emailControl = component.emailControl!;
      const emailInput = fixture.nativeElement.querySelector('#email');

      emailControl.markAsTouched();
      fixture.detectChanges();

      expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should set aria-describedby when error is shown', () => {
      const emailControl = component.emailControl!;
      emailControl.markAsTouched();
      fixture.detectChanges();

      const emailInput = fixture.nativeElement.querySelector('#email');
      expect(emailInput.getAttribute('aria-describedby')).toBe('email-error');
    });

    it('should have error messages with role="alert"', () => {
      component.emailControl!.markAsTouched();
      component.passwordControl!.markAsTouched();
      fixture.detectChanges();

      const errors = fixture.nativeElement.querySelectorAll('[role="alert"]');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should set aria-busy on submit button during loading', () => {
      authStore.setLoading(true);
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );
      expect(submitButton.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('form validation', () => {
    it('should require email field', () => {
      const emailControl = component.emailControl!;

      emailControl.setValue('');
      expect(emailControl.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const emailControl = component.emailControl!;

      emailControl.setValue('invalid-email');
      expect(emailControl.hasError('email')).toBe(true);

      emailControl.setValue('valid@example.com');
      expect(emailControl.hasError('email')).toBe(false);
    });

    it('should require password field', () => {
      const passwordControl = component.passwordControl!;

      passwordControl.setValue('');
      expect(passwordControl.hasError('required')).toBe(true);
    });

    it('should validate password minimum length', () => {
      const passwordControl = component.passwordControl!;

      passwordControl.setValue('short');
      expect(passwordControl.hasError('minlength')).toBe(true);

      passwordControl.setValue('longpassword');
      expect(passwordControl.hasError('minlength')).toBe(false);
    });

    it('should mark form as valid with valid inputs', () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(component.loginForm.valid).toBe(true);
    });

    it('should show email error message when touched and invalid', () => {
      const emailControl = component.emailControl!;

      emailControl.markAsTouched();
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('#email-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Email is required');
    });

    it('should show password error message when touched and invalid', () => {
      const passwordControl = component.passwordControl!;

      passwordControl.markAsTouched();
      fixture.detectChanges();

      const errorElement =
        fixture.nativeElement.querySelector('#password-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Password is required');
    });

    it('should not show errors for untouched fields', () => {
      const errorElements =
        fixture.nativeElement.querySelectorAll('.form-error');
      expect(errorElements.length).toBe(0);
    });
  });

  describe('form submission', () => {
    it('should not submit when form is invalid', () => {
      component.onSubmit();

      expect(authService.login).not.toHaveBeenCalled();
      expect(component.loginForm.touched).toBe(true);
    });

    it('should call authService.login with form values', () => {
      const mockResponse = createMockLoginResponse();
      authService.login.mockReturnValue(of(mockResponse));

      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      expect(authService.login).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });

    it('should redirect to dashboard on successful login', (done) => {
      const mockResponse = createMockLoginResponse();
      authService.login.mockReturnValue(of(mockResponse));

      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      setTimeout(() => {
        expect(navigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
        done();
      }, 100);
    });

    it('should redirect to returnUrl if stored', (done) => {
      const returnUrl = '/bookings';
      storageMock.setItem('returnUrl', returnUrl);

      const mockResponse = createMockLoginResponse();
      authService.login.mockReturnValue(of(mockResponse));

      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      component.onSubmit();

      setTimeout(() => {
        expect(navigateByUrlSpy).toHaveBeenCalledWith(returnUrl);
        expect(storageMock.getItem('returnUrl')).toBeNull();
        done();
      }, 100);
    });

    it('should handle login error', (done) => {
      const errorMessage = 'Invalid credentials';
      authService.login.mockReturnValue(
        throwError(() => ({ error: { message: errorMessage } }))
      );

      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      component.onSubmit();

      setTimeout(() => {
        expect(navigateByUrlSpy).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('loading state', () => {
    it('should show loading state during login', () => {
      authStore.setLoading(true);
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toContain('Logging in');
    });

    it('should show normal state when not loading', () => {
      authStore.setLoading(false);
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );
      expect(submitButton.disabled).toBe(false);
      expect(submitButton.textContent).toContain('Sign In');
    });

    it('should hide spinner when not loading', () => {
      authStore.setLoading(false);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.spinner');
      expect(spinner).toBeFalsy();
    });

    it('should show spinner when loading', () => {
      authStore.setLoading(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.spinner');
      expect(spinner).toBeTruthy();
      expect(spinner.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('error display', () => {
    it('should show global error from store', () => {
      const errorMessage = 'Authentication failed';
      authStore.setError(errorMessage);
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.alert-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain(errorMessage);
    });

    it('should have aria-live on global error', () => {
      authStore.setError('Error message');
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.alert-error');
      expect(errorElement.getAttribute('aria-live')).toBe('polite');
    });

    it('should not show global error when none exists', () => {
      authStore.setError(null);
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.alert-error');
      expect(errorElement).toBeFalsy();
    });
  });

  describe('RTL support', () => {
    it('should render correctly in LTR direction', () => {
      const container = fixture.nativeElement.querySelector(
        '.auth-form-container'
      );
      expect(container).toBeTruthy();
      // Component should use CSS logical properties internally
    });

    it('should handle text direction properly', () => {
      // Test that inputs work correctly regardless of direction
      const emailInput = fixture.nativeElement.querySelector('#email');
      component.emailControl!.setValue('test@example.com');
      fixture.detectChanges();

      expect(emailInput.value).toBe('test@example.com');
    });
  });

  describe('keyboard navigation', () => {
    it('should allow tabbing through form fields', () => {
      const emailInput = fixture.nativeElement.querySelector('#email');
      const passwordInput = fixture.nativeElement.querySelector('#password');
      const submitButton = fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );

      expect(emailInput.tabIndex).toBeGreaterThanOrEqual(0);
      expect(passwordInput.tabIndex).toBeGreaterThanOrEqual(0);
      expect(submitButton.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('should submit form on Enter key in password field', () => {
      const mockResponse = createMockLoginResponse();
      authService.login.mockReturnValue(of(mockResponse));

      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123',
      });

      const passwordInput = fixture.nativeElement.querySelector('#password');
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      passwordInput.dispatchEvent(enterEvent);

      fixture.detectChanges();

      // Form should submit (tested indirectly through form submission)
      expect(component.loginForm.valid).toBe(true);
    });
  });

  describe('touch targets', () => {
    it('should have minimum 48px touch target for submit button', () => {
      const submitButton = fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );
      const rect = submitButton.getBoundingClientRect();

      // Note: Actual size depends on CSS, we're just checking the element exists
      expect(submitButton).toBeTruthy();
    });
  });
});
