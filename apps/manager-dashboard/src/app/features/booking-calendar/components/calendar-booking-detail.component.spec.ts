import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarBookingDetailComponent } from './calendar-booking-detail.component';
import { createBooking } from '../../../testing/factories';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';

describe('CalendarBookingDetailComponent', () => {
  let fixture: ComponentFixture<CalendarBookingDetailComponent>;
  let component: CalendarBookingDetailComponent;

  const createComponent = () => {
    fixture = TestBed.createComponent(CalendarBookingDetailComponent);
    component = fixture.componentInstance;
    return { fixture, component };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarBookingDetailComponent],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders booking details including promo fields when promo is applied', () => {
    const booking = createBooking({
      id: 'booking-1',
      bookingReference: 'KHN-ABC123',
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      priceBreakdown: {
        basePrice: 100,
        timeMultiplier: 1,
        dayMultiplier: 1,
        durationDiscount: 0,
        subtotal: 100,
        discountAmount: 20,
        promoDiscount: 20,
        promoCode: 'SAVE20',
        total: 80,
        currency: 'SAR',
      },
    });

    createComponent();
    component.booking = booking;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Test Customer');
    expect(fixture.nativeElement.textContent).toContain('KHN-ABC123');
    expect(fixture.nativeElement.textContent).toContain('SAVE20');

    const phoneLink = fixture.nativeElement.querySelector(
      '.calendar-detail-panel__phone'
    ) as HTMLAnchorElement | null;
    expect(phoneLink?.getAttribute('href')).toBe(
      `tel:${booking.customerPhone}`
    );
  });

  it('hides promo rows when no promo code is present', () => {
    const booking = createBooking({
      id: 'booking-no-promo',
      priceBreakdown: {
        basePrice: 100,
        timeMultiplier: 1,
        dayMultiplier: 1,
        durationDiscount: 0,
        subtotal: 100,
        discountAmount: 0,
        total: 100,
        currency: 'SAR',
      },
    });

    createComponent();
    component.booking = booking;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Promo code');
  });

  it('normalizes invalid promo discount values to zero', () => {
    const booking = createBooking({
      id: 'booking-bad-promo',
      priceBreakdown: {
        basePrice: 100,
        timeMultiplier: 1,
        dayMultiplier: 1,
        durationDiscount: 0,
        subtotal: 100,
        discountAmount: 0,
        promoDiscount: Number.NaN,
        promoCode: 'SAVE20',
        total: 100,
        currency: 'SAR',
      },
    });

    createComponent();
    component.booking = booking;
    fixture.detectChanges();

    expect(component.promoDiscount).toBe(0);
  });

  it('emits interaction outputs from panel actions', () => {
    const booking = createBooking({ id: 'booking-actions' });

    createComponent();
    component.booking = booking;
    component.canManageActions = true;
    fixture.detectChanges();

    const cancelSpy = jest.fn();
    const paySpy = jest.fn();
    const detailsSpy = jest.fn();

    component.cancelRequested.subscribe(cancelSpy);
    component.markPaidRequested.subscribe(paySpy);
    component.viewFullDetailsRequested.subscribe(detailsSpy);

    const actionButtons = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.calendar-detail-panel__actions .btn'
      )
    ) as HTMLButtonElement[];
    actionButtons[0]?.click();
    actionButtons[1]?.click();

    const detailsButton = fixture.nativeElement.querySelector(
      '.calendar-detail-panel__full-link'
    ) as HTMLButtonElement | null;
    detailsButton?.click();

    expect(paySpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(detailsSpy).toHaveBeenCalledTimes(1);
  });

  it('emits close when escape key is pressed or backdrop is clicked', () => {
    const booking = createBooking({ id: 'booking-close' });

    createComponent();
    component.booking = booking;
    fixture.detectChanges();

    const closeSpy = jest.fn();
    component.closeRequested.subscribe(closeSpy);

    const panel = fixture.nativeElement.querySelector(
      '.calendar-detail-panel'
    ) as HTMLElement | null;
    panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const backdrop = fixture.nativeElement.querySelector(
      '.calendar-detail-backdrop'
    ) as HTMLButtonElement | null;
    backdrop?.click();

    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('sets dialog accessibility attributes', () => {
    createComponent();
    component.booking = createBooking({ id: 'booking-aria' });
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(
      '.calendar-detail-panel'
    ) as HTMLElement | null;

    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
  });

  it('renders the full-details direction cue as a decorative element without hardcoded text glyphs', () => {
    createComponent();
    component.booking = createBooking({ id: 'booking-full-link' });
    fixture.detectChanges();

    const arrow = fixture.nativeElement.querySelector(
      '.calendar-detail-panel__full-link-arrow'
    ) as HTMLElement | null;

    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute('aria-hidden')).toBe('true');
    expect(arrow?.textContent?.trim()).toBe('');
  });
});
