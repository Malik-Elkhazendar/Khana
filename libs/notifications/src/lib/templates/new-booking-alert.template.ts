import { wrapInLayout, formatDateTime, formatCurrency } from './base.template';
import { NewBookingAlertData } from '../interfaces/email.interface';

export function newBookingAlertTemplate(data: NewBookingAlertData): string {
  return wrapInLayout(
    'New Booking Alert',
    `
      <h2>New Booking Received</h2>
      <div class="success-box">
        <p>A new booking has been created at your facility.</p>
      </div>
      <table class="detail-table">
        <tr>
          <td>Reference</td>
          <td><strong>${data.bookingReference}</strong></td>
        </tr>
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
        <tr>
          <td>Total</td>
          <td><strong>${formatCurrency(
            data.totalAmount,
            data.currency
          )}</strong></td>
        </tr>
      </table>
    `
  );
}
