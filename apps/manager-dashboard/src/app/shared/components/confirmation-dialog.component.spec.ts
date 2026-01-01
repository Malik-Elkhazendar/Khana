import { TestBed } from '@angular/core/testing';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

type SetupOptions = {
  flushFocus?: boolean;
};

describe('ConfirmationDialogComponent', () => {
  const setup = (
    overrides: Partial<ConfirmationDialogComponent> = {},
    options: SetupOptions = {}
  ) => {
    const fixture = TestBed.createComponent(ConfirmationDialogComponent);
    const component = fixture.componentInstance;
    Object.assign(component, overrides);
    fixture.detectChanges();

    if (options.flushFocus) {
      jest.runOnlyPendingTimers();
      fixture.detectChanges();
    }

    const panel = fixture.nativeElement.querySelector(
      '.confirmation-dialog'
    ) as HTMLElement | null;
    const closeButton = fixture.nativeElement.querySelector(
      '.confirmation-dialog__close'
    ) as HTMLButtonElement | null;
    const cancelButton = fixture.nativeElement.querySelector(
      '.dialog-btn--ghost'
    ) as HTMLButtonElement | null;
    const confirmButton = fixture.nativeElement.querySelector(
      '.dialog-btn--primary, .dialog-btn--secondary, .dialog-btn--danger'
    ) as HTMLButtonElement | null;

    return {
      fixture,
      component,
      panel,
      closeButton,
      cancelButton,
      confirmButton,
    };
  };

  const createKeyEvent = (
    key: string,
    options: Partial<KeyboardEvent> = {}
  ): KeyboardEvent =>
    ({
      key,
      shiftKey: false,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      ...options,
    } as unknown as KeyboardEvent);

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders title and message when provided', () => {
    const { fixture } = setup({
      title: 'Cancel booking',
      message: 'This action is permanent.',
    });

    const title = fixture.nativeElement.querySelector('h3');
    const message = fixture.nativeElement.querySelector(
      '.confirmation-dialog__message'
    );
    expect(title?.textContent).toContain('Cancel booking');
    expect(message?.textContent).toContain('This action is permanent.');
  });

  it('omits message section when message is empty', () => {
    const { fixture, panel } = setup({ message: '' });

    const message = fixture.nativeElement.querySelector(
      '.confirmation-dialog__message'
    );
    expect(message).toBeNull();
    expect(panel?.getAttribute('aria-describedby')).toBeNull();
  });

  it('sets dialog accessibility attributes', () => {
    const { panel } = setup({ title: 'Confirm' });

    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
  });

  it('links aria-labelledby to the title id', () => {
    const { fixture, component, panel } = setup({ title: 'Confirm' });

    const title = fixture.nativeElement.querySelector('h3');
    expect(panel?.getAttribute('aria-labelledby')).toBe(component.titleId);
    expect(title?.getAttribute('id')).toBe(component.titleId);
  });

  it('sets aria-describedby when message is provided', () => {
    const { fixture, component, panel } = setup({
      message: 'Proceed?',
    });

    const message = fixture.nativeElement.querySelector(
      '.confirmation-dialog__message'
    );
    expect(panel?.getAttribute('aria-describedby')).toBe(
      component.descriptionId
    );
    expect(message?.getAttribute('id')).toBe(component.descriptionId);
  });

  it('uses custom confirm and cancel labels', () => {
    const { cancelButton, confirmButton } = setup({
      confirmLabel: 'Yes, proceed',
      cancelLabel: 'No, go back',
    });

    expect(cancelButton?.textContent).toContain('No, go back');
    expect(confirmButton?.textContent).toContain('Yes, proceed');
  });

  it('applies the confirm tone class', () => {
    const { confirmButton } = setup({ confirmTone: 'danger' });

    expect(confirmButton?.classList.contains('dialog-btn--danger')).toBe(true);
  });

  it('disables confirm button when confirmDisabled is true', () => {
    const { confirmButton } = setup({ confirmDisabled: true });

    expect(confirmButton?.disabled).toBe(true);
  });

  it('disables confirm button when busy is true', () => {
    const { confirmButton } = setup({ busy: true });

    expect(confirmButton?.disabled).toBe(true);
  });

  it('disables cancel button when busy is true', () => {
    const { cancelButton } = setup({ busy: true });

    expect(cancelButton?.disabled).toBe(true);
  });

  it('disables close button when busy is true', () => {
    const { closeButton } = setup({ busy: true });

    expect(closeButton?.disabled).toBe(true);
  });

  it('emits confirmed on confirm click', () => {
    const { component, confirmButton } = setup();
    const confirmSpy = jest.spyOn(component.confirmed, 'emit');

    confirmButton?.click();

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('blocks confirm click when busy', () => {
    const { component } = setup({ busy: true });
    const confirmSpy = jest.spyOn(component.confirmed, 'emit');

    component.onConfirmClick();

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('blocks confirm click when confirmDisabled', () => {
    const { component } = setup({ confirmDisabled: true });
    const confirmSpy = jest.spyOn(component.confirmed, 'emit');

    component.onConfirmClick();

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits dismissed on cancel click', () => {
    const { component, cancelButton } = setup();
    const dismissSpy = jest.spyOn(component.dismissed, 'emit');

    cancelButton?.click();

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('blocks cancel click when busy', () => {
    const { component } = setup({ busy: true });
    const dismissSpy = jest.spyOn(component.dismissed, 'emit');

    component.onCancelClick();

    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it('emits dismissed on backdrop click', () => {
    const { component } = setup();
    const dismissSpy = jest.spyOn(component.dismissed, 'emit');

    component.onBackdropClick();

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('blocks backdrop click when busy', () => {
    const { component } = setup({ busy: true });
    const dismissSpy = jest.spyOn(component.dismissed, 'emit');

    component.onBackdropClick();

    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it('dismisses on Escape key when not busy', () => {
    const { component } = setup();
    const dismissSpy = jest.spyOn(component.dismissed, 'emit');

    component.onPanelKeydown(createKeyEvent('Escape'));

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('blocks Escape key when busy', () => {
    const { component } = setup({ busy: true });
    const dismissSpy = jest.spyOn(component.dismissed, 'emit');

    component.onPanelKeydown(createKeyEvent('Escape'));

    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it('confirms on Enter key when allowed', () => {
    const { component } = setup();
    const confirmSpy = jest.spyOn(component.confirmed, 'emit');

    component.onPanelKeydown(createKeyEvent('Enter'));

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('ignores Enter key when focused on textarea', () => {
    const { component } = setup();
    const confirmSpy = jest.spyOn(component.confirmed, 'emit');
    const textarea = document.createElement('textarea');

    component.onPanelKeydown(
      createKeyEvent('Enter', { target: textarea } as KeyboardEvent)
    );

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('ignores Enter key when focused on input', () => {
    const { component } = setup();
    const confirmSpy = jest.spyOn(component.confirmed, 'emit');
    const input = document.createElement('input');

    component.onPanelKeydown(
      createKeyEvent('Enter', { target: input } as KeyboardEvent)
    );

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('focuses the cancel button after view init', () => {
    const { cancelButton } = setup({}, { flushFocus: true });

    expect(document.activeElement).toBe(cancelButton);
  });

  it('cycles focus from last to first on Tab', () => {
    const { component, closeButton, confirmButton } = setup(
      {},
      { flushFocus: true }
    );
    confirmButton?.focus();

    component.onPanelKeydown(createKeyEvent('Tab'));

    expect(document.activeElement).toBe(closeButton);
  });

  it('cycles focus from first to last on Shift+Tab', () => {
    const { component, closeButton, confirmButton } = setup(
      {},
      { flushFocus: true }
    );
    closeButton?.focus();

    component.onPanelKeydown(createKeyEvent('Tab', { shiftKey: true }));

    expect(document.activeElement).toBe(confirmButton);
  });

  it('does not change focus when tabbing from middle element', () => {
    const { component, cancelButton } = setup({}, { flushFocus: true });
    cancelButton?.focus();

    component.onPanelKeydown(createKeyEvent('Tab'));

    expect(document.activeElement).toBe(cancelButton);
  });

  it('restores focus to trigger element on destroy', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const fixture = TestBed.createComponent(ConfirmationDialogComponent);
    fixture.detectChanges();
    jest.runOnlyPendingTimers();
    fixture.destroy();

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
