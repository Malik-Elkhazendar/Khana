import { Route } from '@angular/router';
import { BookingPreviewComponent } from './features/booking-preview/booking-preview.component';
import { BookingListComponent } from './features/booking-list/booking-list.component';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'bookings',
    pathMatch: 'full',
  },
  {
    path: 'bookings',
    component: BookingListComponent,
  },
  {
    path: 'new',
    component: BookingPreviewComponent,
  },
];
