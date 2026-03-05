import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BookingDetailComponent } from './booking-detail.component';
import { BookingStore } from '../../state/bookings/booking.store';
import { createStoreMock, BookingStoreMock } from '../../testing/store-mocks';
import { createBooking } from '../../testing/factories';

describe('BookingDetailComponent', () => {
  let storeMock: BookingStoreMock;
  let paramMap$: BehaviorSubject<ParamMap>;

  const setupComponent = () => {
    const fixture = TestBed.createComponent(BookingDetailComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    storeMock = createStoreMock();
    const booking = createBooking({ id: 'booking-42' });
    storeMock.bookingDetailsById.set({ [booking.id]: booking });
    storeMock.getBookingDetail.mockImplementation(
      (id: string) => storeMock.bookingDetailsById()[id] ?? null
    );

    paramMap$ = new BehaviorSubject(convertToParamMap({ id: booking.id }));

    await TestBed.configureTestingModule({
      imports: [BookingDetailComponent],
      providers: [
        { provide: BookingStore, useValue: storeMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads booking details from route param id', () => {
    setupComponent();

    expect(storeMock.loadBookingById).toHaveBeenCalledWith('booking-42');
    expect(storeMock.clearBookingDetailError).toHaveBeenCalledWith(
      'booking-42'
    );
  });

  it('renders booking details when data is available', () => {
    const { fixture } = setupComponent();

    expect(fixture.nativeElement.textContent).toContain('Test Customer');
    expect(fixture.nativeElement.textContent).toContain('BK-001');
  });

  it('renders error state when detail loading fails', () => {
    storeMock.detailErrorsById.set({ 'booking-42': 'Load failed' });
    const { fixture } = setupComponent();

    expect(fixture.nativeElement.textContent).toContain('Load failed');
  });

  it('updates current booking when route param changes', () => {
    const secondBooking = createBooking({ id: 'booking-77' });
    storeMock.bookingDetailsById.update((state) => ({
      ...state,
      [secondBooking.id]: secondBooking,
    }));
    storeMock.getBookingDetail.mockImplementation(
      (id: string) => storeMock.bookingDetailsById()[id] ?? null
    );

    const { component } = setupComponent();

    paramMap$.next(convertToParamMap({ id: secondBooking.id }));

    expect(component.bookingId()).toBe('booking-77');
    expect(storeMock.loadBookingById).toHaveBeenCalledWith('booking-77');
  });
});
