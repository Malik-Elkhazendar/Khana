import { Type } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CustomersModule } from '../customers/customers.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { FacilitiesModule } from '../facilities/facilities.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';

export const SWAGGER_FEATURE_MODULES: Type<unknown>[] = [
  AuthModule,
  UsersModule,
  BookingsModule,
  FacilitiesModule,
  OnboardingModule,
  AnalyticsModule,
  DashboardModule,
  CustomersModule,
  PromoCodesModule,
  SettingsModule,
];
