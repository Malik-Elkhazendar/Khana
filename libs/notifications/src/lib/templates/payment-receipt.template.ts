import { wrapInLayout, formatDateTime, formatCurrency } from './base.template';
import { PaymentReceiptData } from '../interfaces/email.interface';

export function paymentReceiptTemplate(data: PaymentReceiptData): string {
  return wrapInLayout(
    'Payment Receipt',
    `
      <h2>Payment Receipt</h2>
      <div class="success-box">
        <p>Payment received successfully. Thank you!</p>
      </div>
      <table class="detail-table">
        <tr>
          <td>Booking Reference</td>
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
          <td>Amount Paid</td>
          <td><strong>${formatCurrency(
            data.totalAmount,
            data.currency
          )}</strong></td>
        </tr>
        <tr>
          <td>Paid At</td>
          <td>${formatDateTime(data.paidAt)}</td>
        </tr>
      </table>
      <p>Keep this email as your payment receipt.</p>
    `
  );
}
