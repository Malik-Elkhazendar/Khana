import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

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
  @Input() placeholder = '';

  @Output() reasonChange = new EventEmitter<string>();

  readonly textAreaId = 'cancel-reason-input';
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });

  get trimmedLength(): number {
    return this.reason.trim().length;
  }

  get isValid(): boolean {
    return this.trimmedLength >= this.minLength;
  }

  get labelText(): string {
    return this.translate(
      'SHARED.CANCELLATION_FORM.LABEL',
      'Cancellation reason'
    );
  }

  get placeholderText(): string {
    if (this.placeholder.trim()) {
      return this.placeholder;
    }
    return this.translate(
      'SHARED.CANCELLATION_FORM.PLACEHOLDER',
      'Add a cancellation reason'
    );
  }

  get minimumHintText(): string {
    return this.translate(
      'SHARED.CANCELLATION_FORM.MINIMUM_HINT',
      `Minimum ${this.minLength} characters`,
      {
        minLength: this.minLength,
      }
    );
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.reasonChange.emit(target?.value ?? '');
  }

  private translate(
    key: string,
    fallback: string,
    params?: Record<string, unknown>
  ): string {
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : fallback;
  }
}
