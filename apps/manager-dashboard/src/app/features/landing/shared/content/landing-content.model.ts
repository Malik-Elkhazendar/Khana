import { LandingLocale } from '../../../../shared/navigation/landing-links';

export type LandingDirection = 'ltr' | 'rtl';
export type LandingLanguage = LandingLocale;

export type LandingNavItem = {
  label: string;
  sectionId: string;
};

export type LandingStat = {
  value: string;
  label: string;
  suffix?: string;
};

export type LandingCalendarDay = {
  date: string;
  booked: boolean;
  today: boolean;
};

export type LandingFeatureIcon =
  | 'calendar'
  | 'shield'
  | 'mobile'
  | 'users'
  | 'chart'
  | 'lock';

export type LandingFeature = {
  id: string;
  icon: LandingFeatureIcon;
  title: string;
  description: string;
  gradient: string;
  image: string;
};

export type LandingHowItWorksIcon = 'user-plus' | 'upload' | 'share' | 'zap';

export type LandingStep = {
  number: number;
  title: string;
  description: string;
  icon: LandingHowItWorksIcon;
  image: string;
};

export type LandingTestimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  rating: number;
  avatarInitials: string;
};

export type FloatingCardContent = {
  title: string;
  subtitle: string;
};

export type LandingHeaderContent = {
  logoAriaLabel: string;
  navAriaLabel: string;
  mobileNavAriaLabel: string;
  mobileMenuToggleLabel: string;
  navItems: LandingNavItem[];
  loginLabel: string;
  loginAriaLabel: string;
  primaryActionLabel: string;
  primaryActionAriaLabel: string;
};

export type LandingHeroContent = {
  badgeText: string;
  headlineLines: Array<{ text: string; accent?: boolean }>;
  subheadlineLines: string[];
  stats: LandingStat[];
  primaryActionLabel: string;
  primaryActionAriaLabel: string;
  secondaryActionLabel: string;
  secondaryActionAriaLabel: string;
  trustItems: string[];
  bookingCard: FloatingCardContent;
  revenueCard: FloatingCardContent;
  calendarMonth: string;
  calendarDays: LandingCalendarDay[];
  scrollText: string;
};

export type LandingProblemSolutionContent = {
  eyebrow: string;
  titlePrefix: string;
  titleChaos: string;
  titleMiddle: string;
  titleControl: string;
  subtitle: string;
  oldWayTitle: string;
  oldWaySubtitle: string;
  oldWayItems: string[];
  chaosMessages: Array<{ time: string; text: string }>;
  newWayTitle: string;
  newWaySubtitle: string;
  newWayItems: string[];
  successTitle: string;
  successDetail: string;
};

export type LandingFeaturesGridContent = {
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  learnMoreLabel: string;
  features: LandingFeature[];
};

export type LandingHowItWorksContent = {
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  stepsAriaLabel: string;
  ctaText: string;
  ctaActionLabel: string;
  ctaActionAriaLabel: string;
  steps: LandingStep[];
};

export type LandingSocialProofContent = {
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  statsAriaLabel: string;
  prevAriaLabel: string;
  nextAriaLabel: string;
  dotsAriaLabel: string;
  trustBadgesAriaLabel: string;
  trustBadges: string[];
  testimonials: LandingTestimonial[];
  stats: LandingStat[];
};

export type LandingBottomCtaContent = {
  headlinePrefix: string;
  headlineAccent: string;
  subheadline: string;
  primaryActionLabel: string;
  primaryActionAriaLabel: string;
  secondaryActions: Array<{
    id: string;
    label: string;
    ariaLabel: string;
    subject: string;
  }>;
  trustItems: string[];
  trustLineAriaLabel: string;
};

export type LandingFooterContent = {
  homeAriaLabel: string;
  tagline: string;
  socialLinksAriaLabel: string;
  socialXAriaLabel: string;
  socialLinkedinAriaLabel: string;
  socialInstagramAriaLabel: string;
  footerSectionAriaPrefix: string;
  copyrightSuffix: string;
  privacyLabel: string;
  termsLabel: string;
  cookiesLabel: string;
  languageSwitchLabel: string;
  languageSwitchAriaLabel: string;
};

export type LandingPageContent = {
  locale: LandingLanguage;
  direction: LandingDirection;
  skipLinkLabel: string;
  skipLinkAriaLabel: string;
  header: LandingHeaderContent;
  hero: LandingHeroContent;
  problemSolution: LandingProblemSolutionContent;
  featuresGrid: LandingFeaturesGridContent;
  howItWorks: LandingHowItWorksContent;
  socialProof: LandingSocialProofContent;
  bottomCta: LandingBottomCtaContent;
  footer: LandingFooterContent;
};
