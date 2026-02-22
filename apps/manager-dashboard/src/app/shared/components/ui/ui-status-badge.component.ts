import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type UiStatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'default';

@Component({
  selector: 'app-ui-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-status-badge.component.html',
  styleUrl: './ui-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiStatusBadgeComponent {
  @Input() label = '';
  @Input() tone: UiStatusTone = 'neutral';

  badgeClass(): string {
    const tone = this.tone === 'default' ? 'neutral' : this.tone;
    return `ui-status-badge ui-status-badge--${tone}`;
  }
}
