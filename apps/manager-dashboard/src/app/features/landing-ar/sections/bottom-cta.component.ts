import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-cta-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="cta-section">
      <!-- Background Elements -->
      <div class="cta-bg" aria-hidden="true">
        <!-- Gradient Overlay -->
        <div class="bg-gradient"></div>

        <!-- 8-Point Star Pattern -->
        <div class="star-pattern">
          @for (star of stars; track star.id) {
          <div
            class="star"
            [style.--x]="star.x + '%'"
            [style.--y]="star.y + '%'"
            [style.--size]="star.size + 'px'"
            [style.--opacity]="star.opacity"
            [style.--rotation]="star.rotation + 'deg'"
          >
            <svg viewBox="0 0 32 32" fill="currentColor">
              <path
                d="M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z"
              />
            </svg>
          </div>
          }
        </div>

        <!-- Glow Effects -->
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
      </div>

      <!-- CTA Content -->
      <div class="cta-content">
        <h2 class="cta-headline">
          هل أنت جاهز للقضاء على
          <span class="headline-accent">فوضى الحجز؟</span>
        </h2>

        <p class="cta-subheadline">
          انضم إلى أكثر من 100 منشأة عبر الشرق الأوسط وشمال أفريقيا حوّلت عمليات
          الحجز لديها. ابدأ محاولتك المجانية اليوم وشاهد الفرق خلال دقائق.
        </p>

        <!-- CTA Buttons -->
        <div class="cta-buttons">
          <a
            routerLink="/bookings"
            class="btn btn-primary"
            aria-label="ابدأ محاولتك المجانية"
          >
            <span class="btn-content">
              <span class="btn-text">ابدأ محاولتك المجانية</span>
              <span class="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </span>
            </span>
          </a>

          <div class="secondary-actions">
            <a
              href="#"
              class="btn btn-outline"
              aria-label="احجز عرضاً توضيحياً"
            >
              احجز عرض توضيحي
            </a>
            <a href="#" class="btn btn-outline" aria-label="تحدث مع المبيعات">
              تحدث مع المبيعات
            </a>
          </div>
        </div>

        <!-- Trust Line -->
        <div class="trust-line">
          <span class="trust-item">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>بدون بطاقة ائتمان مطلوبة</span>
          </span>
          <span class="trust-divider" aria-hidden="true">&bull;</span>
          <span class="trust-item">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>تجربة مجانية لمدة 14 يوماً</span>
          </span>
          <span class="trust-divider" aria-hidden="true">&bull;</span>
          <span class="trust-item">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>يمكنك الإلغاء في أي وقت</span>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .cta-section {
        position: relative;
        padding: var(--space-16) var(--space-4);
        margin-inline: calc(var(--space-4) * -1);
        overflow: hidden;

        @media (min-width: 48rem) {
          padding: calc(var(--space-16) * 1.5) var(--space-8);
          margin-inline: calc(var(--space-8) * -1);
          border-radius: var(--radius-xl);
        }

        @media (min-width: 64rem) {
          margin-inline: 0;
        }
      }

      // ============================================
      // Background
      // ============================================
      .cta-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .bg-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          var(--color-primary) 0%,
          var(--color-primary-dark) 50%,
          #0f141d 100%
        );
      }

      .star-pattern {
        position: absolute;
        inset: 0;
      }

      .star {
        position: absolute;
        inset-inline-start: var(--x);
        inset-block-start: var(--y);
        width: var(--size);
        height: var(--size);
        color: var(--color-accent);
        opacity: var(--opacity);
        transform: rotate(var(--rotation));

        svg {
          width: 100%;
          height: 100%;
        }
      }

      .glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(100px);
        pointer-events: none;

        &.glow-1 {
          inset-block-start: -20%;
          inset-inline-start: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 168, 85, 0.2) 0%,
            transparent 70%
          );
        }

        &.glow-2 {
          inset-block-end: -20%;
          inset-inline-end: -10%;
          width: 60%;
          height: 60%;
          background: radial-gradient(
            circle,
            rgba(199, 93, 74, 0.15) 0%,
            transparent 70%
          );
        }
      }

      // ============================================
      // Content
      // ============================================
      .cta-content {
        position: relative;
        z-index: 1;
        max-width: 800px;
        margin-inline: auto;
        text-align: center;
      }

      .cta-headline {
        font-family: var(--font-display);
        font-size: clamp(2rem, 6vw, 3.5rem);
        font-weight: var(--font-bold);
        color: var(--color-text-inverse);
        line-height: 1.1;
        margin-block-end: var(--space-6);
      }

      .headline-accent {
        display: block;
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-accent-light) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .cta-subheadline {
        font-size: var(--text-lg);
        color: rgba(250, 248, 245, 0.8);
        line-height: 1.7;
        margin-block-end: var(--space-10);
        max-width: 600px;
        margin-inline: auto;

        @media (min-width: 64rem) {
          font-size: var(--text-xl);
        }
      }

      // ============================================
      // Buttons
      // ============================================
      .cta-buttons {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-6);
        margin-block-end: var(--space-8);
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

      .btn-primary {
        background: linear-gradient(
          135deg,
          var(--color-secondary) 0%,
          var(--color-secondary-dark) 100%
        );
        color: white;
        border: none;
        padding: var(--space-5) var(--space-8);
        font-size: var(--text-lg);
        box-shadow: 0 8px 32px rgba(199, 93, 74, 0.3),
          0 0 0 0 rgba(199, 93, 74, 0.4);

        .btn-content {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .btn-icon {
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

        &:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 48px rgba(199, 93, 74, 0.4),
            0 0 0 4px rgba(199, 93, 74, 0.2);

          .btn-icon {
            transform: scaleX(-1) translateX(4px);
          }
        }

        &:active {
          transform: translateY(-1px) scale(1);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 4px;
        }
      }

      .secondary-actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);

        @media (min-width: 48rem) {
          flex-direction: row;
          gap: var(--space-4);
        }
      }

      .btn-outline {
        background: transparent;
        color: var(--color-text-inverse);
        border: 2px solid rgba(250, 248, 245, 0.3);
        padding: var(--space-3) var(--space-6);

        &:hover {
          background: rgba(250, 248, 245, 0.1);
          border-color: rgba(250, 248, 245, 0.5);
          transform: translateY(-2px);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      }

      // ============================================
      // Trust Line
      // ============================================
      .trust-line {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: var(--space-3);
        font-size: var(--text-sm);
        color: rgba(250, 248, 245, 0.7);
      }

      .trust-item {
        display: flex;
        align-items: center;
        gap: var(--space-1);

        svg {
          width: 16px;
          height: 16px;
          color: var(--color-success);
        }
      }

      .trust-divider {
        opacity: 0.4;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomCtaArComponent {
  readonly stars = [
    { id: 1, x: 5, y: 10, size: 32, opacity: 0.08, rotation: 0 },
    { id: 2, x: 15, y: 60, size: 24, opacity: 0.05, rotation: 15 },
    { id: 3, x: 25, y: 30, size: 40, opacity: 0.06, rotation: -10 },
    { id: 4, x: 40, y: 80, size: 28, opacity: 0.04, rotation: 20 },
    { id: 5, x: 55, y: 15, size: 36, opacity: 0.07, rotation: -5 },
    { id: 6, x: 70, y: 50, size: 20, opacity: 0.05, rotation: 25 },
    { id: 7, x: 80, y: 25, size: 44, opacity: 0.06, rotation: -15 },
    { id: 8, x: 90, y: 70, size: 32, opacity: 0.04, rotation: 10 },
    { id: 9, x: 95, y: 5, size: 28, opacity: 0.05, rotation: -20 },
    { id: 10, x: 50, y: 90, size: 36, opacity: 0.03, rotation: 30 },
  ];
}
