import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
  image: string;
}

@Component({
  selector: 'app-how-it-works-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="section-container">
      <!-- Section Background -->
      <div class="section-bg" aria-hidden="true">
        <div class="bg-gradient"></div>
        <div class="bg-pattern"></div>
      </div>

      <!-- Section Header -->
      <header class="section-header">
        <span class="section-eyebrow">إعداد بسيط</span>
        <h2 class="section-title">
          ابدأ في
          <span class="text-gradient">دقائق، لا أيام</span>
        </h2>
        <p class="section-subtitle">
          لا إعداد معقد ولا تجربة تشغيل طويلة. ابدأ إدارة الحجوزات باحتراف في
          أربع خطوات بسيطة.
        </p>
      </header>

      <!-- Steps Timeline -->
      <div class="steps-container" role="list" aria-label="خطوات الإعداد">
        <!-- Connection Line -->
        <div class="connection-line" aria-hidden="true">
          <div class="line-fill"></div>
        </div>

        @for (step of steps; track step.number; let isLast = $last) {
        <div
          class="step-item"
          role="listitem"
          [attr.aria-label]="'الخطوة ' + step.number + ': ' + step.title"
        >
          <!-- Step Number Circle -->
          <div class="step-marker">
            <div class="step-number">
              <span>{{ step.number }}</span>
            </div>
            <div class="step-pulse" aria-hidden="true"></div>
          </div>

          <!-- Step Content Card -->
          <div class="step-card">
            <!-- Abstract Step Visual -->
            <div class="step-visual-wrapper">
              @switch (step.icon) { @case ('user-plus') {
              <div class="abstract-step step-signup">
                <div class="s-card main"></div>
                <div class="s-card float-1"></div>
              </div>
              } @case ('upload') {
              <div class="abstract-step step-import">
                <div class="s-arrow-up"></div>
                <div class="s-data-row w-80"></div>
                <div class="s-data-row w-60"></div>
                <div class="s-data-row w-90"></div>
              </div>
              } @case ('share') {
              <div class="abstract-step step-share">
                <div class="s-link-box"></div>
                <div class="s-ripple"></div>
              </div>
              } @case ('zap') {
              <div class="abstract-step step-manage">
                <div class="s-metric-grid">
                  <div class="s-metric"></div>
                  <div class="s-metric"></div>
                  <div class="s-metric span-2 accent"></div>
                </div>
              </div>
              } }
            </div>

            <div class="step-icon" aria-hidden="true">
              @switch (step.icon) { @case ('user-plus') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6M23 11h-6" />
              </svg>
              } @case ('upload') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              } @case ('share') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              } @case ('zap') {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              } }
            </div>

            <div class="step-content">
              <h3 class="step-title">{{ step.title }}</h3>
              <p class="step-description">{{ step.description }}</p>
            </div>

            <!-- Decorative Arrow (except last) -->
            @if (!isLast) {
            <div class="step-arrow" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            }
          </div>
        </div>
        }
      </div>

      <!-- Bottom CTA -->
      <div class="section-cta">
        <p class="cta-text">هل أنت جاهز لتحويل عملية الحجز؟</p>
        <a
          routerLink="/ar"
          fragment="cta"
          class="btn btn-cta"
          aria-label="ابدأ محاولتك المجانية"
        >
          <span>ابدأ مجاناً</span>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </a>
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

        @media (min-width: 64rem) {
          padding: calc(var(--space-16) * 1.5) var(--space-8);
        }
      }

      // ============================================
      // Background
      // ============================================
      .section-bg {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .bg-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          var(--color-surface) 0%,
          rgba(212, 168, 85, 0.03) 50%,
          var(--color-surface) 100%
        );
      }

      .bg-pattern {
        position: absolute;
        inset: 0;
        opacity: 0.02;
        background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L32.5 27.5L60 30L32.5 32.5L30 60L27.5 32.5L0 30L27.5 27.5L30 0Z' fill='%231e2a3a'/%3E%3C/svg%3E");
        background-size: 80px 80px;
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
          margin-block-end: calc(var(--space-12) * 1.5);
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
      // Steps Container
      // ============================================
      .steps-container {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        z-index: 1;

        @media (min-width: 64rem) {
          flex-direction: row;
          gap: var(--space-4);
          justify-content: space-between;
        }
      }

      // ============================================
      // Connection Line
      // ============================================
      .connection-line {
        display: none;

        @media (min-width: 64rem) {
          display: block;
          position: absolute;
          inset-block-start: 40px;
          inset-inline-start: 80px;
          inset-inline-end: 80px;
          height: 2px;
          background: var(--color-surface-muted);
          z-index: 0;
        }
      }

      .line-fill {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        width: 0;
        animation: fillLine 2s ease forwards;
        animation-delay: 0.5s;

        @media (prefers-reduced-motion: reduce) {
          animation: none;
          width: 100%;
        }
      }

      @keyframes fillLine {
        to {
          width: 100%;
        }
      }

      // ============================================
      // Step Item
      // ============================================
      .step-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        position: relative;

        @media (min-width: 64rem) {
          max-width: 280px;
        }
      }

      // ============================================
      // Step Marker
      // ============================================
      .step-marker {
        position: relative;
        margin-block-end: var(--space-6);
      }

      .step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        border-radius: var(--radius-full);
        box-shadow: 0 8px 32px rgba(212, 168, 85, 0.3),
          0 0 0 4px rgba(212, 168, 85, 0.1);
        position: relative;
        z-index: 2;

        span {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: white;
        }
      }

      .step-pulse {
        position: absolute;
        inset: -8px;
        border-radius: var(--radius-full);
        border: 2px solid var(--color-accent);
        opacity: 0;
        animation: pulse 2s ease infinite;

        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }

      @keyframes pulse {
        0% {
          transform: scale(1);
          opacity: 0.5;
        }
        100% {
          transform: scale(1.3);
          opacity: 0;
        }
      }

      // ============================================
      // Step Card
      // ============================================
      .step-card {
        position: relative;
        width: 100%;
        padding: var(--space-6);
        background: var(--color-surface-elevated);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        text-align: center;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);

          .step-icon {
            transform: scale(1.1);
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
      // Abstract Step Visuals
      // ============================================
      .step-visual-wrapper {
        margin-block-end: var(--space-4);
        border-radius: var(--radius-lg);
        overflow: hidden;
        aspect-ratio: 16 / 10;
        background: rgba(30, 42, 58, 0.02);
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.02);
        position: relative;
      }

      .abstract-step {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: transform 0.4s ease;
      }

      .step-card:hover .abstract-step {
        transform: translateY(-4px) scale(1.02);
      }

      /* Step 1: Signup */
      .step-signup {
        .s-card {
          position: absolute;
          background: var(--color-surface-elevated);
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
          &.main {
            width: 60%;
            height: 50%;
            z-index: 2;
            border: 2px solid var(--color-primary);
          }
          &.float-1 {
            width: 40%;
            height: 30%;
            top: 15%;
            right: 10%;
            background: var(--color-accent);
            opacity: 0.9;
          }
        }
      }

      /* Step 2: Import */
      .step-import {
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        .s-arrow-up {
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 15px solid var(--color-secondary);
          margin-bottom: var(--space-2);
          animation: bounce-up 2s infinite;
        }
        .s-data-row {
          height: 8px;
          background: rgba(30, 42, 58, 0.1);
          border-radius: var(--radius-sm);
          &.w-80 {
            width: 80%;
          }
          &.w-60 {
            width: 60%;
          }
          &.w-90 {
            width: 90%;
          }
        }
      }

      /* Step 3: Share */
      .step-share {
        .s-link-box {
          width: 50%;
          height: 20px;
          background: var(--color-surface-elevated);
          border: 2px solid var(--color-primary);
          border-radius: var(--radius-full);
          position: relative;
          z-index: 2;
        }
        .s-ripple {
          position: absolute;
          width: 50%;
          height: 20px;
          border-radius: var(--radius-full);
          border: 2px solid var(--color-accent);
          opacity: 0;
          animation: ripple-out 2s infinite;
        }
      }

      /* Step 4: Manage */
      .step-manage {
        padding: var(--space-4);
        .s-metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
          width: 100%;
          height: 100%;
        }
        .s-metric {
          background: rgba(30, 42, 58, 0.05);
          border-radius: var(--radius-sm);
          &.span-2 {
            grid-column: span 2;
          }
          &.accent {
            background: var(--color-primary);
            opacity: 0.9;
          }
        }
      }

      @keyframes bounce-up {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-5px);
        }
      }
      @keyframes ripple-out {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        100% {
          transform: scale(1.5);
          opacity: 0;
        }
      }

      .step-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        margin-inline: auto;
        margin-block-end: var(--space-4);
        background: rgba(212, 168, 85, 0.1);
        border-radius: var(--radius-lg);
        color: var(--color-accent-dark);
        transition: transform 0.3s ease;

        svg {
          width: 24px;
          height: 24px;
        }
      }

      .step-content {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .step-title {
        font-family: var(--font-display);
        font-size: var(--text-lg);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
      }

      .step-description {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: 1.6;
      }

      .step-arrow {
        display: none;

        @media (min-width: 64rem) {
          display: flex;
          position: absolute;
          inset-inline-end: -32px;
          inset-block-start: 50%;
          transform: translateY(-50%) scaleX(-1);
          width: 24px;
          height: 24px;
          color: var(--color-accent);
          opacity: 0.5;

          svg {
            width: 100%;
            height: 100%;
          }
        }
      }

      // ============================================
      // Section CTA
      // ============================================
      .section-cta {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
        margin-block-start: var(--space-12);
        z-index: 1;

        @media (min-width: 48rem) {
          flex-direction: row;
          justify-content: center;
        }
      }

      .cta-text {
        font-size: var(--text-lg);
        font-weight: var(--font-medium);
        color: var(--color-text-secondary);
      }

      .btn-cta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-6);
        background: linear-gradient(
          135deg,
          var(--color-secondary) 0%,
          #a84a39 100%
        );
        color: white;
        font-family: var(--font-display);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        text-decoration: none;
        border-radius: var(--radius-lg);
        transition: all 0.3s ease;

        svg {
          width: 20px;
          height: 20px;
          transition: transform 0.3s ease;
          transform: scaleX(-1);
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(199, 93, 74, 0.3);

          svg {
            transform: scaleX(-1) translateX(4px);
          }
        }

        &:focus-visible {
          outline: 2px solid var(--color-secondary);
          outline-offset: 4px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksArComponent {
  readonly steps: Step[] = [
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
  ];
}
