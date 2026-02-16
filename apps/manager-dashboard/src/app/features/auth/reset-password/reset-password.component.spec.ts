import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../shared/services/auth.service';
import { AuthStore } from '../../../shared/state/auth.store';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: jest.Mocked<AuthService>;
  let authStore: InstanceType<typeof AuthStore>;

  beforeEach(async () => {
    authService = {
      resetPassword: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent, RouterTestingModule.withRoutes([])],
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
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prefill token from query params', () => {
    expect(component.tokenControl?.value).toBe('query-token-123');
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
      token: '  token-from-form  ',
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    });
    component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'token-from-form',
      'Password123'
    );
  });

  it('should set success message on success', () => {
    authService.resetPassword.mockReturnValue(
      of({ message: 'Password has been reset successfully' })
    );

    component.resetPasswordForm.setValue({
      token: 'token-123',
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

  it('should keep success message unset on error', () => {
    authService.resetPassword.mockReturnValue(
      throwError(() => ({ status: 400 }))
    );

    component.resetPasswordForm.setValue({
      token: 'token-123',
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    });
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
