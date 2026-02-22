import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChangePasswordComponent } from './change-password.component';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';

const EN_TRANSLATIONS = {
  AUTH: {
    ACCESSIBILITY: {
      SKIP_TO_MAIN_CONTENT: 'Skip to main content',
      REQUIRED_FIELD: 'required',
    },
    CHANGE_PASSWORD: {
      TITLE: 'Change Password',
      SUBTITLE: 'Update your account password',
      CURRENT_PASSWORD_LABEL: 'Current Password',
      CURRENT_PASSWORD_PLACEHOLDER: '********',
      NEW_PASSWORD_LABEL: 'New Password',
      NEW_PASSWORD_PLACEHOLDER: '********',
      CONFIRM_PASSWORD_LABEL: 'Confirm New Password',
      CONFIRM_PASSWORD_PLACEHOLDER: '********',
      SUBMIT_BUTTON: 'Change Password',
      LOADING_BUTTON: 'Updating password...',
      CANCEL_BUTTON: 'Cancel',
      SUCCESS_MESSAGE:
        'Password changed successfully. Other sessions are now logged out.',
    },
    VALIDATION: {
      CURRENT_PASSWORD_REQUIRED: 'Current password is required',
      CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
      NEW_PASSWORD_REQUIRED: 'New password is required',
      PASSWORD_MINLENGTH: 'Password must be at least 8 characters',
      PASSWORD_STRENGTH:
        'Password must include uppercase, lowercase, and a number',
      PASSWORD_REUSE: 'New password must be different from current password',
      CONFIRM_PASSWORD_REQUIRED: 'Confirmation is required',
      PASSWORD_MISMATCH: 'Passwords do not match',
    },
  },
};

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let authService: jest.Mocked<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;
  let router: jest.Mocked<Router>;
  let translateService: TranslateService;

  beforeEach(async () => {
    authService = {
      changePassword: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    router = {
      navigateByUrl: jest.fn(),
    } as unknown as jest.Mocked<Router>;

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        AuthStore,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
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

  describe('component initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize form with empty values', () => {
      expect(component.changePasswordForm.value).toEqual({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    });

    it('should have form marked as invalid initially', () => {
      expect(component.changePasswordForm.invalid).toBe(true);
    });
  });

  describe('form validation', () => {
    it('should require current password', () => {
      const control = component.currentPasswordControl!;
      control.setValue('');
      expect(control.hasError('required')).toBe(true);
    });

    it('should validate new password requirements', () => {
      const control = component.newPasswordControl!;

      control.setValue('short');
      expect(control.hasError('minlength')).toBe(true);

      control.setValue('lowercase1');
      expect(control.hasError('uppercase')).toBe(true);

      control.setValue('UPPERCASE1');
      expect(control.hasError('lowercase')).toBe(true);

      control.setValue('Password');
      expect(control.hasError('number')).toBe(true);
    });

    it('should require confirm password and match', () => {
      component.newPasswordControl!.setValue('Password1');
      component.confirmPasswordControl!.setValue('Password2');
      component.confirmPasswordControl!.markAsTouched();
      fixture.detectChanges();

      expect(component.passwordMismatch).toBe(true);

      component.confirmPasswordControl!.setValue('Password1');
      fixture.detectChanges();

      expect(component.passwordMismatch).toBe(false);
    });

    it('should require new password to be different from current', () => {
      component.currentPasswordControl!.setValue('Password1');
      component.newPasswordControl!.setValue('Password1');
      component.newPasswordControl!.markAsTouched();
      fixture.detectChanges();

      expect(component.passwordReuse).toBe(true);
    });
  });

  describe('password strength indicator', () => {
    it('should update strength when new password changes', () => {
      component.newPasswordControl!.setValue('Password1');
      fixture.detectChanges();

      expect(component.passwordStrength().strength).toBe('Strong');
    });
  });

  describe('form submission', () => {
    it('should not submit when form is invalid', () => {
      component.onSubmit();

      expect(authService.changePassword).not.toHaveBeenCalled();
      expect(component.changePasswordForm.touched).toBe(true);
    });

    it('should call authService.changePassword with valid values', () => {
      authService.changePassword.mockReturnValue(of(undefined));

      component.changePasswordForm.setValue({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1',
      });

      component.onSubmit();

      expect(authService.changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
      });
    });

    it('should set success message on success', () => {
      authService.changePassword.mockReturnValue(of(undefined));

      component.changePasswordForm.setValue({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1',
      });

      component.onSubmit();
      fixture.detectChanges();

      expect(component.successMessage()).toContain(
        'Password changed successfully'
      );
    });

    it('should set incorrect error on 401 response', () => {
      authService.changePassword.mockReturnValue(
        throwError(() => ({ status: 401 }))
      );

      component.changePasswordForm.setValue({
        currentPassword: 'WrongPassword1',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1',
      });

      component.onSubmit();

      expect(component.currentPasswordControl?.hasError('incorrect')).toBe(
        true
      );
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
      expect(submitButton.textContent).toContain('Updating password');
    });

    it('should show global error from store', () => {
      authStore.setError('Password change failed');
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.alert-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Password change failed');
    });
  });

  describe('password fields', () => {
    it('should keep all password inputs masked', () => {
      const currentInput =
        fixture.nativeElement.querySelector('#currentPassword');
      const newInput = fixture.nativeElement.querySelector('#newPassword');
      const confirmInput =
        fixture.nativeElement.querySelector('#confirmPassword');

      expect(currentInput.getAttribute('type')).toBe('password');
      expect(newInput.getAttribute('type')).toBe('password');
      expect(confirmInput.getAttribute('type')).toBe('password');
    });

    it('should not render password visibility toggle buttons', () => {
      const toggleButtons =
        fixture.nativeElement.querySelectorAll('.toggle-button');

      expect(toggleButtons.length).toBe(0);
    });
  });
});
