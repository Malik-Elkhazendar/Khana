import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../state/auth.store';
import { AuthService } from '../services/auth.service';
import { onboardingGuard } from './onboarding.guard';

describe('onboardingGuard', () => {
  let authStore: InstanceType<typeof AuthStore>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      getCurrentUser: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: AuthService, useValue: authService },
        {
          provide: Router,
          useValue: {
            createUrlTree: jest.fn((commands: string[]) => commands),
          },
        },
      ],
    });

    authStore = TestBed.inject(AuthStore);
  });

  it('redirects unauthenticated users to login', () => {
    authStore.setAuthenticated(false);

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireComplete')({} as never, {} as never)
    );

    expect(result).toEqual(['/login']);
  });

  it('redirects owner with incomplete onboarding to onboarding page', () => {
    authStore.setUser({
      id: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Owner',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireComplete')({} as never, {} as never)
    );

    expect(result).toEqual(['/onboarding']);
  });

  it('allows owner with incomplete onboarding on onboarding route', () => {
    authStore.setUser({
      id: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Owner',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireIncomplete')({} as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('redirects completed owner away from onboarding route', () => {
    authStore.setUser({
      id: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Owner',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireIncomplete')({} as never, {} as never)
    );

    expect(result).toEqual(['/dashboard']);
  });

  it('allows non-owner to access dashboard routes', () => {
    authStore.setUser({
      id: 'staff-1',
      tenantId: 'tenant-1',
      email: 'staff@khana.dev',
      name: 'Staff',
      role: UserRole.STAFF,
      isActive: true,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireComplete')({} as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('hydrates user via API when missing from store', async () => {
    authStore.setUser(null);
    authStore.setAuthenticated(true);
    authService.getCurrentUser.mockReturnValue(
      of({
        id: 'owner-1',
        tenantId: 'tenant-1',
        email: 'owner@khana.dev',
        name: 'Owner',
        role: UserRole.OWNER,
        isActive: true,
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireComplete')({} as never, {} as never)
    );

    if (result === true || Array.isArray(result)) {
      throw new Error('Expected observable result');
    }

    await expect(
      firstValueFrom(result as ReturnType<typeof of>)
    ).resolves.toEqual(['/onboarding']);
  });

  it('redirects to login when hydration fails', async () => {
    authStore.setUser(null);
    authStore.setAuthenticated(true);
    authService.getCurrentUser.mockReturnValue(
      throwError(() => new Error('failed'))
    );

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard('requireComplete')({} as never, {} as never)
    );

    if (result === true || Array.isArray(result)) {
      throw new Error('Expected observable result');
    }

    await expect(
      firstValueFrom(result as ReturnType<typeof of>)
    ).resolves.toEqual(['/login']);
  });
});
