import { wrapInLayout, formatDateTime, formatCurrency } from './base.template';
import { BookingConfirmationData } from '../interfaces/email.interface';

export function bookingConfirmationTemplate(
  data: BookingConfirmationData
): string {
  return wrapInLayout(
    'Booking Confirmed',
    `
      <p class="k-eyebrow">Booking Confirmation</p>
      <h2>Booking Confirmed!</h2>
      <p>Your slot is now reserved and ready.</p>
      <span class="reference-chip">Reference: ${data.bookingReference}</span>

      <div class="success-box">
        <p>Your booking has been successfully created and saved in the system.</p>
      </div>

      <table class="detail-table">
        <tr>
          <td>Facility</td>
          <td>${data.facilityName}</td>
        </tr>
        <tr>
          <td>Customer</td>
          <td>${data.customerName}</td>
        </tr>
        <tr>
          <td>Phone</td>
          <td>${data.customerPhone}</td>
        </tr>
        <tr>
          <td>Start</td>
          <td>${formatDateTime(data.startTime)}</td>
        </tr>
        <tr>
          <td>End</td>
          <td>${formatDateTime(data.endTime)}</td>
        </tr>
        <tr class="total-row">
          <td>Total</td>
          <td>${formatCurrency(data.totalAmount, data.currency)}</td>
        </tr>
      </table>

      <div class="info-box">
        Please arrive 10 minutes before your scheduled time for smooth check-in.
      </div>
    `
  );
}
