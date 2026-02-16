import { wrapInLayout, formatCurrency } from './base.template';
import { RefundData } from '../interfaces/email.interface';

export function refundTemplate(data: RefundData): string {
  return wrapInLayout(
    'Refund Processed',
    `
      <h2>Refund Processed</h2>
      <div class="success-box">
        <p>A refund has been processed for your booking.</p>
      </div>
      <table class="detail-table">
        <tr>
          <td>Booking Reference</td>
          <td><strong>${data.bookingReference}</strong></td>
        </tr>
        <tr>
          <td>Customer</td>
          <td>${data.customerName}</td>
        </tr>
        <tr>
          <td>Refund Amount</td>
          <td><strong>${formatCurrency(
            data.refundAmount,
            data.currency
          )}</strong></td>
        </tr>
      </table>
      <p>The refund will appear in your account within 5-10 business days.</p>
    `
  );
}
