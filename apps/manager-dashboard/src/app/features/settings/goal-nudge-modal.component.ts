import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-goal-nudge-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmationDialogComponent],
  templateUrl: './goal-nudge-modal.component.html',
  styleUrl: './goal-nudge-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalNudgeModalComponent {
  @Input() open = false;

  @Output() dismissed = new EventEmitter<void>();
  @Output() setGoal = new EventEmitter<void>();
}
