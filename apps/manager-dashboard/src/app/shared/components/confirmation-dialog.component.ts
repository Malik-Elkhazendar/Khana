import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

type ConfirmTone = 'primary' | 'secondary' | 'danger';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent implements AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() message = '';
  @Input() confirmLabel = '';
  @Input() cancelLabel = '';
  @Input() confirmTone: ConfirmTone = 'primary';
  @Input() confirmDisabled = false;
  @Input() busy = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  @ViewChild('dialogPanel') dialogPanel?: ElementRef<HTMLElement>;
  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;

  private lastFocusedElement: HTMLElement | null = null;
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });

  readonly titleId = 'confirmation-dialog-title';
  readonly descriptionId = 'confirmation-dialog-description';

  get resolvedConfirmLabel(): string {
    if (this.confirmLabel.trim()) {
      return this.confirmLabel;
    }
    return this.translate('SHARED.CONFIRMATION_DIALOG.CONFIRM', 'Confirm');
  }

  get resolvedCancelLabel(): string {
    if (this.cancelLabel.trim()) {
      return this.cancelLabel;
    }
    return this.translate('SHARED.CONFIRMATION_DIALOG.CANCEL', 'Cancel');
  }

  get closeLabel(): string {
    return this.translate('SHARED.CONFIRMATION_DIALOG.CLOSE', 'Close');
  }

  get closeDialogAriaLabel(): string {
    return this.translate(
      'SHARED.CONFIRMATION_DIALOG.CLOSE_DIALOG',
      'Close dialog'
    );
  }

  ngAfterViewInit(): void {
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    setTimeout(() => {
      const target =
        this.cancelButton?.nativeElement ?? this.dialogPanel?.nativeElement;
      target?.focus();
    }, 0);
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }

  onBackdropClick(): void {
    if (this.busy) return;
    this.dismissed.emit();
  }

  onCancelClick(): void {
    if (this.busy) return;
    this.dismissed.emit();
  }

  onConfirmClick(): void {
    if (this.busy || this.confirmDisabled) return;
    this.confirmed.emit();
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!this.busy) {
        this.dismissed.emit();
      }
      return;
    }

    if (event.key === 'Enter') {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') {
        return;
      }
      if (this.busy || this.confirmDisabled) return;
      event.preventDefault();
      event.stopPropagation();
      this.confirmed.emit();
      return;
    }

    if (event.key !== 'Tab') return;

    event.stopPropagation();

    const panel = this.dialogPanel?.nativeElement;
    if (!panel) return;
    const focusable = this.getFocusableElements(panel);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private restoreFocus(): void {
    this.lastFocusedElement?.focus();
    this.lastFocusedElement = null;
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];
    return Array.from(
      container.querySelectorAll<HTMLElement>(selectors.join(','))
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
