import { Route } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { roleGuard } from './shared/guards/role.guard';
import { publicGuard } from './shared/guards/public.guard';
import { onboardingGuard } from './shared/guards/onboarding.guard';
import { UserRole } from '@khana/shared-dtos';

const requireIncompleteOnboarding = onboardingGuard('requireIncomplete');
const requireCompletedOnboarding = onboardingGuard('requireComplete');

export const appRoutes: Route[] = [
  // Landing page - public route
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(
        (module) => module.LandingComponent
      ),
    title: 'Khana - Never Lose a Booking Again',
  },
  {
    path: 'ar',
    loadComponent: () =>
      import('./features/landing-ar/landing.component').then(
        (module) => module.LandingArabicComponent
      ),
    title: 'خانة - لا تخسر حجز أبداً',
  },
  // Auth routes - public (redirect if authenticated)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (module) => module.LoginComponent
      ),
    canActivate: [publicGuard],
    title: 'Login | Khana',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (module) => module.RegisterComponent
      ),
    canActivate: [publicGuard],
    title: 'Create Account | Khana',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (module) => module.ForgotPasswordComponent
      ),
    canActivate: [publicGuard],
    title: 'Forgot Password | Khana',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (module) => module.ResetPasswordComponent
      ),
    canActivate: [publicGuard],
    title: 'Reset Password | Khana',
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then(
        (module) => module.ChangePasswordComponent
      ),
    canActivate: [authGuard],
    title: 'Change Password | Khana',
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(
        (module) => module.OnboardingComponent
      ),
    canActivate: [authGuard, requireIncompleteOnboarding],
    title: 'Onboarding | Khana',
  },
  // Legacy auth path aliases (keep old email links working)
  {
    path: 'auth',
    children: [
      {
        path: 'forgot-password',
        loadComponent: () =>
          import(
            './features/auth/forgot-password/forgot-password.component'
          ).then((module) => module.ForgotPasswordComponent),
        canActivate: [publicGuard],
        title: 'Forgot Password | Khana',
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import(
            './features/auth/reset-password/reset-password.component'
          ).then((module) => module.ResetPasswordComponent),
        canActivate: [publicGuard],
        title: 'Reset Password | Khana',
      },
    ],
  },
  // Dashboard routes - authenticated area
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./layouts/layout-shell/layout-shell.component').then(
        (module) => module.LayoutShellComponent
      ),
    canActivate: [authGuard, requireCompletedOnboarding],
    children: [
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(
            (module) => module.AnalyticsComponent
          ),
        canActivate: [
          roleGuard([UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER]),
        ],
        title: 'Analytics | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.ANALYTICS',
          navKey: 'DASHBOARD.NAV.ITEMS.ANALYTICS',
          contentArchetype: 'data',
        },
      },
      {
        path: 'bookings/:id',
        loadComponent: () =>
          import('./features/booking-detail/booking-detail.component').then(
            (module) => module.BookingDetailComponent
          ),
        title: 'Booking Details | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.BOOKING_DETAIL',
          navKey: 'DASHBOARD.NAV.ITEMS.BOOKINGS',
          contentArchetype: 'data',
        },
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/booking-list/booking-list.component').then(
            (module) => module.BookingListComponent
          ),
        title: 'Bookings | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.BOOKINGS',
          navKey: 'DASHBOARD.NAV.ITEMS.BOOKINGS',
          contentArchetype: 'data',
        },
      },
      {
        path: 'waitlist',
        loadComponent: () =>
          import('./features/waitlist/waitlist.component').then(
            (module) => module.WaitlistComponent
          ),
        canActivate: [
          roleGuard([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF]),
        ],
        title: 'Waitlist | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.WAITLIST',
          navKey: 'DASHBOARD.NAV.ITEMS.WAITLIST',
          contentArchetype: 'data',
        },
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/booking-calendar/booking-calendar.component').then(
            (module) => module.BookingCalendarComponent
          ),
        title: 'Calendar | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.CALENDAR',
          navKey: 'DASHBOARD.NAV.ITEMS.CALENDAR',
          contentArchetype: 'data',
        },
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./features/booking-preview/booking-preview.component').then(
            (module) => module.BookingPreviewComponent
          ),
        canActivate: [
          roleGuard([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF]),
        ],
        title: 'New Booking | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.NEW_BOOKING',
          navKey: 'DASHBOARD.NAV.ITEMS.NEW_BOOKING',
          contentArchetype: 'data',
        },
      },
      {
        path: 'facilities',
        loadComponent: () =>
          import('./features/facilities/facilities.component').then(
            (module) => module.FacilitiesComponent
          ),
        canActivate: [
          roleGuard([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF]),
        ],
        title: 'Facilities | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.FACILITIES',
          navKey: 'DASHBOARD.NAV.ITEMS.FACILITIES',
          contentArchetype: 'data',
        },
      },
      {
        path: 'promo-codes',
        loadComponent: () =>
          import('./features/promo-codes/promo-codes.component').then(
            (module) => module.PromoCodesComponent
          ),
        canActivate: [roleGuard([UserRole.OWNER, UserRole.MANAGER])],
        data: {
          titleKey: 'META.TITLES.PROMO_CODES',
          descriptionKey: 'META.DESCRIPTIONS.DASHBOARD',
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.PROMO_CODES',
          navKey: 'DASHBOARD.NAV.ITEMS.PROMO_CODES',
          contentArchetype: 'data',
        },
      },
      {
        path: 'team',
        loadComponent: () =>
          import('./features/team/team.component').then(
            (module) => module.TeamComponent
          ),
        canActivate: [roleGuard([UserRole.OWNER, UserRole.MANAGER])],
        title: 'Team | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.TEAM',
          navKey: 'DASHBOARD.NAV.ITEMS.TEAM',
          contentArchetype: 'data',
        },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (module) => module.SettingsComponent
          ),
        canActivate: [roleGuard([UserRole.OWNER, UserRole.MANAGER])],
        title: 'Settings | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.SETTINGS',
          navKey: 'DASHBOARD.NAV.ITEMS.SETTINGS',
          contentArchetype: 'data',
        },
      },
      {
        path: '',
        redirectTo: 'analytics',
        pathMatch: 'full',
      },
    ],
  },
  // Error pages
  {
    path: '403',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component').then(
        (module) => module.ForbiddenComponent
      ),
    title: '403 Forbidden | Khana',
  },
  // Legacy routes - redirect to dashboard
  {
    path: 'bookings',
    redirectTo: 'dashboard/bookings',
    pathMatch: 'full',
  },
  {
    path: 'calendar',
    redirectTo: 'dashboard/calendar',
    pathMatch: 'full',
  },
  {
    path: 'waitlist',
    redirectTo: 'dashboard/waitlist',
    pathMatch: 'full',
  },
  {
    path: 'new',
    redirectTo: 'dashboard/new',
    pathMatch: 'full',
  },
];
