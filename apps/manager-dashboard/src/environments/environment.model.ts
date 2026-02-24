export type ClientLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggingConfig {
  level: ClientLogLevel;
  console: boolean;
  sentry: boolean;
  sentryDsn?: string;
}

export interface AuthConfig {
  tokenKey: string;
  refreshTokenKey: string;
  tenantId: string;
}

export interface FeatureConfig {
  paymentGateway: boolean;
  customerApp: boolean;
  analytics: boolean;
  debugMode: boolean;
}

export interface UiConfig {
  theme: string;
  language: string;
  rtl: boolean;
}

export interface MarketingLinks {
  helpCenter: string;
  contactSales: string;
  scheduleDemo: string;
  apiDocs: string;
  status: string;
}

export interface LegalLinks {
  privacy: string;
  terms: string;
  cookies: string;
  security: string;
}

export interface MarketingConfig {
  salesEmail: string;
  socialLinks: {
    x: string;
    linkedin: string;
    instagram: string;
  };
  supportLinks: MarketingLinks;
  legalLinks: LegalLinks;
}

export interface TimeoutConfig {
  http: number;
  tokenRefresh: number;
  sessionWarning: number;
}

export interface EndpointConfig {
  auth: {
    register: string;
    login: string;
    logout: string;
    refresh: string;
    me: string;
    changePassword: string;
    forgotPassword: string;
    resetPassword: string;
  };
  bookings: {
    list: string;
    create: string;
    preview: string;
    updateStatus: string;
    facilities: string;
  };
}

export interface EnvironmentConfig {
  production: boolean;
  apiBaseUrl: string;
  apiVersion: string;
  auth: AuthConfig;
  features: FeatureConfig;
  logging: LoggingConfig;
  ui: UiConfig;
  marketing: MarketingConfig;
  timeouts: TimeoutConfig;
  endpoints: EndpointConfig;
}
