import { TestBed } from '@angular/core/testing';
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

  it('renders the label and placeholder', () => {
    const { fixture } = setup({ placeholder: 'Reason here' });

    const label = fixture.nativeElement.querySelector('label');
    const textarea = fixture.nativeElement.querySelector('textarea');
    expect(label?.textContent).toContain('Cancellation reason');
    expect(textarea?.getAttribute('placeholder')).toBe('Reason here');
  });

  it('binds the reason value to the textarea', () => {
    const { fixture } = setup({ reason: 'Late notice' });

    const textarea = fixture.nativeElement.querySelector('textarea');
    expect(textarea?.value).toBe('Late notice');
  });

  it('shows the default minimum length', () => {
    const { fixture } = setup();

    const hint = fixture.nativeElement.querySelector('.cancel-form__hint');
    const count = fixture.nativeElement.querySelector('.cancel-form__count');
    expect(hint?.textContent).toContain('Minimum 5 characters');
    expect(count?.textContent).toContain('0 / 5');
  });

  it('respects custom minLength input', () => {
    const { fixture, component } = setup({
      minLength: 10,
      reason: '1234567890',
    });

    const hint = fixture.nativeElement.querySelector('.cancel-form__hint');
    const count = fixture.nativeElement.querySelector('.cancel-form__count');
    expect(hint?.textContent).toContain('Minimum 10 characters');
    expect(count?.textContent).toContain('10 / 10');
    expect(component.isValid).toBe(true);
  });

  it('trims whitespace for validation', () => {
    const { component } = setup({ reason: '  abc  ', minLength: 5 });

    expect(component.trimmedLength).toBe(3);
    expect(component.isValid).toBe(false);
  });

  it('marks input as valid when trimmed length meets minimum', () => {
    const { component } = setup({ reason: 'valid', minLength: 5 });

    expect(component.isValid).toBe(true);
  });

  it('emits reasonChange on input', () => {
    const { fixture, component } = setup();
    const emitSpy = jest.spyOn(component.reasonChange, 'emit');
    const textarea = fixture.nativeElement.querySelector('textarea');

    textarea.value = 'Changed reason';
    textarea.dispatchEvent(new Event('input'));

    expect(emitSpy).toHaveBeenCalledWith('Changed reason');
  });

  it('emits empty string when input target is missing', () => {
    const { component } = setup();
    const emitSpy = jest.spyOn(component.reasonChange, 'emit');

    component.onInput({ target: null } as unknown as Event);

    expect(emitSpy).toHaveBeenCalledWith('');
  });

  it('supports Arabic text', () => {
    const { component } = setup({ reason: 'مرحبا', minLength: 5 });

    expect(component.trimmedLength).toBe(5);
    expect(component.isValid).toBe(true);
  });

  it('sets minlength attribute on textarea', () => {
    const { fixture } = setup({ minLength: 7 });

    const textarea = fixture.nativeElement.querySelector('textarea');
    expect(textarea?.getAttribute('minlength')).toBe('7');
  });

  it('links the label to the textarea id', () => {
    const { fixture, component } = setup();

    const label = fixture.nativeElement.querySelector('label');
    const textarea = fixture.nativeElement.querySelector('textarea');
    expect(label?.getAttribute('for')).toBe(component.textAreaId);
    expect(textarea?.getAttribute('id')).toBe(component.textAreaId);
  });

  it('toggles error hint class based on validity', () => {
    const { fixture } = setup({ reason: 'no', minLength: 5 });

    const hint = fixture.nativeElement.querySelector('.cancel-form__hint');
    expect(hint?.classList.contains('cancel-form__hint--error')).toBe(true);

    fixture.componentRef.setInput('reason', 'valid reason');
    fixture.detectChanges();
    const updatedHint =
      fixture.nativeElement.querySelector('.cancel-form__hint');
    expect(updatedHint?.classList.contains('cancel-form__hint--error')).toBe(
      false
    );
  });
});
