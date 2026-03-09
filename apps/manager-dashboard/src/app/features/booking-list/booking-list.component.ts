import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CancellationFormComponent,
  ConfirmationDialogComponent,
  TagChipComponent,
  UiStatusBadgeComponent,
  UiToastComponent,
} from '../../shared/components';
import { BookingListRouteFacade } from './internal/booking-list.route-facade';

/**
 * Booking list route shell. Filtering, table state, and bulk workflows live in
 * the feature-local route facade so the component stays focused on composition.
 */
@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    ConfirmationDialogComponent,
    CancellationFormComponent,
    TagChipComponent,
    UiStatusBadgeComponent,
    UiToastComponent,
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingListComponent extends BookingListRouteFacade {}
