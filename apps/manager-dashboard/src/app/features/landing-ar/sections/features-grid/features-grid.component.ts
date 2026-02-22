import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  gradient: string;
  image: string;
}

@Component({
  selector: 'app-features-grid-ar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './features-grid.component.html',
  styleUrl: './features-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesGridArComponent implements AfterViewInit, OnDestroy {
  @ViewChild('grid') grid!: ElementRef<HTMLElement>;

  private observer: IntersectionObserver | undefined;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly el = inject(ElementRef);
  readonly learnMoreHref = '/ar#how-it-works';

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.setupObserver();
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    if (this.grid) {
      this.observer.observe(this.grid.nativeElement);
    }
  }

  readonly features: Feature[] = [
    {
      id: 'realtime-calendar',
      icon: 'calendar',
      title: 'التقويم في الوقت الفعلي',
      description:
        'وداعاً لعبارة "دعني أتحقق وأعود إليك". يتم تحديث التقويم فورياً عبر جميع الأجهزة مع توافر مباشر.',
      gradient: 'linear-gradient(135deg, #2d7d6f 0%, #1f6357 100%)',
      image: 'assets/images/landing/feature_realtime_calendar.png?v=3',
    },
    {
      id: 'conflict-detection',
      icon: 'shield',
      title: 'عدم وجود حجوزات مزدوجة',
      description:
        'نظامنا الذكي يرصد التعارضات ويمنع الحجوزات المتداخلة قبل حدوثها. لا إحراج مع العملاء بعد اليوم.',
      gradient: 'linear-gradient(135deg, #c75d4a 0%, #a84a39 100%)',
      image: 'assets/images/landing/feature_zero_double_bookings.png?v=3',
    },
    {
      id: 'mobile-first',
      icon: 'mobile',
      title: 'تصميم موجه للهاتف المحمول',
      description:
        'استقبل العملاء، اعرض الحجوزات، وحدّث التوافر من هاتفك. أدر أعمالك من أي مكان.',
      gradient: 'linear-gradient(135deg, #d4a855 0%, #b8923f 100%)',
      image: 'assets/images/landing/feature_mobile_first.png?v=3',
    },
    {
      id: 'customer-history',
      icon: 'users',
      title: 'اعرف عملاءك',
      description:
        'تتبّع سجل الحجوزات والتفضيلات وحالة الدفع. ابنِ علاقات طويلة الأمد مع العملاء.',
      gradient: 'linear-gradient(135deg, #5b8def 0%, #4a7bdc 100%)',
      image: 'assets/images/landing/feature_know_your_customers.png?v=3',
    },
    {
      id: 'smart-pricing',
      icon: 'chart',
      title: 'تسعير ديناميكي',
      description:
        'حدد أسعار الذروة وخارج الذروة، وأنشئ عروضاً ترويجية، وزد الإيرادات تلقائياً وقت الطلب العالي.',
      gradient: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
      image: 'assets/images/landing/feature_dynamic_pricing.png?v=3',
    },
    {
      id: 'security',
      icon: 'lock',
      title: 'أمان على مستوى البنوك',
      description:
        'إدارة بيانات متوافقة مع GDPR، وصلاحيات حسب الأدوار، وسجل تدقيق كامل. بياناتك آمنة معنا.',
      gradient: 'linear-gradient(135deg, #1e2a3a 0%, #2d3f54 100%)',
      image: 'assets/images/landing/feature_bank_level_security.png?v=3',
    },
  ];
}
