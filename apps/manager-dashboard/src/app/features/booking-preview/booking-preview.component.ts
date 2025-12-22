import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../shared/services/api.service';
import {
  FacilityListItemDto,
  BookingPreviewResponseDto,
  AlternativeSlotDto,
  BookingStatus,
} from '@khana/shared-dtos';

@Component({
  selector: 'app-booking-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-preview.component.html',
  styleUrl: './booking-preview.component.scss',
})
export class BookingPreviewComponent implements OnInit {
  private readonly api = inject(ApiService);

  // Form state
  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');
  selectedDate = signal<string>(this.getDefaultDate());
  startTime = signal<string>('10:00');
  endTime = signal<string>('11:00');
  promoCode = signal<string>('');

  // Result state
  previewResult = signal<BookingPreviewResponseDto | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Customer details (shown when booking is available)
  customerName = signal<string>('');
  customerPhone = signal<string>('');
  holdAsPending = signal<boolean>(false);
  bookingInProgress = signal<boolean>(false);
  bookingSuccess = signal<boolean>(false);

  // Computed values
  selectedFacility = computed(() => {
    return this.facilities().find(f => f.id === this.selectedFacilityId());
  });

  canSubmit = computed(() => {
    return (
      this.selectedFacilityId() &&
      this.selectedDate() &&
      this.startTime() &&
      this.endTime() &&
      !this.loading()
    );
  });

  canBook = computed(() => {
    const result = this.previewResult();
    return (
      result?.canBook &&
      this.customerName().trim() !== '' &&
      this.customerPhone().trim() !== '' &&
      !this.bookingInProgress()
    );
  });

  ngOnInit(): void {
    this.loadFacilities();
  }

  private loadFacilities(): void {
    this.api.getFacilities().subscribe({
      next: (facilities) => {
        this.facilities.set(facilities);
        if (facilities.length > 0) {
          this.selectedFacilityId.set(facilities[0].id);
        }
      },
      error: (err) => {
        this.error.set('Failed to load facilities. Please try again.');
        console.error('Error loading facilities:', err);
      },
    });
  }

  private getDefaultDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    this.loading.set(true);
    this.error.set(null);
    this.previewResult.set(null);

    const startDateTime = new Date(`${this.selectedDate()}T${this.startTime()}`);
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);

    this.api
      .previewBooking({
        facilityId: this.selectedFacilityId(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        promoCode: this.promoCode() || undefined,
      })
      .subscribe({
        next: (result) => {
          this.previewResult.set(result);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 404) {
            this.error.set('Facility not found.');
          } else {
            this.error.set('Failed to preview booking. Please try again.');
          }
          console.error('Error previewing booking:', err);
        },
      });
  }

  selectAlternative(alt: AlternativeSlotDto): void {
    const startDate = new Date(alt.startTime);
    const endDate = new Date(alt.endTime);

    this.selectedDate.set(startDate.toISOString().split('T')[0]);
    this.startTime.set(startDate.toTimeString().slice(0, 5));
    this.endTime.set(endDate.toTimeString().slice(0, 5));

    this.onSubmit();
  }

  formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('en-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  onBook(): void {
    if (!this.canBook()) return;

    this.bookingInProgress.set(true);
    this.error.set(null);

    const startDateTime = new Date(`${this.selectedDate()}T${this.startTime()}`);
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);

    this.api
      .createBooking({
        facilityId: this.selectedFacilityId(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        customerName: this.customerName().trim(),
        customerPhone: this.customerPhone().trim(),
        status: this.holdAsPending() ? BookingStatus.PENDING : undefined,
      })
      .subscribe({
        next: () => {
          this.bookingInProgress.set(false);
          this.bookingSuccess.set(true);
          // Reset form for next booking
          this.customerName.set('');
          this.customerPhone.set('');
          this.holdAsPending.set(false);
          this.previewResult.set(null);
        },
        error: (err) => {
          this.bookingInProgress.set(false);
          const message = err.error?.message || 'Failed to create booking. Please try again.';
          this.error.set(message);
          console.error('Error creating booking:', err);
        },
      });
  }

  resetBooking(): void {
    this.bookingSuccess.set(false);
    this.customerName.set('');
    this.customerPhone.set('');
    this.holdAsPending.set(false);
  }
}
