import { LandingPageContent } from './landing-content.model';

export const LANDING_CONTENT_AR: LandingPageContent = {
  locale: 'ar',
  direction: 'rtl',
  skipLinkLabel: 'انتقل إلى المحتوى الرئيسي',
  skipLinkAriaLabel: 'انتقل إلى المحتوى الرئيسي',
  header: {
    logoAriaLabel: 'خانة - الصفحة الرئيسية',
    navAriaLabel: 'التنقل الرئيسي',
    mobileNavAriaLabel: 'تنقل الهاتف المحمول',
    mobileMenuToggleLabel: 'تبديل قائمة التنقل',
    navItems: [
      { label: 'الميزات', sectionId: 'features' },
      { label: 'كيف تعمل', sectionId: 'how-it-works' },
      { label: 'آراء العملاء', sectionId: 'testimonials' },
    ],
    loginLabel: 'تسجيل الدخول',
    loginAriaLabel: 'تسجيل الدخول إلى حسابك',
    primaryActionLabel: 'ابدأ محاولتك المجانية',
    primaryActionAriaLabel: 'ابدأ محاولتك المجانية',
  },
  hero: {
    badgeText: 'نظام التشغيل لعمليات الحجز المبنية على الطلب',
    headlineLines: [{ text: 'لا تخسر حجز' }, { text: 'أبداً', accent: true }],
    subheadlineLines: [
      'تقويم في الوقت الحقيقي. بدون حجوزات مزدوجة. عملاء سعداء.',
      'الطريقة الحديثة لإدارة منشأتك الرياضية أو عقارك للإيجار.',
    ],
    stats: [
      { value: '١٠٠٠٠+', label: 'حجوزات مُدارة' },
      { value: '١٠٠+', label: 'منشأة' },
      { value: '٩٩٫٩٪', label: 'التوافر' },
    ],
    primaryActionLabel: 'ابدأ محاولتك المجانية',
    primaryActionAriaLabel: 'ابدأ محاولتك المجانية - بدون بطاقة ائتمان مطلوبة',
    secondaryActionLabel: 'شاهد العرض التوضيحي',
    secondaryActionAriaLabel: 'شاهد كيف تعمل خانة',
    trustItems: [
      'بدون بطاقة ائتمان مطلوبة',
      'تجربة مجانية لمدة 14 يوماً',
      'يمكنك الإلغاء في أي وقت',
    ],
    bookingCard: {
      title: 'تم تأكيد الحجز',
      subtitle: 'الملعب ٣ • ٦:٠٠ م',
    },
    revenueCard: {
      title: '+٢٬٤٥٠$',
      subtitle: 'هذا الأسبوع',
    },
    calendarMonth: 'يناير ٢٠٢٦',
    calendarDays: [
      { date: '٦', booked: false, today: false },
      { date: '٧', booked: true, today: false },
      { date: '٨', booked: true, today: false },
      { date: '٩', booked: false, today: false },
      { date: '١٠', booked: true, today: false },
      { date: '١١', booked: false, today: true },
      { date: '١٢', booked: true, today: false },
    ],
    scrollText: 'مرر للاستكشاف',
  },
  problemSolution: {
    eyebrow: 'التحول',
    titlePrefix: 'من',
    titleChaos: 'الفوضى',
    titleMiddle: 'إلى',
    titleControl: 'التحكم',
    subtitle:
      'شاهد كيف يحوّل مديرو المنشآت عبر الشرق الأوسط وشمال أفريقيا عمليات الحجز لديهم',
    oldWayTitle: 'الطريقة القديمة',
    oldWaySubtitle: 'واتساب والورق',
    oldWayItems: [
      'رسائل واتساب لا تنتهي للتحقق من التوافر',
      'تقويمات ورقية مليئة بالشطب',
      'اتصالات متكررة فقط للتأكيد',
      'حجوزات مزدوجة تُحرج نشاطك',
      'الرسائل القديمة مليئة بالارتباك ولا تعطي رؤية للإيرادات',
    ],
    chaosMessages: [
      { time: '٩:٤٥ ص', text: 'هل الملعب ٢ فاضي بكرة الساعة ٥؟' },
      { time: '٩:٤٧ ص', text: 'ممكن أحجز الجمعة ٦ مساءً؟' },
      { time: '٩:٥٢ ص', text: 'ما زلت أنتظر التأكيد...' },
    ],
    newWayTitle: 'طريقة خانة',
    newWaySubtitle: 'تحكم في الوقت الحقيقي',
    newWayItems: [
      'توافر فوري واضح للجميع',
      'تقويم رقمي متزامن عبر كل الأجهزة',
      'تأكيد فوري بدون انتظار',
      'كشف ذكي للتعارض يمنع التداخل',
      'تحليلات كاملة وتتبع للإيرادات',
    ],
    successTitle: 'تم تأكيد الحجز',
    successDetail: 'فوراً بدون انتظار',
  },
  featuresGrid: {
    eyebrow: 'ميزات قوية',
    titlePrefix: 'كل ما تحتاجه لـ',
    titleAccent: 'تشغيل أعمالك',
    subtitle:
      'من التوافر الفوري إلى التحليلات الذكية، تمنحك خانة الأدوات للقضاء على الفوضى وإسعاد عملائك.',
    learnMoreLabel: 'اعرف المزيد',
    features: [
      {
        id: 'realtime-calendar',
        icon: 'calendar',
        title: 'التقويم في الوقت الفعلي',
        description:
          'وداعاً لعبارة "دعني أتحقق وأعود إليك". يتم تحديث التقويم فورياً عبر جميع الأجهزة مع توافر مباشر.',
        gradient:
          'linear-gradient(135deg, var(--color-success) 0%, var(--marketing-success-deep) 100%)',
        image: 'assets/images/landing/feature_realtime_calendar.png?v=3',
      },
      {
        id: 'conflict-detection',
        icon: 'shield',
        title: 'عدم وجود حجوزات مزدوجة',
        description:
          'نظامنا الذكي يرصد التعارضات ويمنع الحجوزات المتداخلة قبل حدوثها. لا إحراج مع العملاء بعد اليوم.',
        gradient:
          'linear-gradient(135deg, var(--color-secondary) 0%, var(--marketing-secondary-deep) 100%)',
        image: 'assets/images/landing/feature_zero_double_bookings.png?v=3',
      },
      {
        id: 'mobile-first',
        icon: 'mobile',
        title: 'تصميم موجه للهاتف المحمول',
        description:
          'استقبل العملاء، اعرض الحجوزات، وحدّث التوافر من هاتفك. أدر أعمالك من أي مكان.',
        gradient:
          'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)',
        image: 'assets/images/landing/feature_mobile_first.png?v=3',
      },
      {
        id: 'customer-history',
        icon: 'users',
        title: 'اعرف عملاءك',
        description:
          'تتبّع سجل الحجوزات والتفضيلات وحالة الدفع. ابنِ علاقات طويلة الأمد مع العملاء.',
        gradient:
          'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
        image: 'assets/images/landing/feature_know_your_customers.png?v=3',
      },
      {
        id: 'smart-pricing',
        icon: 'chart',
        title: 'تسعير ديناميكي',
        description:
          'حدد أسعار الذروة وخارج الذروة، وأنشئ عروضاً ترويجية، وزد الإيرادات تلقائياً وقت الطلب العالي.',
        gradient:
          'linear-gradient(135deg, var(--color-secondary-light) 0%, var(--color-secondary-dark) 100%)',
        image: 'assets/images/landing/feature_dynamic_pricing.png?v=3',
      },
      {
        id: 'security',
        icon: 'lock',
        title: 'أمان على مستوى البنوك',
        description:
          'إدارة بيانات متوافقة مع GDPR، وصلاحيات حسب الأدوار، وسجل تدقيق كامل. بياناتك آمنة معنا.',
        gradient:
          'linear-gradient(135deg, var(--color-primary) 0%, var(--marketing-primary-deep) 100%)',
        image: 'assets/images/landing/feature_bank_level_security.png?v=3',
      },
    ],
  },
  howItWorks: {
    eyebrow: 'إعداد بسيط',
    titlePrefix: 'ابدأ في',
    titleAccent: 'دقائق، لا أيام',
    subtitle:
      'لا إعداد معقد ولا تجربة تشغيل طويلة. ابدأ إدارة الحجوزات باحتراف في أربع خطوات بسيطة.',
    stepsAriaLabel: 'خطوات الإعداد',
    ctaText: 'هل أنت جاهز لتحويل عملية الحجز؟',
    ctaActionLabel: 'ابدأ مجاناً',
    ctaActionAriaLabel: 'ابدأ مجاناً',
    steps: [
      {
        number: 1,
        title: 'التسجيل في دقيقتين',
        description:
          'أنشئ حسابك وأضف منشآتك أو ملاعبك أو عقاراتك. لا حاجة لخبرة تقنية.',
        icon: 'user-plus',
        image: 'assets/images/landing/how_it_works_signup.png?v=3',
      },
      {
        number: 2,
        title: 'استيراد الحجوزات الموجودة',
        description:
          'انقل حجوزاتك الحالية بسهولة من واتساب أو الورق أو الجداول. سنساعدك على البدء.',
        icon: 'upload',
        image: 'assets/images/landing/how_it_works_import.png?v=3',
      },
      {
        number: 3,
        title: 'شارك رابط الحجز',
        description:
          'احصل على رابط حجز مخصص يمكن للعملاء استخدامه للحجز مباشرة. شاركه على واتساب أو وسائل التواصل أو موقعك.',
        icon: 'share',
        image: 'assets/images/landing/how_it_works_share.png?v=3',
      },
      {
        number: 4,
        title: 'أدر كل شيء',
        description:
          'تابع الحجوزات والإيرادات وبيانات العملاء في لوحة واحدة أنيقة. الآن أنت المتحكم.',
        icon: 'zap',
        image: 'assets/images/landing/how_it_works_manage.png?v=3',
      },
    ],
  },
  socialProof: {
    eyebrow: 'الثقة',
    titlePrefix: 'موثوق من قبل',
    titleAccent: 'القادة',
    subtitle: 'يحبها مديرو الحجوزات عبر الشرق الأوسط وشمال أفريقيا',
    statsAriaLabel: 'الإحصاءات الرئيسية',
    prevAriaLabel: 'الشهادة السابقة',
    nextAriaLabel: 'الشهادة التالية',
    dotsAriaLabel: 'تنقل الشهادات',
    trustBadgesAriaLabel: 'شارات الثقة',
    trustBadges: ['أمان على مستوى البنوك', '99.9% توافر', 'متوافق مع GDPR'],
    testimonials: [
      {
        id: '1',
        quote:
          'خفضت خانة أخطاء الحجز لدينا بنسبة ٩٥٪. أحب عملاؤنا التأكيد الفوري، وشاهدنا زيادة واضحة في الحجوزات المتكررة.',
        author: 'أحمد الراشد',
        role: 'مدير العمليات',
        company: 'نادي الإسكواش دبي',
        rating: 5,
        avatarInitials: 'AR',
      },
      {
        id: '2',
        quote:
          'قبل خانة كنا نقضي ٣ ساعات يومياً في إدارة حجوزات واتساب. الآن كل شيء مؤتمت بالكامل. تمنيت لو عرفناها أبكر!',
        author: 'سارة المحمود',
        role: 'المالك',
        company: 'فيلات الوردة البرية',
        rating: 5,
        avatarInitials: 'SM',
      },
      {
        id: '3',
        quote:
          'التقويم في الوقت الحقيقي غيّر العمل. أصبح الفريق يركز على خدمة العملاء بدلاً من مكالمات ورسائل لا تنتهي.',
        author: 'مازن الكتبي',
        role: 'المدير العام',
        company: 'مجمع المدينة الرياضية',
        rating: 5,
        avatarInitials: 'MK',
      },
      {
        id: '4',
        quote:
          'أخيراً نظام يفهم سوقنا. الدعم العربي وواجهة من اليمين لليسار جعلا اعتماد المنصة سلساً لفريقنا بالكامل.',
        author: 'فاطمة الحسن',
        role: 'مديرة الأكاديمية',
        company: 'أكاديمية النور للتنس',
        rating: 5,
        avatarInitials: 'FH',
      },
      {
        id: '5',
        quote:
          'تتبع الإيرادات لم يكن ممكناً من قبل. الآن أعرف أي الملاعب أكثر ربحية وأضبط الأسعار بذكاء.',
        author: 'خالد إبراهيم',
        role: 'مالك النشاط',
        company: 'نادي البادل الرياض',
        rating: 5,
        avatarInitials: 'KI',
      },
    ],
    stats: [
      { value: '100', suffix: '+', label: 'منشأة' },
      { value: '10K', suffix: '+', label: 'حجوزات' },
      { value: '4.9', suffix: '/5', label: 'التقييم' },
      { value: '99.9', suffix: '%', label: 'التوافر' },
    ],
  },
  bottomCta: {
    headlinePrefix: 'هل أنت جاهز للقضاء على',
    headlineAccent: 'فوضى الحجز؟',
    subheadline:
      'انضم إلى أكثر من 100 منشأة عبر الشرق الأوسط وشمال أفريقيا حوّلت عمليات الحجز لديها. ابدأ محاولتك المجانية اليوم وشاهد الفرق خلال دقائق.',
    primaryActionLabel: 'ابدأ محاولتك المجانية',
    primaryActionAriaLabel: 'ابدأ محاولتك المجانية',
    secondaryActions: [
      {
        id: 'demo',
        label: 'احجز عرضاً توضيحياً',
        ariaLabel: 'احجز عرضاً توضيحياً مع فريق المبيعات',
        subject: 'طلب عرض توضيحي',
      },
      {
        id: 'sales',
        label: 'تواصل مع المبيعات',
        ariaLabel: 'تواصل مع فريق المبيعات',
        subject: 'التواصل مع المبيعات',
      },
    ],
    trustItems: [
      'بدون بطاقة ائتمان مطلوبة',
      'تجربة مجانية لمدة 14 يوماً',
      'يمكنك الإلغاء في أي وقت',
    ],
    trustLineAriaLabel: 'مؤشرات الثقة للتسجيل',
  },
  footer: {
    homeAriaLabel: 'خانة - الصفحة الرئيسية',
    tagline:
      'نظام التشغيل لعمليات الحجز المحلية. اقضِ على الفوضى. اسعد بالعملاء.',
    socialLinksAriaLabel: 'روابط وسائل التواصل',
    socialXAriaLabel: 'تابعنا على تويتر/إكس',
    socialLinkedinAriaLabel: 'تابعنا على لينكدإن',
    socialInstagramAriaLabel: 'تابعنا على إنستغرام',
    footerSectionAriaPrefix: 'تنقل ',
    copyrightSuffix: 'خانة. جميع الحقوق محفوظة.',
    privacyLabel: 'سياسة الخصوصية',
    termsLabel: 'شروط الخدمة',
    cookiesLabel: 'سياسة ملفات الارتباط',
    languageSwitchLabel: 'English',
    languageSwitchAriaLabel: 'التبديل إلى الإنجليزية',
  },
};
