import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type UiToastTone = 'success' | 'error' | 'info' | 'warning';
export type UiToastMode = 'fixed-bottom' | 'inline';

@Component({
  selector: 'app-ui-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-toast.component.html',
  styleUrl: './ui-toast.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiToastComponent {
  @Input() message = '';
  @Input() tone: UiToastTone = 'info';
  @Input() mode: UiToastMode = 'fixed-bottom';

  toastClasses(): string {
    return `ui-toast ui-toast--${this.mode} ui-toast--${this.tone}`;
  }
}
