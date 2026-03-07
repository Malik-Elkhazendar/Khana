import { LandingPageContent } from './landing-content.model';

export const LANDING_CONTENT_EN: LandingPageContent = {
  locale: 'en',
  direction: 'ltr',
  skipLinkLabel: 'Skip to main content',
  skipLinkAriaLabel: 'Skip to main content',
  header: {
    logoAriaLabel: 'Khana - Home',
    navAriaLabel: 'Primary navigation',
    mobileNavAriaLabel: 'Mobile navigation',
    mobileMenuToggleLabel: 'Toggle navigation menu',
    navItems: [
      { label: 'Features', sectionId: 'features' },
      { label: 'How It Works', sectionId: 'how-it-works' },
      { label: 'Testimonials', sectionId: 'testimonials' },
    ],
    loginLabel: 'Login',
    loginAriaLabel: 'Log in to your account',
    primaryActionLabel: 'Start Free Trial',
    primaryActionAriaLabel: 'Start your free trial',
  },
  hero: {
    badgeText: 'The Operating System for Booking-Based Businesses',
    headlineLines: [
      { text: 'Never Lose' },
      { text: 'a Booking', accent: true },
      { text: 'Again' },
    ],
    subheadlineLines: [
      'Real-time calendar. Zero double-bookings. Happy customers.',
      'The modern way to manage your sports facility or rental property.',
    ],
    stats: [
      { value: '10K+', label: 'Bookings Managed' },
      { value: '100+', label: 'Facilities' },
      { value: '99.9%', label: 'Uptime' },
    ],
    primaryActionLabel: 'Start Free Trial',
    primaryActionAriaLabel: 'Start your free trial - no credit card required',
    secondaryActionLabel: 'See Live Demo',
    secondaryActionAriaLabel: 'See how Khana works',
    trustItems: [
      'No credit card required',
      '14-day free trial',
      'Cancel anytime',
    ],
    bookingCard: {
      title: 'Booking Confirmed',
      subtitle: 'Court 3 • 6:00 PM',
    },
    revenueCard: {
      title: '+$2,450',
      subtitle: 'This Week',
    },
    calendarMonth: 'January 2026',
    calendarDays: [
      { date: '6', booked: false, today: false },
      { date: '7', booked: true, today: false },
      { date: '8', booked: true, today: false },
      { date: '9', booked: false, today: false },
      { date: '10', booked: true, today: false },
      { date: '11', booked: false, today: true },
      { date: '12', booked: true, today: false },
    ],
    scrollText: 'Scroll to explore',
  },
  problemSolution: {
    eyebrow: 'The Transformation',
    titlePrefix: 'From',
    titleChaos: 'Chaos',
    titleMiddle: 'to',
    titleControl: 'Control',
    subtitle:
      'See how facility managers across MENA are transforming their booking operations',
    oldWayTitle: 'The Old Way',
    oldWaySubtitle: 'WhatsApp & Paper',
    oldWayItems: [
      'Endless WhatsApp messages to check availability',
      'Paper calendars with crossed-out bookings',
      'Phone tag just to confirm a slot',
      'Double-bookings that embarrass your business',
      'No visibility into revenue or patterns',
    ],
    chaosMessages: [
      { time: '9:45 AM', text: 'Is Court 2 free tomorrow at 5?' },
      { time: '9:47 AM', text: 'Can I book Friday 6PM?' },
      { time: '9:52 AM', text: 'Still waiting for confirmation...' },
    ],
    newWayTitle: 'The Khana Way',
    newWaySubtitle: 'Real-Time Control',
    newWayItems: [
      'Instant availability visible to everyone',
      'Digital calendar synced across all devices',
      'Automatic confirmations in seconds',
      'Smart conflict detection prevents overlaps',
      'Complete analytics and revenue tracking',
    ],
    successTitle: 'Booking Confirmed',
    successDetail: 'Instantly, no waiting',
  },
  featuresGrid: {
    eyebrow: 'Powerful Features',
    titlePrefix: 'Everything You Need to',
    titleAccent: 'Run Your Business',
    subtitle:
      'From real-time availability to smart analytics, Khana gives you the tools to eliminate chaos and delight your customers.',
    learnMoreLabel: 'Learn more',
    features: [
      {
        id: 'realtime-calendar',
        icon: 'calendar',
        title: 'Real-Time Calendar',
        description:
          'No more "let me check and get back to you." Your calendar updates instantly across all devices, showing live availability.',
        gradient:
          'linear-gradient(135deg, var(--color-success) 0%, var(--marketing-success-deep) 100%)',
        image: 'assets/images/landing/feature_realtime_calendar.png?v=3',
      },
      {
        id: 'conflict-detection',
        icon: 'shield',
        title: 'Zero Double-Bookings',
        description:
          'Our smart system automatically detects and prevents overlapping bookings before they happen. Never disappoint a customer again.',
        gradient:
          'linear-gradient(135deg, var(--color-secondary) 0%, var(--marketing-secondary-deep) 100%)',
        image: 'assets/images/landing/feature_zero_double_bookings.png?v=3',
      },
      {
        id: 'mobile-first',
        icon: 'mobile',
        title: 'Mobile-First Design',
        description:
          'Check-in customers, view bookings, update availability—all from your mobile device. Manage your business from anywhere.',
        gradient:
          'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)',
        image: 'assets/images/landing/feature_mobile_first.png?v=3',
      },
      {
        id: 'customer-history',
        icon: 'users',
        title: 'Know Your Customers',
        description:
          'Track booking history, preferences, and payment status. Build lasting relationships, not just one-time transactions.',
        gradient:
          'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
        image: 'assets/images/landing/feature_know_your_customers.png?v=3',
      },
      {
        id: 'smart-pricing',
        icon: 'chart',
        title: 'Dynamic Pricing',
        description:
          'Set peak and off-peak rates, create promo codes, and maximize revenue during high-demand periods automatically.',
        gradient:
          'linear-gradient(135deg, var(--color-secondary-light) 0%, var(--color-secondary-dark) 100%)',
        image: 'assets/images/landing/feature_dynamic_pricing.png?v=3',
      },
      {
        id: 'security',
        icon: 'lock',
        title: 'Bank-Level Security',
        description:
          'GDPR-compliant data handling, role-based permissions, and complete audit trails. Your data is safe with us.',
        gradient:
          'linear-gradient(135deg, var(--color-primary) 0%, var(--marketing-primary-deep) 100%)',
        image: 'assets/images/landing/feature_bank_level_security.png?v=3',
      },
    ],
  },
  howItWorks: {
    eyebrow: 'Simple Setup',
    titlePrefix: 'Get Started in',
    titleAccent: 'Minutes, Not Days',
    subtitle:
      'No complex setup. No lengthy onboarding. Start managing bookings professionally in just four simple steps.',
    stepsAriaLabel: 'Setup steps',
    ctaText: 'Ready to transform your booking process?',
    ctaActionLabel: 'Get Started Free',
    ctaActionAriaLabel: 'Start your free trial',
    steps: [
      {
        number: 1,
        title: 'Sign Up in 2 Minutes',
        description:
          'Create your account and add your facilities, courts, or properties. No technical knowledge required.',
        icon: 'user-plus',
        image: 'assets/images/landing/how_it_works_signup.png?v=3',
      },
      {
        number: 2,
        title: 'Import Existing Bookings',
        description:
          "Easily migrate your existing bookings from WhatsApp, paper, or spreadsheets. We'll help you get started.",
        icon: 'upload',
        image: 'assets/images/landing/how_it_works_import.png?v=3',
      },
      {
        number: 3,
        title: 'Share Booking Link',
        description:
          'Get a unique booking URL that customers can use to book directly. Share it on WhatsApp, social media, or your website.',
        icon: 'share',
        image: 'assets/images/landing/how_it_works_share.png?v=3',
      },
      {
        number: 4,
        title: 'Manage Everything',
        description:
          "Track bookings, revenue, and customer data in one beautiful dashboard. You're now in control.",
        icon: 'zap',
        image: 'assets/images/landing/how_it_works_manage.png?v=3',
      },
    ],
  },
  socialProof: {
    eyebrow: 'Trusted by Leaders',
    titlePrefix: 'Loved by Facility Managers',
    titleAccent: 'Across MENA',
    subtitle:
      "Don't just take our word for it. See what our customers have to say about transforming their booking operations.",
    statsAriaLabel: 'Key statistics',
    prevAriaLabel: 'Previous testimonial',
    nextAriaLabel: 'Next testimonial',
    dotsAriaLabel: 'Testimonial navigation',
    trustBadgesAriaLabel: 'Trust indicators',
    trustBadges: ['Bank-Level Security', '99.9% Uptime', 'GDPR Compliant'],
    testimonials: [
      {
        id: '1',
        quote:
          "Khana reduced our booking errors by 95%. Our customers love the instant confirmations, and we've seen a 30% increase in repeat bookings.",
        author: 'Ahmed Al-Rashid',
        role: 'Operations Manager',
        company: 'Padel Club Dubai',
        rating: 5,
        avatarInitials: 'AR',
      },
      {
        id: '2',
        quote:
          "Before Khana, we spent 3 hours daily managing WhatsApp bookings. Now it's completely automated. I wish we had found this sooner!",
        author: 'Sara Al-Mahmoud',
        role: 'Owner',
        company: 'Desert Rose Chalets',
        rating: 5,
        avatarInitials: 'SM',
      },
      {
        id: '3',
        quote:
          'The real-time calendar is a game-changer. Our staff can focus on customer service instead of juggling phone calls and messages.',
        author: 'Mohammed Khalil',
        role: 'General Manager',
        company: 'Sports City Complex',
        rating: 5,
        avatarInitials: 'MK',
      },
      {
        id: '4',
        quote:
          'Finally, a system that understands our market. The Arabic support and RTL interface made adoption seamless for our entire team.',
        author: 'Fatima Al-Hassan',
        role: 'Director',
        company: 'Al-Noor Tennis Academy',
        rating: 5,
        avatarInitials: 'FH',
      },
      {
        id: '5',
        quote:
          'Revenue tracking was impossible before. Now I can see exactly which courts are most profitable and optimize pricing accordingly.',
        author: 'Khalid Ibrahim',
        role: 'Business Owner',
        company: 'Golden Gate Sports',
        rating: 5,
        avatarInitials: 'KI',
      },
    ],
    stats: [
      { value: '100', suffix: '+', label: 'Facilities' },
      { value: '10K', suffix: '+', label: 'Bookings Managed' },
      { value: '4.9', suffix: '/5', label: 'Average Rating' },
      { value: '99.9', suffix: '%', label: 'Uptime' },
    ],
  },
  bottomCta: {
    headlinePrefix: 'Ready to Eliminate',
    headlineAccent: 'Booking Chaos?',
    subheadline:
      'Join 100+ facilities across MENA who have transformed their booking operations. Start your free trial today and see the difference in minutes.',
    primaryActionLabel: 'Start Your Free Trial',
    primaryActionAriaLabel: 'Start your free trial',
    secondaryActions: [
      {
        id: 'demo',
        label: 'Schedule a Demo',
        ariaLabel: 'Schedule a demo with sales',
        subject: 'Schedule a Demo',
      },
      {
        id: 'sales',
        label: 'Contact Sales',
        ariaLabel: 'Contact sales team',
        subject: 'Contact Sales',
      },
    ],
    trustItems: [
      'No credit card required',
      '14-day free trial',
      'Cancel anytime',
    ],
    trustLineAriaLabel: 'Signup trust indicators',
  },
  footer: {
    homeAriaLabel: 'Khana - Home',
    tagline:
      'The Operating System for Local Booking-Based Businesses. Eliminate chaos. Delight customers.',
    socialLinksAriaLabel: 'Social media links',
    socialXAriaLabel: 'Follow us on Twitter',
    socialLinkedinAriaLabel: 'Follow us on LinkedIn',
    socialInstagramAriaLabel: 'Follow us on Instagram',
    footerSectionAriaPrefix: '',
    copyrightSuffix: 'Khana. All rights reserved.',
    privacyLabel: 'Privacy Policy',
    termsLabel: 'Terms of Service',
    cookiesLabel: 'Cookie Policy',
    languageSwitchLabel: 'العربية',
    languageSwitchAriaLabel: 'Switch to Arabic',
  },
};
