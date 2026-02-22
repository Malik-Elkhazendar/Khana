/**
 * Staging Environment Configuration
 * Used by: ng build --configuration staging
 * API: https://api.staging.khana.app
 */
export const environment = {
  production: false,
  apiBaseUrl: 'https://api.staging.khana.app',
  apiVersion: 'v1',

  // Authentication
  auth: {
    tokenKey: 'khana_token',
    refreshTokenKey: 'khana_refresh_token',
    tenantId: '',
  },

  // Feature flags (test all features in staging)
  features: {
    paymentGateway: true,
    customerApp: false,
    analytics: true,
    debugMode: true,
  },

  // Logging
  logging: {
    level: 'info',
    console: true,
    sentry: true,
    sentryDsn: 'https://staging-key@sentry.io/staging-project',
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
    socialLinks: {
      x: '',
      linkedin: '',
      instagram: '',
    },
    supportLinks: {
      helpCenter:
        'mailto:sales@khana.com?subject=Help%20Center%20Request%20%7C%20Khana',
      contactSales:
        'mailto:sales@khana.com?subject=Contact%20Sales%20%7C%20Khana',
      scheduleDemo:
        'mailto:sales@khana.com?subject=Schedule%20a%20Demo%20%7C%20Khana',
      apiDocs:
        'mailto:sales@khana.com?subject=API%20Documentation%20Request%20%7C%20Khana',
      status:
        'mailto:sales@khana.com?subject=Status%20Page%20Request%20%7C%20Khana',
    },
    legalLinks: {
      privacy:
        'mailto:sales@khana.com?subject=Privacy%20Policy%20Request%20%7C%20Khana',
      terms:
        'mailto:sales@khana.com?subject=Terms%20of%20Service%20Request%20%7C%20Khana',
      cookies:
        'mailto:sales@khana.com?subject=Cookie%20Policy%20Request%20%7C%20Khana',
      security:
        'mailto:sales@khana.com?subject=Security%20and%20Compliance%20Request%20%7C%20Khana',
    },
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
