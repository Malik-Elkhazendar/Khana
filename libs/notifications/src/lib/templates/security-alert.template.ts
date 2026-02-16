import { wrapInLayout, formatDateTime } from './base.template';
import { SecurityAlertData } from '../interfaces/email.interface';

export function securityAlertTemplate(data: SecurityAlertData): string {
  const timestamp = data.timestamp ?? new Date();
  return wrapInLayout(
    data.subject,
    `
      <h2>${data.subject}</h2>
      <div class="alert-box">
        <p>${data.message}</p>
      </div>
      <table class="detail-table">
        <tr>
          <td>Account</td>
          <td>${data.recipientEmail}</td>
        </tr>
        <tr>
          <td>Time</td>
          <td>${formatDateTime(timestamp)}</td>
        </tr>
        ${
          data.ipAddress
            ? `<tr><td>IP Address</td><td>${data.ipAddress}</td></tr>`
            : ''
        }
      </table>
      <p>If this was not you, please change your password immediately and contact support.</p>
    `
  );
}
