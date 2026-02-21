import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface SecondaryAction {
  id: string;
  label: string;
  ariaLabel: string;
  href: string;
}

interface TrustItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-bottom-cta-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section
      class="cta-section"
      role="region"
      aria-labelledby="landing-cta-title-ar"
    >
      <div class="cta-bg" aria-hidden="true">
        <div class="bg-gradient"></div>
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
            <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
              <path
                d="M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z"
              />
            </svg>
          </div>
          }
        </div>
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
      </div>

      <div class="cta-content">
        <h2 id="landing-cta-title-ar" class="cta-headline">
          {{ headlinePrefix }}
          <span class="headline-accent">{{ headlineAccent }}</span>
        </h2>

        <p class="cta-subheadline">{{ subheadline }}</p>

        <div class="cta-actions">
          <a
            class="btn btn-primary"
            [routerLink]="['/register']"
            [attr.aria-label]="primaryActionAriaLabel"
          >
            <span class="btn-content">
              <span class="btn-text">{{ primaryActionLabel }}</span>
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
            @for (action of secondaryActions; track action.id) {
            <a
              class="btn btn-outline"
              [href]="action.href"
              [attr.aria-label]="action.ariaLabel"
            >
              {{ action.label }}
            </a>
            }
          </div>
        </div>

        <ul class="trust-line" role="list" aria-label="مؤشرات الثقة للتسجيل">
          @for (item of trustItems; track item.id) {
          <li class="trust-item">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>{{ item.label }}</span>
          </li>
          }
        </ul>
      </div>
    </section>
  `,
  styles: [
    `
      .cta-section {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        max-inline-size: 80rem;
        margin-inline: auto;
        border-radius: var(--radius-xl);
        border: 1px solid rgba(250, 248, 245, 0.08);
        padding-block: var(--space-12);
        padding-inline: var(--space-4);
        box-shadow: var(--shadow-lg);

        @media (min-width: 48rem) {
          padding-block: var(--space-16);
          padding-inline: var(--space-8);
        }
      }

      .cta-bg {
        position: absolute;
        inset: 0;
        z-index: -1;
      }

      .bg-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          var(--color-primary) 0%,
          var(--color-primary-dark) 55%,
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
        inline-size: var(--size);
        block-size: var(--size);
        color: var(--color-accent);
        opacity: var(--opacity);
        transform: rotate(var(--rotation));

        svg {
          inline-size: 100%;
          block-size: 100%;
        }
      }

      .glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(100px);
        pointer-events: none;
      }

      .glow-1 {
        inset-block-start: -20%;
        inset-inline-start: -10%;
        inline-size: 50%;
        block-size: 50%;
        background: radial-gradient(
          circle,
          rgba(212, 168, 85, 0.18) 0%,
          transparent 70%
        );
      }

      .glow-2 {
        inset-block-end: -20%;
        inset-inline-end: -10%;
        inline-size: 60%;
        block-size: 60%;
        background: radial-gradient(
          circle,
          rgba(199, 93, 74, 0.14) 0%,
          transparent 70%
        );
      }

      .cta-content {
        max-inline-size: 44rem;
        margin-inline: auto;
        text-align: center;
        display: grid;
        gap: var(--space-6);
      }

      .cta-headline {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(2rem, 5.5vw, 4rem);
        font-weight: var(--font-bold);
        line-height: 1.05;
        color: var(--color-text-inverse);
        text-wrap: balance;
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
        margin: 0;
        max-inline-size: 37.5rem;
        margin-inline: auto;
        font-size: var(--text-lg);
        line-height: 1.7;
        color: rgba(250, 248, 245, 0.84);
      }

      .cta-actions {
        display: grid;
        justify-items: center;
        gap: var(--space-4);
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-block-size: 3.5rem;
        padding-block: var(--space-3);
        padding-inline: var(--space-6);
        border-radius: var(--radius-lg);
        font-family: var(--font-display);
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        text-decoration: none;
        text-align: center;
        transition: transform var(--transition-fast),
          box-shadow var(--transition-fast), border-color var(--transition-fast),
          background-color var(--transition-fast), color var(--transition-fast);
      }

      .btn-primary {
        inline-size: min(100%, 22rem);
        background: linear-gradient(
          135deg,
          var(--color-secondary) 0%,
          var(--color-secondary-dark) 100%
        );
        color: var(--color-text-inverse);
        box-shadow: 0 8px 30px rgba(199, 93, 74, 0.34);
      }

      .btn-content {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
      }

      .btn-icon {
        inline-size: 1.25rem;
        block-size: 1.25rem;
        transition: transform var(--transition-fast);
        transform: scaleX(-1);
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 34px rgba(199, 93, 74, 0.35);
      }

      .btn-primary:hover .btn-icon {
        transform: scaleX(-1) translateX(4px);
      }

      .btn-primary:focus-visible,
      .btn-outline:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 3px;
      }

      .secondary-actions {
        inline-size: min(100%, 28rem);
        display: grid;
        gap: var(--space-3);
      }

      @media (min-width: 40rem) {
        .secondary-actions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .btn-outline {
        inline-size: 100%;
        font-size: var(--text-base);
        color: var(--color-text-inverse);
        border: 1px solid rgba(250, 248, 245, 0.3);
        background: rgba(250, 248, 245, 0.03);
      }

      .btn-outline:hover {
        transform: translateY(-1px);
        border-color: rgba(250, 248, 245, 0.6);
        background: rgba(250, 248, 245, 0.12);
      }

      .trust-line {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-3);
      }

      .trust-item {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-sm);
        color: rgba(250, 248, 245, 0.78);
      }

      .trust-item svg {
        inline-size: 1rem;
        block-size: 1rem;
        color: var(--color-success);
      }

      @media (prefers-reduced-motion: reduce) {
        .btn,
        .btn-icon {
          transition: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomCtaArComponent {
  private readonly salesEmail = environment.marketing.salesEmail;

  readonly headlinePrefix = 'هل أنت جاهز للقضاء على';
  readonly headlineAccent = 'فوضى الحجز؟';
  readonly subheadline =
    'انضم إلى أكثر من 100 منشأة عبر الشرق الأوسط وشمال أفريقيا حوّلت عمليات الحجز لديها. ابدأ محاولتك المجانية اليوم وشاهد الفرق خلال دقائق.';

  readonly primaryActionLabel = 'ابدأ محاولتك المجانية';
  readonly primaryActionAriaLabel = 'ابدأ محاولتك المجانية';

  readonly secondaryActions: SecondaryAction[] = [
    {
      id: 'demo',
      label: 'احجز عرضاً توضيحياً',
      ariaLabel: 'احجز عرضاً توضيحياً مع فريق المبيعات',
      href: this.createSalesMailto('طلب عرض توضيحي'),
    },
    {
      id: 'sales',
      label: 'تواصل مع المبيعات',
      ariaLabel: 'تواصل مع فريق المبيعات',
      href: this.createSalesMailto('التواصل مع المبيعات'),
    },
  ];

  readonly trustItems: TrustItem[] = [
    { id: 'no-card', label: 'بدون بطاقة ائتمان مطلوبة' },
    { id: 'trial', label: 'تجربة مجانية لمدة 14 يوماً' },
    { id: 'cancel', label: 'يمكنك الإلغاء في أي وقت' },
  ];

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

  private createSalesMailto(subject: string): string {
    const query = new URLSearchParams({
      subject: `${subject} | Khana`,
    });
    return `mailto:${this.salesEmail}?${query.toString()}`;
  }
}
