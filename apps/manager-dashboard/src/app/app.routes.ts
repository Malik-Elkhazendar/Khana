import { Route } from '@angular/router';
import { BookingPreviewComponent } from './features/booking-preview/booking-preview.component';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'booking-preview',
    pathMatch: 'full',
  },
  {
    path: 'booking-preview',
    component: BookingPreviewComponent,
  },
];
