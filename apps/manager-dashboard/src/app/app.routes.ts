import { Route } from '@angular/router';
import { BookingPreviewComponent } from './features/booking-preview/booking-preview.component';
import { BookingListComponent } from './features/booking-list/booking-list.component';
import { BookingCalendarComponent } from './features/booking-calendar/booking-calendar.component';
import { LayoutShellComponent } from './layouts/layout-shell/layout-shell.component';
import { FacilitiesComponent } from './features/facilities/facilities.component';
import { TeamComponent } from './features/team/team.component';
import { SettingsComponent } from './features/settings/settings.component';
import { LandingComponent } from './features/landing';
import { LandingArabicComponent } from './features/landing-ar';
import { LoginComponent } from './features/auth/login';
import { RegisterComponent } from './features/auth/register';
import { ChangePasswordComponent } from './features/auth/change-password';
import { ForgotPasswordComponent } from './features/auth/forgot-password';
import { ResetPasswordComponent } from './features/auth/reset-password';
import { ForbiddenComponent } from './features/forbidden/forbidden.component';
import { authGuard } from './shared/guards/auth.guard';
import { roleGuard } from './shared/guards/role.guard';
import { publicGuard } from './shared/guards/public.guard';
import { UserRole } from '@khana/shared-dtos';

export const appRoutes: Route[] = [
  // Landing page - public route
  {
    path: '',
    component: LandingComponent,
    title: 'Khana - Never Lose a Booking Again',
  },
  {
    path: 'ar',
    component: LandingArabicComponent,
    title: 'خانة - لا تخسر حجز أبداً',
  },
  // Auth routes - public (redirect if authenticated)
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [publicGuard],
    title: 'Login | Khana',
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [publicGuard],
    title: 'Create Account | Khana',
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    canActivate: [publicGuard],
    title: 'Forgot Password | Khana',
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [publicGuard],
    title: 'Reset Password | Khana',
  },
  {
    path: 'change-password',
    component: ChangePasswordComponent,
    canActivate: [authGuard],
    title: 'Change Password | Khana',
  },
  // Legacy auth path aliases (keep old email links working)
  {
    path: 'auth',
    children: [
      {
        path: 'forgot-password',
        component: ForgotPasswordComponent,
        canActivate: [publicGuard],
        title: 'Forgot Password | Khana',
      },
      {
        path: 'reset-password',
        component: ResetPasswordComponent,
        canActivate: [publicGuard],
        title: 'Reset Password | Khana',
      },
    ],
  },
  // Dashboard routes - authenticated area
  {
    path: 'dashboard',
    component: LayoutShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'bookings',
        component: BookingListComponent,
        title: 'Bookings | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.BOOKINGS',
          navKey: 'DASHBOARD.NAV.ITEMS.BOOKINGS',
        },
      },
      {
        path: 'calendar',
        component: BookingCalendarComponent,
        title: 'Calendar | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.CALENDAR',
          navKey: 'DASHBOARD.NAV.ITEMS.CALENDAR',
        },
      },
      {
        path: 'new',
        component: BookingPreviewComponent,
        canActivate: [
          roleGuard([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF]),
        ],
        title: 'New Booking | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.NEW_BOOKING',
          navKey: 'DASHBOARD.NAV.ITEMS.NEW_BOOKING',
        },
      },
      {
        path: 'facilities',
        component: FacilitiesComponent,
        title: 'Facilities | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.FACILITIES',
          navKey: 'DASHBOARD.NAV.ITEMS.FACILITIES',
        },
      },
      {
        path: 'team',
        component: TeamComponent,
        canActivate: [roleGuard([UserRole.OWNER, UserRole.MANAGER])],
        title: 'Team | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.TEAM',
          navKey: 'DASHBOARD.NAV.ITEMS.TEAM',
        },
      },
      {
        path: 'settings',
        component: SettingsComponent,
        canActivate: [roleGuard([UserRole.OWNER, UserRole.MANAGER])],
        title: 'Settings | Khana',
        data: {
          breadcrumbKey: 'DASHBOARD.BREADCRUMBS.SETTINGS',
          navKey: 'DASHBOARD.NAV.ITEMS.SETTINGS',
        },
      },
      {
        path: '',
        redirectTo: 'bookings',
        pathMatch: 'full',
      },
    ],
  },
  // Error pages
  {
    path: '403',
    component: ForbiddenComponent,
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
    path: 'new',
    redirectTo: 'dashboard/new',
    pathMatch: 'full',
  },
];
