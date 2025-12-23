import { Route } from '@angular/router';
import { BookingPreviewComponent } from './features/booking-preview/booking-preview.component';
import { BookingListComponent } from './features/booking-list/booking-list.component';
import { BookingCalendarComponent } from './features/booking-calendar/booking-calendar.component';

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
    path: 'calendar',
    component: BookingCalendarComponent,
  },
  {
    path: 'new',
    component: BookingPreviewComponent,
  },
];
