export const LOG_EVENTS = {
  // HTTP
  HTTP_REQUEST_COMPLETED: 'http.request.completed',
  HTTP_REQUEST_FAILED: 'http.request.failed',

  // Auth
  AUTH_REGISTER_SUCCESS: 'auth.register.success',
  AUTH_REGISTER_BLOCKED_NONEMPTY_TENANT:
    'auth.register.blocked_nonempty_tenant',
  AUTH_SIGNUP_OWNER_SUCCESS: 'auth.signup_owner.success',
  AUTH_SIGNUP_OWNER_FAILED: 'auth.signup_owner.failed',
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_TENANT_RESOLVE_FAILED: 'auth.tenant.resolve_failed',
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
  BOOKING_HOLD_EXPIRED: 'booking.hold.expired',
  BOOKING_HOLD_EXPIRE_COMPLETE: 'booking.hold.expire.complete',
  BOOKING_HOLD_EXPIRE_FAILED: 'booking.hold.expire.failed',
  BOOKING_HOLD_WAITLIST_NOTIFIED: 'booking.hold.waitlist.notified',
  WAITLIST_JOIN_SUCCESS: 'waitlist.join.success',
  WAITLIST_NOTIFY_SUCCESS: 'waitlist.notify.success',
  WAITLIST_NOTIFY_FAILED: 'waitlist.notify.failed',
  WAITLIST_NOTIFY_MANUAL: 'waitlist.notify.manual',
  WAITLIST_FULFILL_SUCCESS: 'waitlist.fulfill.success',
  WAITLIST_FULFILL_FAILED: 'waitlist.fulfill.failed',
  WAITLIST_EXPIRE_COMPLETE: 'waitlist.expire.complete',
  WAITLIST_EXPIRE_FAILED: 'waitlist.expire.failed',
  WAITLIST_EXPIRE_MANUAL: 'waitlist.expire.manual',
  PROMO_CODE_CREATE_SUCCESS: 'promo_code.create.success',
  PROMO_CODE_UPDATE_SUCCESS: 'promo_code.update.success',

  // Analytics
  ANALYTICS_QUERY_SUCCESS: 'analytics.query.success',
  ANALYTICS_DATA_INTEGRITY_WARNING: 'analytics.data_integrity.warning',

  // Goals
  GOALS_SETTINGS_UPDATED: 'goals.settings.updated',
  GOALS_MILESTONE_REACHED: 'goals.milestone.reached',
  GOALS_MILESTONE_SYNC_FAILED: 'goals.milestone.sync_failed',

  // Customers
  CUSTOMER_TAGS_UPDATED: 'customer.tags.updated',
  CUSTOMER_UPSERT_FAILED: 'customer.upsert.failed',

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
