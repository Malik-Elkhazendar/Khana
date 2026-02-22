import { environment } from '../../../environments/environment';

export type LandingLocale = 'en' | 'ar';

export type LandingSocialLinks = {
  x: string;
  linkedin: string;
  instagram: string;
};

export type LandingLegalLinks = {
  privacy: string;
  terms: string;
  cookies: string;
  security: string;
};

export type LandingSupportLinks = {
  helpCenter: string;
  contactSales: string;
  scheduleDemo: string;
  apiDocs: string;
  status: string;
};

export type LandingFooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type LandingFooterSection = {
  title: string;
  links: LandingFooterLink[];
};

export type LandingFooterLinksConfig = {
  socialLinks: LandingSocialLinks;
  legalLinks: LandingLegalLinks;
  footerSections: LandingFooterSection[];
};

type MarketingLinksConfig = {
  socialLinks: LandingSocialLinks;
  supportLinks: LandingSupportLinks;
  legalLinks: LandingLegalLinks;
};

function marketingLinks(): MarketingLinksConfig {
  return environment.marketing as MarketingLinksConfig;
}

function buildEnglishFooterSections(
  supportLinks: LandingSupportLinks,
  legalLinks: LandingLegalLinks
): LandingFooterSection[] {
  return [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'How It Works', href: '#how-it-works' },
        { label: 'Testimonials', href: '#testimonials' },
        { label: 'Start Free Trial', href: '#cta' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Khana', href: '#problem-solution' },
        { label: 'Create Account', href: '/register' },
        { label: 'Sign In', href: '/login' },
        { label: 'Contact Sales', href: supportLinks.contactSales },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help Center', href: supportLinks.helpCenter },
        { label: 'Book a Demo', href: supportLinks.scheduleDemo },
        { label: 'API Docs', href: supportLinks.apiDocs },
        { label: 'Platform Status', href: supportLinks.status },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: legalLinks.privacy },
        { label: 'Terms of Service', href: legalLinks.terms },
        { label: 'Cookie Policy', href: legalLinks.cookies },
        { label: 'Security & Compliance', href: legalLinks.security },
      ],
    },
  ];
}

function buildArabicFooterSections(
  supportLinks: LandingSupportLinks,
  legalLinks: LandingLegalLinks
): LandingFooterSection[] {
  return [
    {
      title: 'المنتج',
      links: [
        { label: 'الميزات', href: '/ar#features' },
        { label: 'كيف تعمل خانة', href: '/ar#how-it-works' },
        { label: 'آراء العملاء', href: '/ar#testimonials' },
        { label: 'ابدأ مجاناً', href: '/ar#cta' },
      ],
    },
    {
      title: 'الشركة',
      links: [
        { label: 'عن خانة', href: '/ar#problem-solution' },
        { label: 'إنشاء حساب', href: '/register' },
        { label: 'تسجيل الدخول', href: '/login' },
        { label: 'تواصل مع المبيعات', href: supportLinks.contactSales },
      ],
    },
    {
      title: 'الدعم',
      links: [
        { label: 'مركز المساعدة', href: supportLinks.helpCenter },
        { label: 'احجز عرضاً توضيحياً', href: supportLinks.scheduleDemo },
        { label: 'وثائق API', href: supportLinks.apiDocs },
        { label: 'حالة المنصة', href: supportLinks.status },
      ],
    },
    {
      title: 'القانوني',
      links: [
        { label: 'سياسة الخصوصية', href: legalLinks.privacy },
        { label: 'شروط الخدمة', href: legalLinks.terms },
        { label: 'سياسة ملفات الارتباط', href: legalLinks.cookies },
        { label: 'الأمان والامتثال', href: legalLinks.security },
      ],
    },
  ];
}

export function getLandingFooterLinks(
  locale: LandingLocale
): LandingFooterLinksConfig {
  const links = marketingLinks();
  return {
    socialLinks: links.socialLinks,
    legalLinks: links.legalLinks,
    footerSections:
      locale === 'ar'
        ? buildArabicFooterSections(links.supportLinks, links.legalLinks)
        : buildEnglishFooterSections(links.supportLinks, links.legalLinks),
  };
}
