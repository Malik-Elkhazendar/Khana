/**
 * Base email template wrapper with Khana branding (Desert Night theme).
 * Uses CSS Logical Properties for RTL readiness.
 */
export function wrapInLayout(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #edf2f7;
      color: #1f2937;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin-inline: auto;
      background-color: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      margin-block: 24px;
      border: 1px solid #dbe4f0;
      box-shadow: 0 10px 28px rgba(17, 24, 39, 0.08);
    }
    .email-header {
      background: linear-gradient(135deg, #1d2a44 0%, #23365a 100%);
      padding-block: 22px;
      padding-inline: 28px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .email-body {
      padding-block: 28px;
      padding-inline: 28px;
      background-color: #ffffff;
    }
    .email-body h2 {
      color: #111827;
      font-size: 24px;
      margin-block-start: 0;
      margin-block-end: 10px;
      line-height: 1.3;
    }
    .email-body p {
      color: #4b5563;
      font-size: 15px;
      margin-block-end: 12px;
    }
    .k-eyebrow {
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
    }
    .reference-chip {
      display: inline-block;
      margin: 6px 0 0;
      padding: 6px 12px;
      border-radius: 999px;
      background-color: #f3f6fa;
      border: 1px solid #d8e1ee;
      color: #1f2f4f;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      margin-block: 18px;
      border: 1px solid #e3eaf3;
      border-radius: 10px;
      overflow: hidden;
    }
    .detail-table td {
      padding-block: 10px;
      padding-inline: 14px;
      border-block-end: 1px solid #eef3f9;
      font-size: 14px;
      background-color: #ffffff;
    }
    .detail-table td:first-child {
      color: #64748b;
      width: 40%;
      font-weight: 600;
    }
    .detail-table td:last-child {
      color: #111827;
      font-weight: 500;
    }
    .detail-table tr:last-child td {
      border-block-end: 0;
    }
    .detail-table .total-row td {
      background-color: #f7fafc;
      font-size: 15px;
    }
    .detail-table .total-row td:last-child {
      color: #0f2a55;
      font-weight: 800;
    }
    .cta-button {
      display: inline-block;
      background-color: #1d2a44;
      color: #ffffff !important;
      text-decoration: none;
      padding-block: 12px;
      padding-inline: 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      margin-block-start: 16px;
    }
    .alert-box {
      background-color: #fff1f2;
      border-inline-start: 4px solid #e11d48;
      padding-block: 14px;
      padding-inline: 20px;
      border-radius: 4px;
      margin-block: 16px;
    }
    .alert-box p {
      color: #7f1d1d;
      margin: 0;
    }
    .success-box {
      background-color: #edf9f2;
      border-inline-start: 4px solid #16a34a;
      padding-block: 14px;
      padding-inline: 20px;
      border-radius: 4px;
      margin-block: 16px;
    }
    .success-box p {
      color: #166534;
      margin: 0;
    }
    .info-box {
      background-color: #f8fbff;
      border: 1px solid #e0eaf6;
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 12px;
      color: #334155;
      font-size: 14px;
    }
    .email-footer {
      background-color: #f8fbff;
      border-top: 1px solid #e4ebf5;
      padding-block: 18px;
      padding-inline: 28px;
      text-align: center;
    }
    .email-footer p {
      color: #6b7280;
      font-size: 12px;
      margin: 4px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-container { margin-inline: 8px; }
      .email-body { padding-inline: 18px; }
      .email-header { padding-inline: 18px; }
      .email-footer { padding-inline: 18px; }
      .email-body h2 { font-size: 21px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Khana</h1>
    </div>
    <div class="email-body">
      ${bodyContent}
    </div>
    <div class="email-footer">
      <p>Khana - Booking Management Platform</p>
      <p>This is an automated message. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toFixed(2)}`;
}
