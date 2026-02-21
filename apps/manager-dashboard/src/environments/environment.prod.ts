/**
 * Production Environment Configuration
 * Used by: ng build --configuration production
 * API: https://api.khana.app
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.khana.app',
  apiVersion: 'v1',

  // Authentication
  auth: {
    tokenKey: 'khana_token',
    refreshTokenKey: 'khana_refresh_token',
    tenantId: '',
  },

  // Feature flags
  features: {
    paymentGateway: true,
    customerApp: true,
    analytics: true,
    debugMode: false,
  },

  // Logging
  logging: {
    level: 'error',
    console: false,
    sentry: true,
    sentryDsn: 'https://prod-key@sentry.io/prod-project',
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
