import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cancellation-form',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cancellation-form.component.html',
  styleUrl: './cancellation-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancellationFormComponent {
  @Input() reason = '';
  @Input() minLength = 5;
  @Input() placeholder = 'Add a cancellation reason';

  @Output() reasonChange = new EventEmitter<string>();

  readonly textAreaId = 'cancel-reason-input';

  get trimmedLength(): number {
    return this.reason.trim().length;
  }

  get isValid(): boolean {
    return this.trimmedLength >= this.minLength;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.reasonChange.emit(target?.value ?? '');
  }
}
