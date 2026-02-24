export const LOG_EVENTS = {
  // HTTP
  HTTP_REQUEST_COMPLETED: 'http.request.completed',
  HTTP_REQUEST_FAILED: 'http.request.failed',

  // Auth
  AUTH_REGISTER_SUCCESS: 'auth.register.success',
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_REFRESH_ROTATED: 'auth.refresh.rotated',
  AUTH_REFRESH_FAILED: 'auth.refresh.failed',
  AUTH_REFRESH_REUSE_DETECTED: 'auth.refresh.reuse_detected',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGOUT_DEVICE: 'auth.logout.device',
  AUTH_LOGOUT_ALL_DEVICES: 'auth.logout.all_devices',
  AUTH_PASSWORD_CHANGED: 'auth.password.changed',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  AUTH_PASSWORD_RESET_COMPLETED: 'auth.password.reset_completed',
  AUTH_SECURITY_ESCALATION: 'auth.security.escalation',

  // Booking
  BOOKING_CREATE_SUCCESS: 'booking.create.success',
  BOOKING_CREATE_CONFLICT: 'booking.create.conflict',
  BOOKING_STATUS_UPDATED: 'booking.status.updated',
  BOOKING_STATUS_INVALID_TRANSITION: 'booking.status.invalid_transition',

  // Email
  EMAIL_SENT: 'email.sent',
  EMAIL_FAILED: 'email.failed',

  // Metrics
  METRICS_REUSE_DETECTED: 'metrics.refresh_token.reuse_detected',
  METRICS_REFRESH_FAILED: 'metrics.refresh_token.failed',
  METRICS_ROTATION_LATENCY: 'metrics.refresh_token.rotation_latency',
  METRICS_ACTIVE_SESSIONS: 'metrics.refresh_token.active_sessions',
  METRICS_SECURITY_ESCALATION: 'metrics.refresh_token.security_escalation',

  // System
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SEED_COMPLETE: 'system.seed.complete',
  SYSTEM_SEED_SKIPPED: 'system.seed.skipped',
  SYSTEM_SEED_FAILED: 'system.seed.failed',
  SYSTEM_CLEANUP_COMPLETE: 'system.cleanup.complete',
} as const;

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];

export const REDACTED_FIELDS: string[] = [
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'cookie',
  'resettoken',
  'tokenhash',
  'passwordhash',
  'secret',
  'apikey',
];

export const MASKED_FIELDS: string[] = ['email', 'phone'];
