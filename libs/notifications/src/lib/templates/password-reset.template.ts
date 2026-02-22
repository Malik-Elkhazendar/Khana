import { formatDateTime, wrapInLayout } from './base.template';
import { PasswordResetData } from '../interfaces/email.interface';

export function passwordResetTemplate(data: PasswordResetData): string {
  const resetUrl = data.resetUrl
    ? `<a href="${data.resetUrl}" class="cta-button">Reset My Password</a>`
    : `<p style="word-break: break-all; margin: 8px 0 0;"><code>${data.resetToken}</code></p>`;

  return wrapInLayout(
    'Reset Your Password',
    `
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password.</p>
      <div class="info-box">
        ${resetUrl}
      </div>
      <table class="detail-table">
        <tr>
          <td>Account</td>
          <td>${data.recipientEmail}</td>
        </tr>
        <tr>
          <td>Expires At</td>
          <td>${formatDateTime(data.expiresAt)}</td>
        </tr>
      </table>
      <p>If you did not request this, you can safely ignore this email.</p>
    `
  );
}
