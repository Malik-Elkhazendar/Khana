/**
 * Mask an email address for safe logging.
 * "test@example.com" -> "t***@example.com"
 * Single char local: "a@b.com" -> "a***@b.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

/**
 * Mask a phone number for safe logging.
 * "+966501234567" -> "+966***4567"
 * Short numbers (<=7 chars) are fully masked.
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  if (phone.length <= 7) return '***';
  if (phone.length <= 10) {
    return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
  }
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}
