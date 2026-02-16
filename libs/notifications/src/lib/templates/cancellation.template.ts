import { wrapInLayout, formatDateTime } from './base.template';
import { CancellationData } from '../interfaces/email.interface';

export function cancellationTemplate(data: CancellationData): string {
  return wrapInLayout(
    'Booking Cancelled',
    `
      <h2>Booking Cancelled</h2>
      <div class="alert-box">
        <p>Your booking has been cancelled.</p>
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
          <td>Original Start</td>
          <td>${formatDateTime(data.startTime)}</td>
        </tr>
        <tr>
          <td>Original End</td>
          <td>${formatDateTime(data.endTime)}</td>
        </tr>
        <tr>
          <td>Reason</td>
          <td>${data.reason}</td>
        </tr>
      </table>
      <p>If you have any questions, please contact the facility directly.</p>
    `
  );
}
