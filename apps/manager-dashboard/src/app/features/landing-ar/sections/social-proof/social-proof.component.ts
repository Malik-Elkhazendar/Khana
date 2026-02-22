import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  rating: number;
  avatarInitials: string;
}

interface Stat {
  value: string;
  label: string;
  suffix?: string;
}

@Component({
  selector: 'app-social-proof-ar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-proof.component.html',
  styleUrl: './social-proof.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialProofArComponent {
  readonly currentIndex = signal(0);

  readonly testimonials: Testimonial[] = [
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
  ];

  readonly stats: Stat[] = [
    { value: '100', suffix: '+', label: 'منشأة' },
    { value: '10K', suffix: '+', label: 'حجوزات' },
    { value: '4.9', suffix: '/5', label: 'التقييم' },
    { value: '99.9', suffix: '%', label: 'التوافر' },
  ];

  readonly visibleCount = signal(
    typeof window !== 'undefined' && window.innerWidth >= 1024
      ? 3
      : typeof window !== 'undefined' && window.innerWidth >= 768
      ? 2
      : 1
  );

  readonly maxIndex = computed(
    () => this.testimonials.length - this.visibleCount()
  );

  readonly trackIndex = computed(() => this.maxIndex() - this.currentIndex());

  readonly dotsArray = computed(() =>
    Array.from({ length: this.maxIndex() + 1 })
  );

  nextSlide(): void {
    if (this.currentIndex() < this.maxIndex()) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  prevSlide(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  goToSlide(index: number): void {
    this.currentIndex.set(index);
  }
}
