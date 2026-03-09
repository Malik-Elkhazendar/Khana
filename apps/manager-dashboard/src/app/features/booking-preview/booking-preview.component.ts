import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ConfirmationDialogComponent,
  TagChipComponent,
  UiStatusBadgeComponent,
  UiToastComponent,
} from '../../shared/components';
import { BookingPreviewRouteFacade } from './internal/booking-preview.route-facade';

/**
 * Booking preview route shell. The workflow-heavy page logic lives in the
 * feature-local route facade so this component stays focused on template wiring.
 */
@Component({
  selector: 'app-booking-preview',
  standalone: true,
  imports: [
    FormsModule,
    ConfirmationDialogComponent,
    TagChipComponent,
    UiStatusBadgeComponent,
    UiToastComponent,
  ],
  templateUrl: './booking-preview.component.html',
  styleUrl: './booking-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPreviewComponent extends BookingPreviewRouteFacade {}
