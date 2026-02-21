import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  computed,
  OnInit,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-hero-section-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="hero" aria-labelledby="hero-heading">
      <!-- Animated Background -->
      <div class="hero-bg" aria-hidden="true">
        <!-- Gradient Mesh -->
        <div class="gradient-mesh"></div>

        <!-- 8-Point Star Pattern -->
        <div class="star-pattern">
          @for (star of stars; track star.id) {
          <div
            class="star"
            [style.--x]="star.x + '%'"
            [style.--y]="star.y + '%'"
            [style.--size]="star.size + 'px'"
            [style.--delay]="star.delay + 's'"
            [style.--duration]="star.duration + 's'"
          >
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z"
                fill="currentColor"
              />
            </svg>
          </div>
          }
        </div>

        <!-- Noise Texture -->
        <div class="noise-overlay"></div>
      </div>

      <!-- Hero Content -->
      <div class="hero-content">
        <div class="hero-text">
          <!-- Badge -->
          <div class="hero-badge animate-in" [style.animation-delay]="'0.1s'">
            <span class="badge-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>
            </span>
            <span class="badge-text"
              >نظام التشغيل لعمليات الحجز المبنية على الطلب</span
            >
          </div>

          <!-- Main Headline -->
          <h1
            id="hero-heading"
            class="hero-headline animate-in"
            [style.animation-delay]="'0.2s'"
          >
            <span class="headline-line">لا تخسر حجز</span>
            <span class="headline-line">
              <span class="headline-accent">أبداً</span>
            </span>
          </h1>

          <!-- Subheadline -->
          <p
            class="hero-subheadline animate-in"
            [style.animation-delay]="'0.4s'"
          >
            تقويم في الوقت الحقيقي. بدون حجوزات مزدوجة. عملاء سعداء.
            <br class="desktop-break" />
            الطريقة الحديثة لإدارة منشأتك الرياضية أو عقارك للإيجار.
          </p>

          <!-- Stats Row -->
          <div class="hero-stats animate-in" [style.animation-delay]="'0.5s'">
            @for (stat of stats; track stat.label) {
            <div class="stat">
              <span class="stat-value">{{ stat.value }}</span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
            }
          </div>

          <!-- CTA Buttons -->
          <div class="hero-actions animate-in" [style.animation-delay]="'0.6s'">
            <a
              routerLink="/bookings"
              class="btn btn-cta"
              aria-label="ابدأ محاولتك المجانية - بدون بطاقة ائتمان مطلوبة"
            >
              <span class="btn-content">
                <span class="btn-text">ابدأ محاولتك المجانية</span>
                <span class="btn-arrow" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </span>
              </span>
              <span class="btn-glow" aria-hidden="true"></span>
            </a>

            <a
              routerLink="/ar"
              fragment="features"
              class="btn btn-secondary"
              aria-label="شاهد كيف تعمل خانة"
            >
              <span class="btn-play" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clip-rule="evenodd"
                  />
                </svg>
              </span>
              <span>شاهد العرض التوضيحي</span>
            </a>
          </div>

          <!-- Trust Badge -->
          <div class="hero-trust animate-in" [style.animation-delay]="'0.7s'">
            <span class="trust-check" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
            <span>بدون بطاقة ائتمان مطلوبة</span>
            <span class="trust-separator" aria-hidden="true">&bull;</span>
            <span>تجربة مجانية لمدة 14 يوماً</span>
            <span class="trust-separator" aria-hidden="true">&bull;</span>
            <span>يمكنك الإلغاء في أي وقت</span>
          </div>
        </div>

        <!-- Floating Dashboard Mockup -->
        <div
          class="hero-visual animate-in"
          [style.animation-delay]="'0.3s'"
          [style.--parallax-y]="parallaxOffset()"
        >
          <div class="dashboard-container">
            <!-- Main Dashboard Card -->
            <div class="dashboard-main">
              <!-- Native CSS Abstract Dashboard UI -->
              <div class="abstract-dashboard">
                <div class="dash-sidebar">
                  <div class="dash-logo"></div>
                  <div class="dash-nav-item active"></div>
                  <div class="dash-nav-item"></div>
                  <div class="dash-nav-item"></div>
                </div>
                <div class="dash-body">
                  <div class="dash-header-bar">
                    <div class="dash-title"></div>
                    <div class="dash-avatar"></div>
                  </div>
                  <div class="dash-calendar-grid">
                    <!-- Day Columns -->
                    <div class="dash-col">
                      <div
                        class="dash-block primary"
                        style="top: 10%; height: 20%"
                      ></div>
                      <div
                        class="dash-block secondary"
                        style="top: 40%; height: 15%"
                      ></div>
                    </div>
                    <div class="dash-col">
                      <div
                        class="dash-block accent"
                        style="top: 20%; height: 30%"
                      ></div>
                    </div>
                    <div class="dash-col">
                      <div
                        class="dash-block primary"
                        style="top: 15%; height: 25%"
                      ></div>
                      <div
                        class="dash-block accent"
                        style="top: 50%; height: 20%"
                      ></div>
                    </div>
                    <div class="dash-col">
                      <div
                        class="dash-block secondary"
                        style="top: 5%; height: 40%"
                      ></div>
                    </div>
                    <div class="dash-col">
                      <div
                        class="dash-block primary"
                        style="top: 30%; height: 30%"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating Elements -->
            <div class="floating-card card-booking" aria-hidden="true">
              <div class="floating-card-icon">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="floating-card-content">
                <span class="floating-card-title">تم تأكيد الحجز</span>
                <span class="floating-card-subtitle"
                  >الملعب ٣ &bull; ٦:٠٠ م</span
                >
              </div>
            </div>

            <div class="floating-card card-revenue" aria-hidden="true">
              <div class="floating-card-icon revenue">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"
                  />
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="floating-card-content">
                <span class="floating-card-title">+٢٬٤٥٠$</span>
                <span class="floating-card-subtitle">هذا الأسبوع</span>
              </div>
            </div>

            <div class="floating-card card-calendar" aria-hidden="true">
              <div class="mini-calendar">
                <div class="calendar-header">
                  <span>يناير ٢٠٢٦</span>
                </div>
                <div class="calendar-days">
                  @for (day of calendarDays; track day.date) {
                  <span
                    class="calendar-day"
                    [class.booked]="day.booked"
                    [class.today]="day.today"
                  >
                    {{ day.date }}
                  </span>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scroll Indicator -->
      <div class="scroll-indicator" aria-hidden="true">
        <div class="scroll-mouse">
          <div class="scroll-wheel"></div>
        </div>
        <span class="scroll-text">مرر للاستكشاف</span>
      </div>
    </section>
  `,
  styles: [
    `
      .hero {
        position: relative;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding-block-start: 100px;
        padding-block-end: var(--space-12);

        @media (min-width: 64rem) {
          padding-block-start: 120px;
        }
      }

      // ============================================
      // Background
      // ============================================
      .hero-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .gradient-mesh {
        position: absolute;
        inset: 0;
        background: radial-gradient(
            ellipse 80% 50% at 20% 40%,
            rgba(212, 168, 85, 0.15) 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 60% 40% at 80% 20%,
            rgba(199, 93, 74, 0.12) 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 50% 30% at 10% 80%,
            rgba(30, 42, 58, 0.2) 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 70% 50% at 90% 70%,
            rgba(212, 168, 85, 0.1) 0%,
            transparent 50%
          ),
          linear-gradient(
            180deg,
            var(--color-surface) 0%,
            rgba(240, 236, 230, 1) 100%
          );
      }

      .star-pattern {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .star {
        position: absolute;
        inset-inline-start: var(--x);
        inset-block-start: var(--y);
        width: var(--size);
        height: var(--size);
        color: var(--color-accent);
        opacity: 0.15;
        animation: float-star var(--duration) ease-in-out infinite;
        animation-delay: var(--delay);

        svg {
          width: 100%;
          height: 100%;
        }
      }

      @keyframes float-star {
        0%,
        100% {
          transform: translateY(0) rotate(0deg);
          opacity: 0.1;
        }
        50% {
          transform: translateY(-10px) rotate(15deg);
          opacity: 0.2;
        }
      }

      .noise-overlay {
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        opacity: 0.03;
      }

      // ============================================
      // Content
      // ============================================
      .hero-content {
        position: relative;
        z-index: 1;
        flex: 1;
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-12);
        align-items: center;
        max-width: 80rem;
        margin: 0 auto;
        padding-inline: var(--space-4);
        width: 100%;

        @media (min-width: 64rem) {
          grid-template-columns: 1fr 1.1fr;
          gap: var(--space-8);
          padding-inline: var(--space-8);
        }
      }

      .hero-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        text-align: center;

        @media (min-width: 64rem) {
          text-align: start;
        }
      }

      // ============================================
      // Badge
      // ============================================
      .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        background: linear-gradient(
          135deg,
          rgba(212, 168, 85, 0.15) 0%,
          rgba(199, 93, 74, 0.1) 100%
        );
        border: 1px solid rgba(212, 168, 85, 0.3);
        border-radius: var(--radius-full);
        width: fit-content;
        margin-inline: auto;

        @media (min-width: 64rem) {
          margin-inline: 0;
        }
      }

      .badge-icon {
        width: 16px;
        height: 16px;
        color: var(--color-accent);

        svg {
          width: 100%;
          height: 100%;
        }
      }

      .badge-text {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
        letter-spacing: 0.02em;
      }

      // ============================================
      // Headline
      // ============================================
      .hero-headline {
        font-family: var(--font-display);
        font-size: clamp(2.5rem, 8vw, 4.5rem);
        font-weight: var(--font-bold);
        line-height: 1.05;
        color: var(--color-text-primary);
        letter-spacing: -0.02em;
      }

      .headline-line {
        display: block;
      }

      .headline-accent {
        position: relative;
        display: inline-block;
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;

        &::after {
          content: '';
          position: absolute;
          inset-inline: 0;
          inset-block-end: 0.1em;
          height: 0.08em;
          background: linear-gradient(
            135deg,
            var(--color-accent) 0%,
            var(--color-secondary) 100%
          );
          border-radius: var(--radius-full);
          opacity: 0.4;
        }
      }

      // ============================================
      // Subheadline
      // ============================================
      .hero-subheadline {
        font-size: var(--text-lg);
        line-height: 1.7;
        color: var(--color-text-secondary);
        max-width: 480px;
        margin-inline: auto;

        @media (min-width: 64rem) {
          margin-inline: 0;
          font-size: var(--text-xl);
        }
      }

      .desktop-break {
        display: none;

        @media (min-width: 64rem) {
          display: block;
        }
      }

      // ============================================
      // Stats
      // ============================================
      .hero-stats {
        display: flex;
        justify-content: center;
        gap: var(--space-8);
        padding-block: var(--space-4);

        @media (min-width: 64rem) {
          justify-content: flex-start;
        }
      }

      .stat {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .stat-value {
        font-family: var(--font-display);
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);

        @media (min-width: 64rem) {
          font-size: var(--text-3xl);
        }
      }

      .stat-label {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      // ============================================
      // CTA Buttons
      // ============================================
      .hero-actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        align-items: center;

        @media (min-width: 48rem) {
          flex-direction: row;
          gap: var(--space-4);
        }

        @media (min-width: 64rem) {
          justify-content: flex-start;
        }
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-6);
        font-family: var(--font-display);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        text-decoration: none;
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        min-height: 56px;
      }

      .btn-cta {
        position: relative;
        background: linear-gradient(
          135deg,
          var(--color-secondary) 0%,
          #a84a39 100%
        );
        color: white;
        border: none;
        overflow: hidden;
        padding-inline-end: var(--space-5);

        .btn-content {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          position: relative;
          z-index: 1;
        }

        .btn-arrow {
          display: flex;
          width: 20px;
          height: 20px;
          transition: transform 0.3s ease;
          transform: scaleX(-1);

          svg {
            width: 100%;
            height: 100%;
          }
        }

        .btn-glow {
          position: absolute;
          inset: -2px;
          background: linear-gradient(
            135deg,
            var(--color-secondary-light) 0%,
            var(--color-secondary) 100%
          );
          border-radius: inherit;
          opacity: 0;
          z-index: 0;
          transition: opacity 0.3s ease;
        }

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            var(--color-secondary-light) 0%,
            var(--color-secondary) 100%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        &:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 40px rgba(199, 93, 74, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;

          &::before {
            opacity: 1;
          }

          .btn-arrow {
            transform: scaleX(-1) translateX(4px);
          }
        }

        &:active {
          transform: translateY(-1px);
        }
      }

      .btn-secondary {
        background: transparent;
        color: var(--color-text-primary);
        border: 2px solid var(--color-primary-light);

        .btn-play {
          display: flex;
          width: 20px;
          height: 20px;
          color: var(--color-accent);

          svg {
            width: 100%;
            height: 100%;
          }
        }

        &:hover {
          background: rgba(30, 42, 58, 0.05);
          border-color: var(--color-primary);
          transform: translateY(-2px);
        }
      }

      // ============================================
      // Trust Badge
      // ============================================
      .hero-trust {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-muted);

        @media (min-width: 64rem) {
          justify-content: flex-start;
        }
      }

      .trust-check {
        display: flex;
        width: 16px;
        height: 16px;
        color: var(--color-success);

        svg {
          width: 100%;
          height: 100%;
        }
      }

      .trust-separator {
        color: var(--color-text-muted);
        opacity: 0.5;
      }

      // ============================================
      // Hero Visual / Dashboard Mockup
      // ============================================
      .hero-visual {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        transform: translateY(calc(var(--parallax-y, 0) * 0.1px));
        transition: transform 0.1s ease-out;
      }

      .dashboard-container {
        position: relative;
        width: 100%;
        max-width: 600px;
        perspective: 1000px;
      }

      .dashboard-main {
        position: relative;
        background: var(--color-surface-elevated);
        border-radius: var(--radius-xl);
        box-shadow: 0 25px 80px rgba(30, 42, 58, 0.15),
          0 10px 30px rgba(30, 42, 58, 0.1), 0 0 0 1px rgba(30, 42, 58, 0.05);
        overflow: hidden;
        transform: rotateY(-5deg) rotateX(2deg);
        transition: transform 0.5s ease;

        &:hover {
          transform: rotateY(-2deg) rotateX(1deg);
        }

        @media (min-width: 64rem) {
          transform: rotateY(-8deg) rotateX(3deg);

          &:hover {
            transform: rotateY(-4deg) rotateX(1deg);
          }
        }
      }

      .abstract-dashboard {
        width: 100%;
        aspect-ratio: 16 / 10;
        background: var(--color-surface);
        border-radius: var(--radius-lg);
        display: flex;
        overflow: hidden;
        border: 1px solid rgba(30, 42, 58, 0.05);

        .dash-sidebar {
          width: 20%;
          background: var(--color-primary);
          padding: var(--space-4) var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          border-left: 1px solid rgba(255, 255, 255, 0.05);
        }

        .dash-logo {
          width: 60%;
          height: 12px;
          background: var(--color-accent);
          border-radius: var(--radius-sm);
          margin-block-end: var(--space-6);
        }

        .dash-nav-item {
          width: 80%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-sm);

          &.active {
            background: var(--color-surface);
          }
        }

        .dash-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--color-surface-elevated);
        }

        .dash-header-bar {
          height: 15%;
          border-bottom: 1px solid rgba(30, 42, 58, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-inline: var(--space-4);
        }

        .dash-title {
          width: 30%;
          height: 12px;
          background: var(--color-surface-muted);
          border-radius: var(--radius-sm);
        }

        .dash-avatar {
          width: 24px;
          height: 24px;
          background: var(--color-surface-muted);
          border-radius: var(--radius-full);
        }

        .dash-calendar-grid {
          flex: 1;
          display: flex;
          padding: var(--space-4);
          gap: var(--space-2);
        }

        .dash-col {
          flex: 1;
          height: 100%;
          position: relative;
          background: rgba(30, 42, 58, 0.02);
          border-radius: var(--radius-sm);
        }

        .dash-block {
          position: absolute;
          width: 90%;
          right: 5%;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
          transition: transform var(--transition-base);

          &:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: var(--shadow-md);
          }

          &.primary {
            background: var(--color-primary);
            opacity: 0.9;
          }
          &.secondary {
            background: var(--color-secondary);
            opacity: 0.85;
          }
          &.accent {
            background: var(--color-accent);
            opacity: 0.9;
          }
        }
      }

      // ============================================
      // Floating Cards
      // ============================================
      .floating-card {
        position: absolute;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: var(--radius-lg);
        box-shadow: 0 10px 40px rgba(30, 42, 58, 0.12),
          0 0 0 1px rgba(255, 255, 255, 0.8) inset;
        animation: float 6s ease-in-out infinite;

        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }

      .floating-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: linear-gradient(
          135deg,
          var(--color-success) 0%,
          #1f6357 100%
        );
        border-radius: var(--radius-md);
        color: white;

        svg {
          width: 18px;
          height: 18px;
        }

        &.revenue {
          background: linear-gradient(
            135deg,
            var(--color-accent) 0%,
            var(--color-accent-dark) 100%
          );
        }
      }

      .floating-card-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .floating-card-title {
        font-family: var(--font-display);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      .floating-card-subtitle {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .card-booking {
        inset-block-start: 10%;
        inset-inline-end: -5%;
        animation-delay: 0s;

        @media (min-width: 64rem) {
          inset-inline-end: -15%;
        }
      }

      .card-revenue {
        inset-block-end: 25%;
        inset-inline-start: -5%;
        animation-delay: 2s;

        @media (min-width: 64rem) {
          inset-inline-start: -10%;
        }
      }

      .card-calendar {
        inset-block-end: 5%;
        inset-inline-end: 5%;
        padding: var(--space-3);
        animation-delay: 4s;
      }

      .mini-calendar {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .calendar-header {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        text-align: center;
      }

      .calendar-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }

      .calendar-day {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        font-size: 10px;
        border-radius: var(--radius-sm);
        color: var(--color-text-secondary);

        &.booked {
          background: var(--color-success-light);
          color: var(--color-success);
          font-weight: var(--font-semibold);
        }

        &.today {
          background: var(--color-accent);
          color: white;
          font-weight: var(--font-bold);
        }
      }

      @keyframes float {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-15px);
        }
      }

      // ============================================
      // Scroll Indicator
      // ============================================
      .scroll-indicator {
        position: absolute;
        inset-block-end: var(--space-8);
        inset-inline-start: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        opacity: 0.6;
        animation: bounce 2s ease-in-out infinite;

        @media (min-width: 64rem) {
          inset-block-end: var(--space-12);
        }

        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }

      .scroll-mouse {
        width: 24px;
        height: 36px;
        border: 2px solid var(--color-text-muted);
        border-radius: 12px;
        display: flex;
        justify-content: center;
        padding-block-start: 6px;
      }

      .scroll-wheel {
        width: 4px;
        height: 8px;
        background: var(--color-accent);
        border-radius: 2px;
        animation: scroll-wheel 1.5s ease-in-out infinite;

        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }

      .scroll-text {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      @keyframes bounce {
        0%,
        100% {
          transform: translateX(-50%) translateY(0);
        }
        50% {
          transform: translateX(-50%) translateY(-8px);
        }
      }

      @keyframes scroll-wheel {
        0%,
        100% {
          opacity: 1;
          transform: translateY(0);
        }
        50% {
          opacity: 0.5;
          transform: translateY(6px);
        }
      }

      // ============================================
      // Animation In
      // ============================================
      .animate-in {
        animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        animation-fill-mode: both;
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
export class HeroSectionArComponent implements OnInit {
  @Input() scrollY = 0;

  readonly parallaxOffset = computed(() => this.scrollY * -0.3);

  readonly stats = [
    { value: '١٠٠٠٠+', label: 'حجوزات مُدارة' },
    { value: '١٠٠+', label: 'منشأة' },
    { value: '٩٩٫٩٪', label: 'التوافر' },
  ];

  readonly stars = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16 + Math.random() * 32,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 4,
  }));

  readonly calendarDays = [
    { date: '٦', booked: false, today: false },
    { date: '٧', booked: true, today: false },
    { date: '٨', booked: true, today: false },
    { date: '٩', booked: false, today: false },
    { date: '١٠', booked: true, today: false },
    { date: '١١', booked: false, today: true },
    { date: '١٢', booked: true, today: false },
  ];

  ngOnInit(): void {
    // Component initialized
  }
}
