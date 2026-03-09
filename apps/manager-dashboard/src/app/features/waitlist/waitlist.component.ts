import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { UiStatusBadgeComponent } from '../../shared/components/ui';
import { WaitlistRouteFacade } from './internal/waitlist.route-facade';

/**
 * Waitlist route shell.
 * Feature-local internal layers own filters, query-param hydration, and row actions.
 */
@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, UiStatusBadgeComponent],
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitlistComponent extends WaitlistRouteFacade {}
