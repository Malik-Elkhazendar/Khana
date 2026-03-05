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
import {
  BookingCancellationReasonKey,
  parseCancellationReason,
  serializeCancellationReason,
  isBookingCancellationReasonKey,
} from '@khana/shared-dtos';

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

  @Output() reasonChange = new EventEmitter<string>();

  readonly reasonSelectId = 'cancel-reason-select';
  readonly otherReasonInputId = 'cancel-reason-other';
  readonly reasonKeys: BookingCancellationReasonKey[] = [
    BookingCancellationReasonKey.CUSTOMER_REQUEST,
    BookingCancellationReasonKey.NO_PAYMENT,
    BookingCancellationReasonKey.DOUBLE_BOOKING,
    BookingCancellationReasonKey.FACILITY_UNAVAILABLE,
    BookingCancellationReasonKey.STAFF_ERROR,
    BookingCancellationReasonKey.OTHER,
  ];
  readonly BookingCancellationReasonKey = BookingCancellationReasonKey;

  private readonly translateService = inject(TranslateService, {
    optional: true,
  });

  get selectedReasonKey(): BookingCancellationReasonKey | null {
    const parsed = parseCancellationReason(this.reason);
    return parsed.isValid ? parsed.key : null;
  }

  get otherReasonNote(): string {
    const parsed = parseCancellationReason(this.reason);
    if (!parsed.isValid || parsed.key !== BookingCancellationReasonKey.OTHER) {
      return '';
    }
    return parsed.note ?? '';
  }

  get isOtherSelected(): boolean {
    return this.selectedReasonKey === BookingCancellationReasonKey.OTHER;
  }

  get isValid(): boolean {
    return this.selectedReasonKey !== null;
  }

  get reasonLabelText(): string {
    return this.translate(
      'SHARED.CANCELLATION_FORM.LABEL',
      'Cancellation reason'
    );
  }

  get reasonPlaceholderText(): string {
    return this.translate(
      'SHARED.CANCELLATION_FORM.SELECT_PLACEHOLDER',
      'Select a reason'
    );
  }

  get otherLabelText(): string {
    return this.translate(
      'SHARED.CANCELLATION_FORM.OTHER_NOTE_LABEL',
      'Other details (optional)'
    );
  }

  get otherPlaceholderText(): string {
    return this.translate(
      'SHARED.CANCELLATION_FORM.OTHER_NOTE_PLACEHOLDER',
      'Add a note'
    );
  }

  get helperText(): string {
    return this.translate(
      this.isValid
        ? 'SHARED.CANCELLATION_FORM.HELPER'
        : 'SHARED.CANCELLATION_FORM.REQUIRED_HINT',
      this.isValid
        ? 'Reason key will be saved for reporting.'
        : 'Please choose a cancellation reason.'
    );
  }

  optionLabel(key: BookingCancellationReasonKey): string {
    switch (key) {
      case BookingCancellationReasonKey.CUSTOMER_REQUEST:
        return this.translate(
          'SHARED.CANCELLATION_FORM.OPTIONS.CUSTOMER_REQUEST',
          'Customer request'
        );
      case BookingCancellationReasonKey.NO_PAYMENT:
        return this.translate(
          'SHARED.CANCELLATION_FORM.OPTIONS.NO_PAYMENT',
          'No payment received'
        );
      case BookingCancellationReasonKey.DOUBLE_BOOKING:
        return this.translate(
          'SHARED.CANCELLATION_FORM.OPTIONS.DOUBLE_BOOKING',
          'Double booking'
        );
      case BookingCancellationReasonKey.FACILITY_UNAVAILABLE:
        return this.translate(
          'SHARED.CANCELLATION_FORM.OPTIONS.FACILITY_UNAVAILABLE',
          'Facility unavailable'
        );
      case BookingCancellationReasonKey.STAFF_ERROR:
        return this.translate(
          'SHARED.CANCELLATION_FORM.OPTIONS.STAFF_ERROR',
          'Staff error'
        );
      case BookingCancellationReasonKey.OTHER:
        return this.translate(
          'SHARED.CANCELLATION_FORM.OPTIONS.OTHER',
          'Other (specify...)'
        );
      default:
        return key;
    }
  }

  onReasonKeyChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    if (!isBookingCancellationReasonKey(value)) {
      this.reasonChange.emit('');
      return;
    }

    if (value === BookingCancellationReasonKey.OTHER) {
      const note =
        this.selectedReasonKey === BookingCancellationReasonKey.OTHER
          ? this.otherReasonNote
          : '';
      this.reasonChange.emit(serializeCancellationReason(value, note));
      return;
    }

    this.reasonChange.emit(serializeCancellationReason(value));
  }

  onOtherNoteInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.reasonChange.emit(
      serializeCancellationReason(
        BookingCancellationReasonKey.OTHER,
        target?.value ?? ''
      )
    );
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
