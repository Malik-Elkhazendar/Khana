import { TestBed } from '@angular/core/testing';
import { HoldTimerComponent } from './hold-timer.component';

describe('HoldTimerComponent', () => {
  const baseTime = new Date('2025-03-01T10:00:00Z');

  const setup = (
    holdUntil: string | null | undefined,
    overrides: Partial<HoldTimerComponent> = {}
  ) => {
    const fixture = TestBed.createComponent(HoldTimerComponent);
    const component = fixture.componentInstance;
    Object.assign(component, overrides);
    component.holdUntil = holdUntil;
    fixture.detectChanges();
    return { fixture, component };
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(baseTime);

    await TestBed.configureTestingModule({
      imports: [HoldTimerComponent],
    }).compileComponents();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders empty state when holdUntil is undefined', () => {
    const { component } = setup(undefined);

    expect(component.view().state).toBe('none');
    expect(component.view().label).toBe('Unavailable');
  });

  it('renders empty state when holdUntil is null', () => {
    const { component } = setup(null);

    expect(component.view().state).toBe('none');
    expect(component.view().label).toBe('Unavailable');
  });

  it('renders empty state for invalid holdUntil value', () => {
    const { component } = setup('not-a-date');

    expect(component.view().state).toBe('none');
  });

  it('renders expired state when holdUntil is in the past', () => {
    const holdUntil = new Date(baseTime.getTime() - 1000).toISOString();
    const { component } = setup(holdUntil);

    expect(component.view().state).toBe('expired');
    expect(component.view().label).toBe('Expired');
  });

  it('renders active state when holdUntil is in the future', () => {
    const holdUntil = new Date(
      baseTime.getTime() + 5 * 60 * 1000
    ).toISOString();
    const { component } = setup(holdUntil);

    expect(component.view().state).toBe('active');
    expect(component.view().label).toBe('05:00');
  });

  it('uses the custom prefix label when provided', () => {
    const holdUntil = new Date(baseTime.getTime() + 60 * 1000).toISOString();
    const { fixture } = setup(holdUntil, { prefix: 'Hold ends' });

    const label = fixture.nativeElement.querySelector('.hold-timer__label');
    expect(label?.textContent).toContain('Hold ends');
  });

  it('uses the custom expired label when provided', () => {
    const holdUntil = new Date(baseTime.getTime() - 1000).toISOString();
    const { component } = setup(holdUntil, { expiredLabel: 'Time up' });

    expect(component.view().label).toBe('Time up');
  });

  it('uses the custom empty label when provided', () => {
    const { component } = setup(null, { emptyLabel: 'No hold set' });

    expect(component.view().label).toBe('No hold set');
  });

  it('formats durations in hours when over one hour', () => {
    const holdUntil = new Date(
      baseTime.getTime() + (2 * 60 + 5) * 60 * 1000
    ).toISOString();
    const { component } = setup(holdUntil);

    expect(component.view().label).toBe('2h 05m');
  });

  it('formats durations as minutes and seconds under one hour', () => {
    const holdUntil = new Date(baseTime.getTime() + 90 * 1000).toISOString();
    const { component } = setup(holdUntil);

    expect(component.view().label).toBe('01:30');
  });

  it('decrements the countdown every second', () => {
    const holdUntil = new Date(
      baseTime.getTime() + 5 * 60 * 1000
    ).toISOString();
    const { component, fixture } = setup(holdUntil);

    const initial = component.view().label;
    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(component.view().label).not.toBe(initial);
    expect(component.view().label).toBe('04:59');
  });

  it('moves to expired state when countdown reaches zero', () => {
    const holdUntil = new Date(baseTime.getTime() + 1000).toISOString();
    const { component, fixture } = setup(holdUntil);

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(component.view().state).toBe('expired');
  });

  it('applies the expired class when hold is expired', () => {
    const holdUntil = new Date(baseTime.getTime() - 1000).toISOString();
    const { fixture } = setup(holdUntil);

    const container = fixture.nativeElement.querySelector('.hold-timer');
    expect(container?.classList.contains('hold-timer--expired')).toBe(true);
  });

  it('applies the empty class when hold is unavailable', () => {
    const { fixture } = setup(null);

    const container = fixture.nativeElement.querySelector('.hold-timer');
    expect(container?.classList.contains('hold-timer--empty')).toBe(true);
  });

  it('does not render the prefix when expired', () => {
    const holdUntil = new Date(baseTime.getTime() - 1000).toISOString();
    const { fixture } = setup(holdUntil);

    const label = fixture.nativeElement.querySelector('.hold-timer__label');
    expect(label).toBeNull();
  });

  it('handles timezone offsets in holdUntil', () => {
    const holdUntil = '2025-03-01T14:00:00+03:00';
    const { component } = setup(holdUntil);

    expect(component.view().state).toBe('active');
  });

  it('renders status role and live region attributes', () => {
    const holdUntil = new Date(baseTime.getTime() + 60 * 1000).toISOString();
    const { fixture } = setup(holdUntil);

    const container = fixture.nativeElement.querySelector('.hold-timer');
    expect(container?.getAttribute('role')).toBe('status');
    expect(container?.getAttribute('aria-live')).toBe('polite');
    expect(container?.getAttribute('aria-atomic')).toBe('true');
  });

  it('stops ticking after the component is destroyed', () => {
    const holdUntil = new Date(baseTime.getTime() + 60 * 1000).toISOString();
    const { fixture, component } = setup(holdUntil);
    const initial = component.now();

    fixture.destroy();
    jest.advanceTimersByTime(2000);

    expect(component.now()).toBe(initial);
  });
});
