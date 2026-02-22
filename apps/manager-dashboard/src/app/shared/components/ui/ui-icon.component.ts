import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardNavIcon } from '../../navigation/dashboard-nav';

@Component({
  selector: 'app-ui-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-icon.component.html',
  styleUrl: './ui-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiIconComponent {
  @Input() name: DashboardNavIcon = 'bookings';
  @Input() size = 16;
  @Input() ariaHidden = true;
}
