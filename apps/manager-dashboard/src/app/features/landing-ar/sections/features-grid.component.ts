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
  template: `
    <div class="section-container">
      <!-- Background Pattern -->
      <div class="bg-pattern" aria-hidden="true">
        <div class="pattern-star pattern-1"></div>
        <div class="pattern-star pattern-2"></div>
        <div class="pattern-star pattern-3"></div>
      </div>

      <!-- Section Header -->
      <header class="section-header">
        <span class="section-eyebrow">ميزات قوية</span>
        <h2 class="section-title">
          كل ما تحتاجه لـ
          <span class="text-gradient">تشغيل أعمالك</span>
        </h2>
        <p class="section-subtitle">
          من التوافر الفوري إلى التحليلات الذكية، تمنحك خانة الأدوات للقضاء على
          الفوضى وإسعاد عملائك.
        </p>
      </header>

      <!-- Features Grid -->
      <div class="features-grid stagger-children" #grid>
        @for (feature of features; track feature.id) {
        <article
          class="feature-card stagger-item"
          [attr.data-feature]="feature.id"
        >
          <!-- Card Glow Effect -->
          <div
            class="card-glow"
            [style.background]="feature.gradient"
            aria-hidden="true"
          ></div>

          <!-- Card Content -->
          <div class="card-content">
            <!-- Icon -->
            <div
              class="feature-icon"
              [style.background]="feature.gradient"
              aria-hidden="true"
            >
              @switch (feature.icon) { @case ('calendar') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <circle cx="12" cy="16" r="2" />
              </svg>
              } @case ('shield') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              } @case ('mobile') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" />
              </svg>
              } @case ('users') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              } @case ('chart') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
              } @case ('lock') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
                <circle cx="12" cy="16" r="1" />
              </svg>
              } }
            </div>

            <!-- Text -->
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-description">{{ feature.description }}</p>

            <!-- Learn More Link -->
            <a
              href="#"
              class="feature-link"
              [attr.aria-label]="'اعرف المزيد عن ' + feature.title"
            >
              <span>اعرف المزيد</span>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </a>
          </div>

          <!-- Abstract Feature Visual -->
          <div class="feature-visual-wrapper">
            @switch (feature.icon) { @case ('calendar') {
            <div class="abstract-visual calendar-visual">
              <div class="v-grid">
                <div class="v-cell"></div>
                <div class="v-cell active pulse"></div>
                <div class="v-cell active"></div>
                <div class="v-cell active"></div>
                <div class="v-cell"></div>
                <div class="v-cell active"></div>
              </div>
            </div>
            } @case ('shield') {
            <div class="abstract-visual shield-visual">
              <div class="v-shield-bg"></div>
              <div class="v-shield-line" style="width: 80%"></div>
              <div class="v-shield-line" style="width: 60%"></div>
              <div class="v-shield-line error" style="width: 90%"></div>
              <div class="v-shield-overlay"></div>
            </div>
            } @case ('mobile') {
            <div class="abstract-visual mobile-visual">
              <div class="v-phone">
                <div class="v-phone-header"></div>
                <div class="v-phone-card"></div>
                <div class="v-phone-card"></div>
              </div>
            </div>
            } @case ('users') {
            <div class="abstract-visual users-visual">
              <div class="v-user-node main"></div>
              <div class="v-user-node child-1"></div>
              <div class="v-user-node child-2"></div>
              <div class="v-user-line line-1"></div>
              <div class="v-user-line line-2"></div>
            </div>
            } @case ('chart') {
            <div class="abstract-visual chart-visual">
              <div class="v-bar h-30"></div>
              <div class="v-bar h-50"></div>
              <div class="v-bar h-80 accent"></div>
              <div class="v-bar h-40"></div>
              <div class="v-bar h-60"></div>
            </div>
            } @case ('lock') {
            <div class="abstract-visual lock-visual">
              <div class="v-lock-circle"></div>
              <div class="v-data-stream"></div>
              <div class="v-data-stream delay"></div>
            </div>
            } }
          </div>
        </article>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .section-container {
        position: relative;
        padding: var(--space-16) var(--space-4);
        max-width: 80rem;
        margin: 0 auto;
        overflow: hidden;

        @media (min-width: 64rem) {
          padding: calc(var(--space-16) * 1.5) var(--space-8);
        }
      }

      // ============================================
      // Background Pattern
      // ============================================
      .bg-pattern {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }

      .pattern-star {
        position: absolute;
        width: 300px;
        height: 300px;
        opacity: 0.03;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z' fill='%231e2a3a'/%3E%3C/svg%3E");
        background-size: 40px 40px;

        &.pattern-1 {
          inset-block-start: -100px;
          inset-inline-end: -100px;
          transform: rotate(15deg);
        }

        &.pattern-2 {
          inset-block-end: 20%;
          inset-inline-start: -150px;
          transform: rotate(-10deg);
        }

        &.pattern-3 {
          inset-block-end: -50px;
          inset-inline-end: 10%;
          transform: rotate(25deg);
          width: 200px;
          height: 200px;
        }
      }

      // ============================================
      // Section Header
      // ============================================
      .section-header {
        position: relative;
        text-align: center;
        margin-block-end: var(--space-12);
        z-index: 1;

        @media (min-width: 64rem) {
          margin-block-end: calc(var(--space-12) * 1.25);
        }
      }

      .section-eyebrow {
        display: inline-block;
        padding: var(--space-2) var(--space-4);
        background: rgba(212, 168, 85, 0.1);
        border-radius: var(--radius-full);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-accent-dark);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-block-end: var(--space-4);
      }

      .section-title {
        font-family: var(--font-display);
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
        margin-block-end: var(--space-4);
      }

      .text-gradient {
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .section-subtitle {
        font-size: var(--text-lg);
        color: var(--color-text-secondary);
        max-width: 600px;
        margin-inline: auto;
        line-height: 1.7;
      }

      // ============================================
      // Features Grid
      // ============================================
      .features-grid {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-6);
        z-index: 1;

        @media (min-width: 48rem) {
          grid-template-columns: repeat(2, 1fr);
        }

        @media (min-width: 64rem) {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      // ============================================
      // Feature Card
      // ============================================
      .feature-card {
        position: relative;
        display: flex;
        flex-direction: column;
        padding: var(--space-6);
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: var(--radius-xl);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 4px 24px rgba(30, 42, 58, 0.06),
          0 1px 2px rgba(30, 42, 58, 0.04);
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;

        &:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(30, 42, 58, 0.12),
            0 8px 24px rgba(30, 42, 58, 0.08);

          .card-glow {
            opacity: 0.1;
            transform: scale(1.2);
          }

          .feature-icon {
            transform: scale(1.1) rotate(5deg);
          }

          .feature-link svg {
            transform: scaleX(-1) translateX(4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          transition: none;

          &:hover {
            transform: none;
          }
        }
      }

      // ============================================
      // Card Glow
      // ============================================
      .card-glow {
        position: absolute;
        inset-block-start: -50%;
        inset-inline-end: -50%;
        width: 150%;
        height: 150%;
        opacity: 0;
        filter: blur(60px);
        transition: all 0.5s ease;
        pointer-events: none;
      }

      // ============================================
      // Card Content
      // ============================================
      .card-content {
        position: relative;
        z-index: 1;
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .feature-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: var(--radius-lg);
        color: white;
        margin-block-end: var(--space-5);
        transition: transform 0.3s ease;

        svg {
          width: 28px;
          height: 28px;
        }
      }

      .feature-title {
        font-family: var(--font-display);
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
        margin-block-end: var(--space-3);
      }

      .feature-description {
        font-size: var(--text-base);
        color: var(--color-text-secondary);
        line-height: 1.6;
        flex: 1;
        margin-block-end: var(--space-5);
      }

      .feature-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-accent-dark);
        text-decoration: none;
        transition: color var(--transition-fast);

        svg {
          width: 16px;
          height: 16px;
          transition: transform var(--transition-fast);
          transform: scaleX(-1);
        }

        &:hover {
          color: var(--color-secondary);
        }

        &:hover svg {
          transform: scaleX(-1) translateX(4px);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 4px;
          border-radius: var(--radius-sm);
        }
      }

      // ============================================
      // Abstract Visuals
      // ============================================
      .feature-visual-wrapper {
        position: relative;
        margin-block-start: var(--space-5);
        aspect-ratio: 16 / 10;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: rgba(30, 42, 58, 0.03);
        box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.02);
      }

      .abstract-visual {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: transform 0.4s ease;
      }

      .feature-card:hover .abstract-visual {
        transform: scale(1.05);
      }

      /* Calendar */
      .calendar-visual {
        padding: var(--space-4);
        .v-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-2);
          width: 80%;
          height: 80%;
        }
        .v-cell {
          background: rgba(30, 42, 58, 0.05);
          border-radius: var(--radius-sm);
          &.active {
            background: var(--color-primary);
            opacity: 0.8;
          }
          &.pulse {
            background: var(--color-accent);
            animation: pulse-soft 2s infinite;
          }
        }
      }

      /* Shield / Conflict Detection */
      .shield-visual {
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-6);
        .v-shield-bg {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: var(--radius-full);
          background: radial-gradient(
            circle,
            rgba(199, 93, 74, 0.1) 0%,
            transparent 70%
          );
        }
        .v-shield-line {
          height: 8px;
          background: rgba(30, 42, 58, 0.1);
          border-radius: var(--radius-full);
          z-index: 1;
          &.error {
            background: var(--color-error);
            box-shadow: 0 0 10px rgba(196, 69, 54, 0.3);
          }
        }
      }

      /* Mobile */
      .mobile-visual {
        .v-phone {
          width: 80px;
          height: 160px;
          border: 4px solid var(--color-surface-elevated);
          border-radius: var(--radius-lg);
          background: rgba(30, 42, 58, 0.02);
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          padding: var(--space-2);
          gap: var(--space-2);
        }
        .v-phone-header {
          height: 10px;
          background: rgba(30, 42, 58, 0.1);
          border-radius: var(--radius-sm);
        }
        .v-phone-card {
          flex: 1;
          background: var(--color-surface);
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
        }
      }

      /* Users (Network) */
      .users-visual {
        .v-user-node {
          position: absolute;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          box-shadow: 0 4px 12px rgba(30, 42, 58, 0.2);
          &.main {
            width: 40px;
            height: 40px;
          }
          &.child-1 {
            width: 24px;
            height: 24px;
            top: 20%;
            left: 20%;
            opacity: 0.8;
          }
          &.child-2 {
            width: 24px;
            height: 24px;
            bottom: 20%;
            right: 20%;
            opacity: 0.8;
            background: var(--color-accent);
          }
        }
        .v-user-line {
          position: absolute;
          height: 2px;
          background: rgba(30, 42, 58, 0.1);
          transform-origin: left center;
          &.line-1 {
            width: 60px;
            top: 30%;
            left: 30%;
            transform: rotate(45deg);
          }
          &.line-2 {
            width: 60px;
            bottom: 30%;
            right: 30%;
            transform: rotate(-135deg);
          }
        }
      }

      /* Chart */
      .chart-visual {
        align-items: flex-end;
        padding: var(--space-4);
        gap: var(--space-2);
        .v-bar {
          flex: 1;
          background: var(--color-primary);
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          opacity: 0.8;
          &.accent {
            background: var(--color-accent);
            opacity: 1;
          }
          &.h-30 {
            height: 30%;
          }
          &.h-40 {
            height: 40%;
          }
          &.h-50 {
            height: 50%;
          }
          &.h-60 {
            height: 60%;
          }
          &.h-80 {
            height: 80%;
          }
        }
      }

      /* Lock / Security */
      .lock-visual {
        .v-lock-circle {
          width: 60px;
          height: 60px;
          border-radius: var(--radius-full);
          border: 4px solid var(--color-primary);
          position: relative;
          z-index: 2;
          background: var(--color-surface);
        }
        .v-data-stream {
          position: absolute;
          width: 100%;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--color-primary),
            transparent
          );
          animation: scan 3s infinite linear;
          &.delay {
            animation-delay: 1.5s;
            top: 60%;
          }
        }
      }

      @keyframes pulse-soft {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      @keyframes scan {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      // ============================================
      // Stagger Animation
      // ============================================
      .stagger-children {
        .stagger-item {
          opacity: 0;
          transform: translateY(30px);
        }

        &.animate-in {
          @for $i from 1 through 6 {
            .stagger-item:nth-child(#{$i}) {
              animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              animation-delay: #{$i * 0.1}s;
            }
          }
        }
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesGridArComponent implements AfterViewInit, OnDestroy {
  @ViewChild('grid') grid!: ElementRef<HTMLElement>;

  private observer: IntersectionObserver | undefined;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly el = inject(ElementRef);

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
