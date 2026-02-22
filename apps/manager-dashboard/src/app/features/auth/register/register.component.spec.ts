import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RegisterComponent } from './register.component';
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
    REGISTER: {
      TITLE: 'Create Account',
      SUBTITLE: 'Join Khana Booking Platform',
      HAVE_ACCOUNT: 'Already have an account?',
      SIGNIN_LINK: 'Sign in',
      EMAIL_LABEL: 'Email',
      EMAIL_PLACEHOLDER: 'business@example.com',
      NAME_LABEL: 'Full Name',
      NAME_PLACEHOLDER: 'Full Name',
      PHONE_LABEL: 'Phone (optional)',
      PHONE_PLACEHOLDER: '+966 50 123 4567',
      PASSWORD_LABEL: 'Password',
      PASSWORD_PLACEHOLDER: '********',
      CONFIRM_PASSWORD_LABEL: 'Confirm Password',
      CONFIRM_PASSWORD_PLACEHOLDER: '********',
      AGREE_TERMS_TEXT: 'I agree to the',
      TERMS_LINK: 'Terms',
      SUBMIT_BUTTON: 'Create Account',
      LOADING_BUTTON: 'Creating account...',
      CANCEL_BUTTON: 'Cancel',
      BACK_LOGIN_LINK: 'Back to login',
      BACK_HOME_LINK: 'Go to landing page',
      VISUAL_TITLE: 'Power Your Business',
      VISUAL_TEXT:
        'Join the Khana ecosystem. Streamline your operations, eliminate double bookings, and deliver flawless customer experiences.',
    },
    VALIDATION: {
      EMAIL_REQUIRED: 'Email is required',
      EMAIL_INVALID: 'Please enter a valid email address',
      EMAIL_DUPLICATE: 'Email already in use',
      NAME_REQUIRED: 'Full name is required',
      NAME_MINLENGTH: 'Name must be at least 2 characters',
      PHONE_INVALID: 'Please enter a valid phone number',
      PASSWORD_REQUIRED: 'Password is required',
      PASSWORD_MINLENGTH: 'Password must be at least 8 characters',
      PASSWORD_STRENGTH:
        'Password must include uppercase, lowercase, and a number',
      CONFIRM_REQUIRED: 'Confirmation is required',
      PASSWORD_MISMATCH: 'Passwords do not match',
      TERMS_REQUIRED: 'You must accept the terms to continue',
    },
  },
};

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: jest.Mocked<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let navigateByUrlSpy: jest.SpyInstance;
  let storageMock: ReturnType<typeof setupStorageMock>;
  let translateService: TranslateService;

  beforeEach(async () => {
    storageMock = setupStorageMock();

    authService = {
      register: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        AuthStore,
      ],
    }).compileComponents();

    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
    navigateByUrlSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
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
      expect(component.registerForm.value).toEqual({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        acceptTerms: false,
      });
    });

    it('should have form marked as invalid initially', () => {
      expect(component.registerForm.invalid).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have skip link', () => {
      const skipLink = fixture.nativeElement.querySelector('.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink.getAttribute('href')).toBe('#main-content');
    });

    it('should have proper labels', () => {
      const emailLabel =
        fixture.nativeElement.querySelector('label[for="email"]');
      const nameLabel =
        fixture.nativeElement.querySelector('label[for="name"]');

      expect(emailLabel).toBeTruthy();
      expect(nameLabel).toBeTruthy();
    });

    it('should set aria-invalid on touched invalid fields', () => {
      const emailControl = component.emailControl!;
      const emailInput = fixture.nativeElement.querySelector('#email');

      emailControl.markAsTouched();
      fixture.detectChanges();

      expect(emailInput.getAttribute('aria-invalid')).toBe('true');
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

    it('should require full name', () => {
      const nameControl = component.nameControl!;
      nameControl.setValue('');
      expect(nameControl.hasError('required')).toBe(true);
    });

    it('should validate password requirements', () => {
      const passwordControl = component.passwordControl!;

      passwordControl.setValue('short');
      expect(passwordControl.hasError('minlength')).toBe(true);

      passwordControl.setValue('lowercase1');
      expect(passwordControl.hasError('uppercase')).toBe(true);

      passwordControl.setValue('UPPERCASE1');
      expect(passwordControl.hasError('lowercase')).toBe(true);

      passwordControl.setValue('Password');
      expect(passwordControl.hasError('number')).toBe(true);
    });

    it('should require confirm password and match', () => {
      component.passwordControl!.setValue('Password1');
      component.confirmPasswordControl!.setValue('Password2');
      component.confirmPasswordControl!.markAsTouched();
      fixture.detectChanges();

      expect(component.passwordMismatch).toBe(true);

      component.confirmPasswordControl!.setValue('Password1');
      fixture.detectChanges();

      expect(component.passwordMismatch).toBe(false);
    });

    it('should validate optional phone number when provided', () => {
      const phoneControl = component.phoneControl!;

      phoneControl.setValue('abc');
      expect(phoneControl.hasError('phone')).toBe(true);

      phoneControl.setValue('+966 50 123 4567');
      expect(phoneControl.hasError('phone')).toBe(false);
    });

    it('should require terms acceptance', () => {
      const termsControl = component.termsControl!;
      termsControl.setValue(false);
      termsControl.markAsTouched();
      fixture.detectChanges();

      expect(termsControl.hasError('required')).toBe(true);
    });
  });

  describe('password strength indicator', () => {
    it('should update strength when password changes', () => {
      component.passwordControl!.setValue('Password1');
      fixture.detectChanges();

      expect(component.passwordStrength().strength).toBe('Strong');
    });

    it('should show weak strength for empty password', () => {
      component.passwordControl!.setValue('');
      fixture.detectChanges();

      expect(component.passwordStrength().strength).toBe('Weak');
    });
  });

  describe('form submission', () => {
    it('should not submit when form is invalid', () => {
      component.onSubmit();

      expect(authService.register).not.toHaveBeenCalled();
      expect(component.registerForm.touched).toBe(true);
    });

    it('should call authService.register with valid form values', () => {
      const mockResponse = createMockLoginResponse();
      authService.register.mockReturnValue(of(mockResponse));

      component.registerForm.setValue({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        name: 'Test User',
        phone: '+1234567890',
        acceptTerms: true,
      });

      component.onSubmit();

      expect(authService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password1',
        name: 'Test User',
        phone: '+1234567890',
      });
    });

    it('should redirect to dashboard on success', (done) => {
      const mockResponse = createMockLoginResponse();
      authService.register.mockReturnValue(of(mockResponse));

      component.registerForm.setValue({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        name: 'Test User',
        phone: '',
        acceptTerms: true,
      });

      component.onSubmit();

      setTimeout(() => {
        expect(navigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
        done();
      }, 100);
    });

    it('should redirect to returnUrl when present', (done) => {
      storageMock.setItem('returnUrl', '/dashboard/bookings');
      const mockResponse = createMockLoginResponse();
      authService.register.mockReturnValue(of(mockResponse));

      component.registerForm.setValue({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        name: 'Test User',
        phone: '',
        acceptTerms: true,
      });

      component.onSubmit();

      setTimeout(() => {
        expect(navigateByUrlSpy).toHaveBeenCalledWith('/dashboard/bookings');
        done();
      }, 100);
    });

    it('should set duplicate error on 409 conflict', () => {
      authService.register.mockReturnValue(throwError(() => ({ status: 409 })));

      component.registerForm.setValue({
        email: 'existing@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        name: 'Test User',
        phone: '',
        acceptTerms: true,
      });

      component.onSubmit();

      expect(component.emailControl?.hasError('duplicate')).toBe(true);
    });
  });

  describe('loading and error states', () => {
    it('should show loading state during submission', () => {
      authStore.setLoading(true);
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toContain('Creating account');
    });

    it('should show global error from store', () => {
      authStore.setError('Registration failed');
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.alert-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Registration failed');
    });
  });

  describe('password fields', () => {
    it('should keep password inputs masked', () => {
      const passwordInput = fixture.nativeElement.querySelector('#password');
      const confirmInput =
        fixture.nativeElement.querySelector('#confirmPassword');

      expect(passwordInput.getAttribute('type')).toBe('password');
      expect(confirmInput.getAttribute('type')).toBe('password');
    });

    it('should not render password visibility toggle buttons', () => {
      const toggleButtons =
        fixture.nativeElement.querySelectorAll('.toggle-button');

      expect(toggleButtons.length).toBe(0);
    });
  });
});
