import { wrapInLayout, formatDateTime } from './base.template';
import { PasswordChangedData } from '../interfaces/email.interface';

export function passwordChangedTemplate(data: PasswordChangedData): string {
  const timestamp = data.timestamp ?? new Date();
  return wrapInLayout(
    'Password Changed',
    `
      <h2>Password Changed Successfully</h2>
      <div class="success-box">
        <p>Your password has been changed successfully.</p>
      </div>
      <table class="detail-table">
        <tr>
          <td>Account</td>
          <td>${data.recipientEmail}</td>
        </tr>
        <tr>
          <td>Changed At</td>
          <td>${formatDateTime(timestamp)}</td>
        </tr>
      </table>
      <p>All other active sessions have been logged out for your security.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    `
  );
}
