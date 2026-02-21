/**
 * Development Environment Configuration
 * Used by: ng serve (default)
 * API: http://localhost:3000/api
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
  apiVersion: 'v1',

  // Authentication
  auth: {
    tokenKey: 'khana_token',
    refreshTokenKey: 'khana_refresh_token',
    // Optional tenant override. Leave empty to auto-resolve a real tenant
    // from /api/v1/auth/tenant at runtime.
    tenantId: '',
  },

  // Feature flags
  features: {
    paymentGateway: false,
    customerApp: false,
    analytics: true,
    debugMode: true,
  },

  // Logging
  logging: {
    level: 'debug',
    console: true,
    sentry: false,
  },

  // UI/UX
  ui: {
    theme: 'desert-night',
    language: 'en',
    rtl: false,
  },

  // Marketing
  marketing: {
    salesEmail: 'sales@khana.com',
  },

  // Timeouts (milliseconds)
  timeouts: {
    http: 30000,
    tokenRefresh: 60000,
    sessionWarning: 300000,
  },

  // API endpoints
  endpoints: {
    auth: {
      register: '/v1/auth/register',
      login: '/v1/auth/login',
      logout: '/v1/auth/logout',
      refresh: '/v1/auth/refresh',
      me: '/v1/auth/me',
      changePassword: '/v1/auth/change-password',
      forgotPassword: '/v1/auth/forgot-password',
      resetPassword: '/v1/auth/reset-password',
    },
    bookings: {
      list: '/v1/bookings',
      create: '/v1/bookings',
      preview: '/v1/bookings/preview',
      updateStatus: '/v1/bookings/:id/status',
      facilities: '/v1/bookings/facilities',
    },
  },
};
