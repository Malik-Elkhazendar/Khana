import { TestBed } from '@angular/core/testing';
import { BookingCancellationReasonKey } from '@khana/shared-dtos';
import { CancellationFormComponent } from './cancellation-form.component';

describe('CancellationFormComponent', () => {
  const setup = (overrides: Partial<CancellationFormComponent> = {}) => {
    const fixture = TestBed.createComponent(CancellationFormComponent);
    const component = fixture.componentInstance;
    Object.assign(component, overrides);
    fixture.detectChanges();
    return { fixture, component };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CancellationFormComponent],
    }).compileComponents();
  });

  it('renders label and select placeholder', () => {
    const { fixture } = setup();

    const label = fixture.nativeElement.querySelector('label');
    const select = fixture.nativeElement.querySelector('select');
    expect(label?.textContent).toContain('Cancellation reason');
    expect(select).toBeTruthy();
    expect(select?.value).toBe('');
  });

  it('binds selected reason key from canonical value', () => {
    const { fixture, component } = setup({ reason: 'customer_request' });

    const select = fixture.nativeElement.querySelector('select');
    const optionValues = Array.from((select as HTMLSelectElement).options).map(
      (option) => option.value
    );

    expect(component.selectedReasonKey).toBe(
      BookingCancellationReasonKey.CUSTOMER_REQUEST
    );
    expect(optionValues).toContain('customer_request');
  });

  it('shows error hint when no reason is selected', () => {
    const { fixture, component } = setup({ reason: '' });

    const hint = fixture.nativeElement.querySelector('.cancel-form__hint');
    expect(component.isValid).toBe(false);
    expect(hint?.classList.contains('cancel-form__hint--error')).toBe(true);
    expect(hint?.textContent).toContain('Please choose a cancellation reason.');
  });

  it('shows success helper when reason is valid', () => {
    const { fixture, component } = setup({
      reason: BookingCancellationReasonKey.NO_PAYMENT,
    });

    const hint = fixture.nativeElement.querySelector('.cancel-form__hint');
    expect(component.isValid).toBe(true);
    expect(hint?.classList.contains('cancel-form__hint--error')).toBe(false);
    expect(hint?.textContent).toContain('Reason key will be saved');
  });

  it('emits selected preset key on change', () => {
    const { fixture, component } = setup();
    const emitSpy = jest.spyOn(component.reasonChange, 'emit');
    const select = fixture.nativeElement.querySelector('select');

    select.value = BookingCancellationReasonKey.DOUBLE_BOOKING;
    select.dispatchEvent(new Event('change'));

    expect(emitSpy).toHaveBeenCalledWith('double_booking');
  });

  it('shows other note input when other is selected', () => {
    const { fixture } = setup({ reason: BookingCancellationReasonKey.OTHER });

    const noteInput = fixture.nativeElement.querySelector('input[type="text"]');
    expect(noteInput).toBeTruthy();
  });

  it('hides other note input when other is not selected', () => {
    const { fixture } = setup({
      reason: BookingCancellationReasonKey.CUSTOMER_REQUEST,
    });

    const noteInput = fixture.nativeElement.querySelector('input[type="text"]');
    expect(noteInput).toBeNull();
  });

  it('binds existing other note from canonical value', () => {
    const { fixture } = setup({ reason: 'other|Customer asked to move slot' });

    const noteInput = fixture.nativeElement.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement | null;
    expect(noteInput?.value).toBe('Customer asked to move slot');
  });

  it('emits canonical other value with note on input', () => {
    const { fixture, component } = setup({ reason: 'other' });
    const emitSpy = jest.spyOn(component.reasonChange, 'emit');
    const noteInput = fixture.nativeElement.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;

    noteInput.value = '  Manager override  ';
    noteInput.dispatchEvent(new Event('input'));

    expect(emitSpy).toHaveBeenCalledWith('other|Manager override');
  });

  it('emits empty reason when selected option is invalid', () => {
    const { component } = setup();
    const emitSpy = jest.spyOn(component.reasonChange, 'emit');

    component.onReasonKeyChange({
      target: { value: 'invalid_reason' },
    } as unknown as Event);

    expect(emitSpy).toHaveBeenCalledWith('');
  });
});
