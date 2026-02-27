import { formatDateTime, wrapInLayout } from './base.template';
import { TeamInviteData } from '../interfaces/email.interface';

export function teamInviteTemplate(data: TeamInviteData): string {
  const inviteCta = data.inviteUrl
    ? `<a href="${data.inviteUrl}" class="cta-button">Accept Invitation</a>`
    : `<p style="word-break: break-all; margin: 8px 0 0;"><code>${data.inviteToken}</code></p>`;

  return wrapInLayout(
    'You are invited to Khana',
    `
      <h2>Team Invitation</h2>
      <p>${data.invitedByName} invited you to join a Khana workspace.</p>
      <div class="info-box">
        ${inviteCta}
      </div>
      <table class="detail-table">
        <tr>
          <td>Email</td>
          <td>${data.recipientEmail}</td>
        </tr>
        <tr>
          <td>Assigned Role</td>
          <td>${data.role}</td>
        </tr>
        <tr>
          <td>Expires At</td>
          <td>${formatDateTime(data.expiresAt)}</td>
        </tr>
      </table>
      <p>Use the invitation link above to set your password and access your account.</p>
    `
  );
}
