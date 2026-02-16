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
  selector: 'app-social-proof',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-container">
      <!-- Background -->
      <div class="section-bg" aria-hidden="true">
        <div class="bg-gradient"></div>
      </div>

      <!-- Section Header -->
      <header class="section-header">
        <span class="section-eyebrow">Trusted by Leaders</span>
        <h2 class="section-title">
          Loved by Facility Managers
          <span class="text-gradient">Across MENA</span>
        </h2>
        <p class="section-subtitle">
          Don't just take our word for it. See what our customers have to say
          about transforming their booking operations.
        </p>
      </header>

      <!-- Stats Row -->
      <div class="stats-row" role="list" aria-label="Key statistics">
        @for (stat of stats; track stat.label) {
        <div class="stat-item" role="listitem">
          <span class="stat-value">
            {{ stat.value }}
            @if (stat.suffix) {
            <span class="stat-suffix">{{ stat.suffix }}</span>
            }
          </span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
        }
      </div>

      <!-- Testimonials Carousel -->
      <div class="testimonials-wrapper">
        <!-- Navigation Arrows -->
        <button
          type="button"
          class="carousel-nav nav-prev"
          (click)="prevSlide()"
          [disabled]="currentIndex() === 0"
          aria-label="Previous testimonial"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="testimonials-container">
          <div
            class="testimonials-track"
            [style.transform]="
              'translateX(calc(-' +
              currentIndex() +
              ' * (100% / ' +
              visibleCount() +
              ')))'
            "
          >
            @for (testimonial of testimonials; track testimonial.id) {
            <article
              class="testimonial-card"
              [attr.aria-label]="'Testimonial from ' + testimonial.author"
            >
              <!-- Quote Mark -->
              <div class="quote-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                  />
                </svg>
              </div>

              <!-- Rating -->
              <div
                class="rating"
                aria-label="{{ testimonial.rating }} out of 5 stars"
              >
                @for (star of [1, 2, 3, 4, 5]; track star) {
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  [class.filled]="star <= testimonial.rating"
                  aria-hidden="true"
                >
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  />
                </svg>
                }
              </div>

              <!-- Quote -->
              <blockquote class="testimonial-quote">
                "{{ testimonial.quote }}"
              </blockquote>

              <!-- Author -->
              <footer class="testimonial-author">
                <div class="author-avatar">
                  <!-- IMAGE PLACEHOLDER: Avatar will go here -->
                  <span class="avatar-initials">{{
                    testimonial.avatarInitials
                  }}</span>
                </div>
                <div class="author-info">
                  <cite class="author-name">{{ testimonial.author }}</cite>
                  <span class="author-role">{{ testimonial.role }}</span>
                  <span class="author-company">{{ testimonial.company }}</span>
                </div>
              </footer>
            </article>
            }
          </div>
        </div>

        <button
          type="button"
          class="carousel-nav nav-next"
          (click)="nextSlide()"
          [disabled]="currentIndex() >= maxIndex()"
          aria-label="Next testimonial"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Dots Indicator -->
      <div
        class="carousel-dots"
        role="tablist"
        aria-label="Testimonial navigation"
      >
        @for (dot of dotsArray(); track $index) {
        <button
          type="button"
          role="tab"
          class="dot"
          [class.active]="$index === currentIndex()"
          (click)="goToSlide($index)"
          [attr.aria-selected]="$index === currentIndex()"
          [attr.aria-label]="'Go to testimonial ' + ($index + 1)"
        ></button>
        }
      </div>

      <!-- Trust Badges -->
      <div class="trust-badges" aria-label="Trust indicators">
        <div class="badge">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>Bank-Level Security</span>
        </div>
        <div class="badge">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>99.9% Uptime</span>
        </div>
        <div class="badge">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          <span>GDPR Compliant</span>
        </div>
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
      // Background
      // ============================================
      .section-bg {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .bg-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          rgba(30, 42, 58, 0.02) 0%,
          rgba(212, 168, 85, 0.05) 50%,
          rgba(30, 42, 58, 0.02) 100%
        );
      }

      // ============================================
      // Section Header
      // ============================================
      .section-header {
        position: relative;
        text-align: center;
        margin-block-end: var(--space-10);
        z-index: 1;
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
      // Stats Row
      // ============================================
      .stats-row {
        display: flex;
        justify-content: center;
        gap: var(--space-8);
        margin-block-end: var(--space-12);
        flex-wrap: wrap;

        @media (min-width: 48rem) {
          gap: var(--space-12);
        }
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-1);
      }

      .stat-value {
        font-family: var(--font-display);
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: var(--font-bold);
        color: var(--color-accent-dark);
        line-height: 1;
      }

      .stat-suffix {
        font-size: 0.6em;
        opacity: 0.8;
      }

      .stat-label {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        text-align: center;
      }

      // ============================================
      // Testimonials Carousel
      // ============================================
      .testimonials-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-4);
        margin-block-end: var(--space-8);
      }

      .carousel-nav {
        display: none;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-surface-muted);
        border-radius: var(--radius-full);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: all var(--transition-fast);
        flex-shrink: 0;

        @media (min-width: 48rem) {
          display: flex;
        }

        svg {
          width: 20px;
          height: 20px;
        }

        &:hover:not(:disabled) {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        [dir='rtl'] & svg {
          transform: scaleX(-1);
        }
      }

      .testimonials-container {
        flex: 1;
        overflow: hidden;
      }

      .testimonials-track {
        display: flex;
        gap: var(--space-6);
        transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }

      // ============================================
      // Testimonial Card
      // ============================================
      .testimonial-card {
        flex: 0 0 100%;
        min-width: 0;
        padding: var(--space-8);
        background: var(--color-surface-elevated);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        position: relative;

        @media (min-width: 48rem) {
          flex: 0 0 calc(50% - var(--space-3));
        }

        @media (min-width: 64rem) {
          flex: 0 0 calc(33.333% - var(--space-4));
        }
      }

      .quote-mark {
        position: absolute;
        inset-block-start: var(--space-6);
        inset-inline-end: var(--space-6);
        width: 48px;
        height: 48px;
        color: var(--color-accent);
        opacity: 0.15;

        svg {
          width: 100%;
          height: 100%;
        }
      }

      .rating {
        display: flex;
        gap: 2px;
        margin-block-end: var(--space-4);

        svg {
          width: 18px;
          height: 18px;
          color: var(--color-surface-muted);

          &.filled {
            color: var(--color-accent);
          }
        }
      }

      .testimonial-quote {
        font-size: var(--text-base);
        font-style: italic;
        color: var(--color-text-secondary);
        line-height: 1.7;
        margin-block-end: var(--space-6);
      }

      .testimonial-author {
        display: flex;
        align-items: center;
        gap: var(--space-4);
      }

      .author-avatar {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-full);
        background: linear-gradient(
          135deg,
          var(--color-primary) 0%,
          var(--color-primary-light) 100%
        );
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .avatar-initials {
        font-family: var(--font-display);
        font-size: var(--text-lg);
        font-weight: var(--font-bold);
        color: white;
      }

      .author-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .author-name {
        font-family: var(--font-display);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        font-style: normal;
        color: var(--color-text-primary);
      }

      .author-role {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      .author-company {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-accent-dark);
      }

      // ============================================
      // Carousel Dots
      // ============================================
      .carousel-dots {
        display: flex;
        justify-content: center;
        gap: var(--space-2);
        margin-block-end: var(--space-10);
      }

      .dot {
        width: 10px;
        height: 10px;
        padding: 0;
        background: var(--color-surface-muted);
        border: none;
        border-radius: var(--radius-full);
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          background: var(--color-text-muted);
        }

        &.active {
          width: 32px;
          background: linear-gradient(
            135deg,
            var(--color-accent) 0%,
            var(--color-secondary) 100%
          );
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      }

      // ============================================
      // Trust Badges
      // ============================================
      .trust-badges {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: var(--space-6);

        @media (min-width: 48rem) {
          gap: var(--space-10);
        }
      }

      .badge {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-muted);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);

        svg {
          width: 20px;
          height: 20px;
          color: var(--color-success);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialProofComponent {
  readonly currentIndex = signal(0);

  readonly testimonials: Testimonial[] = [
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
  ];

  readonly stats: Stat[] = [
    { value: '100', suffix: '+', label: 'Facilities' },
    { value: '10K', suffix: '+', label: 'Bookings Managed' },
    { value: '4.9', suffix: '/5', label: 'Average Rating' },
    { value: '99.9', suffix: '%', label: 'Uptime' },
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
