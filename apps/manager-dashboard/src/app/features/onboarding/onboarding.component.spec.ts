import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { UserRole } from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { FacilityContextStore } from '../../shared/state';
import { OnboardingComponent } from './onboarding.component';

describe('OnboardingComponent', () => {
  const apiMock = {
    completeOnboarding: jest.fn(),
    inviteUser: jest.fn(),
  };

  const authServiceMock = {
    getCurrentUser: jest.fn(),
  };

  const facilityContextStoreMock = {
    refreshFacilities: jest.fn(),
  };

  const routerMock = {
    navigateByUrl: jest.fn(),
  };

  beforeEach(async () => {
    apiMock.completeOnboarding.mockReset();
    apiMock.inviteUser.mockReset();
    authServiceMock.getCurrentUser.mockReset();
    facilityContextStoreMock.refreshFacilities.mockReset();
    routerMock.navigateByUrl.mockReset();

    apiMock.inviteUser.mockReturnValue(
      of({
        message: 'Invitation sent successfully.',
        user: {
          id: 'invited-1',
          tenantId: 'tenant-1',
          email: 'invited@khana.dev',
          name: 'Invited User',
          role: UserRole.STAFF,
          isActive: true,
          onboardingCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    );
    apiMock.completeOnboarding.mockReturnValue(
      of({
        onboardingCompleted: true,
        tenantId: 'tenant-1',
        facilityId: 'facility-1',
        redirectTo: '/dashboard' as const,
      })
    );
    authServiceMock.getCurrentUser.mockReturnValue(
      of({
        id: 'owner-1',
        tenantId: 'tenant-1',
        email: 'owner@khana.dev',
        name: 'Owner',
        role: UserRole.OWNER,
        isActive: true,
        onboardingCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: FacilityContextStore, useValue: facilityContextStoreMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();
  });

  const moveToStepThree = (component: OnboardingComponent): void => {
    component.businessForm.setValue({
      businessName: 'Elite Sports Hub',
      businessType: 'SPORTS',
      contactEmail: 'owner@khana.dev',
      contactPhone: '+966500000000',
    });
    component.nextStep();

    component.facilityForm.setValue({
      name: 'Court 1',
      type: 'PADEL_COURT',
      pricePerHour: 180,
      openTime: '08:00',
      closeTime: '23:00',
    });
    component.nextStep();
  };

  it('validates step 1 and step 2 before progressing', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.nextStep();
    expect(component.currentStep()).toBe(1);

    component.businessForm.setValue({
      businessName: 'Elite Sports Hub',
      businessType: 'SPORTS',
      contactEmail: 'owner@khana.dev',
      contactPhone: '+966500000000',
    });
    component.nextStep();
    expect(component.currentStep()).toBe(2);

    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('keeps invite failures non-blocking and continues to confirmation', () => {
    apiMock.inviteUser.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error',
            error: { message: 'Unable to send invitation.' },
          })
      )
    );

    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    moveToStepThree(component);
    expect(component.currentStep()).toBe(3);

    component.inviteForm.setValue({
      email: 'staff@khana.dev',
      role: UserRole.STAFF,
    });
    component.sendInvite();

    expect(component.inviteError()).toBe('Unable to send invitation.');

    component.nextStep();
    expect(component.currentStep()).toBe(4);
  });

  it('supports explicit skip on invite step', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    moveToStepThree(component);
    expect(component.currentStep()).toBe(3);

    component.skipInvites();
    expect(component.currentStep()).toBe(4);
  });

  it('completes onboarding and refreshes user and facilities before redirect', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.businessForm.setValue({
      businessName: 'Elite Sports Hub',
      businessType: 'SPORTS',
      contactEmail: 'owner@khana.dev',
      contactPhone: '+966500000000',
    });
    component.facilityForm.setValue({
      name: 'Court 1',
      type: 'PADEL_COURT',
      pricePerHour: 180,
      openTime: '08:00',
      closeTime: '23:00',
    });
    component.currentStep.set(4);

    component.completeOnboarding();

    expect(apiMock.completeOnboarding).toHaveBeenCalledWith({
      businessName: 'Elite Sports Hub',
      businessType: 'SPORTS',
      contactEmail: 'owner@khana.dev',
      contactPhone: '+966500000000',
      facility: {
        name: 'Court 1',
        type: 'PADEL_COURT',
        pricePerHour: 180,
        openTime: '08:00',
        closeTime: '23:00',
      },
    });
    expect(authServiceMock.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(facilityContextStoreMock.refreshFacilities).toHaveBeenCalledTimes(1);
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
