import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarBookingDetailComponent } from './components/calendar-booking-detail.component';
import {
  CancellationFormComponent,
  ConfirmationDialogComponent,
  TagChipComponent,
  UiStatusBadgeComponent,
  UiToastComponent,
} from '../../shared/components';
import { BookingCalendarRouteFacade } from './internal/booking-calendar.route-facade';

/**
 * Weekly calendar route shell. Interaction and orchestration live in the
 * feature-local route facade so the component stays focused on composition.
 */
@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CalendarBookingDetailComponent,
    ConfirmationDialogComponent,
    CancellationFormComponent,
    TagChipComponent,
    UiStatusBadgeComponent,
    UiToastComponent,
  ],
  templateUrl: './booking-calendar.component.html',
  styleUrl: './booking-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCalendarComponent extends BookingCalendarRouteFacade {}
