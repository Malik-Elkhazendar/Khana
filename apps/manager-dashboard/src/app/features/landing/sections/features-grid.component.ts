import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Inject,
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
  selector: 'app-features-grid',
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
        <span class="section-eyebrow">Powerful Features</span>
        <h2 class="section-title">
          Everything You Need to
          <span class="text-gradient">Run Your Business</span>
        </h2>
        <p class="section-subtitle">
          From real-time availability to smart analytics, Khana gives you the
          tools to eliminate chaos and delight your customers.
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
              [attr.aria-label]="'Learn more about ' + feature.title"
            >
              <span>Learn more</span>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </a>
          </div>

          <!-- Feature Image -->
          <div class="feature-image-wrapper">
            <img
              [src]="feature.image"
              [alt]="feature.title + ' feature screenshot'"
              class="feature-image"
              width="600"
              height="375"
              loading="lazy"
            />
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
            transform: translateX(4px);
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
        }

        &:hover {
          color: var(--color-secondary);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 4px;
          border-radius: var(--radius-sm);
        }

        [dir='rtl'] & svg {
          transform: scaleX(-1);
        }

        [dir='rtl'] &:hover svg {
          transform: scaleX(-1) translateX(4px);
        }
      }

      // ============================================
      // Image Placeholder
      // ============================================
      .feature-image-wrapper {
        position: relative;
        margin-block-start: var(--space-5);
        aspect-ratio: 16 / 10;
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-md);
      }

      .feature-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }

      .feature-card:hover .feature-image {
        transform: scale(1.05);
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
export class FeaturesGridComponent implements AfterViewInit, OnDestroy {
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
      title: 'Real-Time Calendar',
      description:
        'No more "let me check and get back to you." Your calendar updates instantly across all devices, showing live availability.',
      gradient: 'linear-gradient(135deg, #2d7d6f 0%, #1f6357 100%)',
      image: 'assets/images/landing/feature_realtime_calendar.png',
    },
    {
      id: 'conflict-detection',
      icon: 'shield',
      title: 'Zero Double-Bookings',
      description:
        'Our smart system automatically detects and prevents overlapping bookings before they happen. Never disappoint a customer again.',
      gradient: 'linear-gradient(135deg, #c75d4a 0%, #a84a39 100%)',
      image: 'assets/images/landing/feature_zero_double_bookings.png',
    },
    {
      id: 'mobile-first',
      icon: 'mobile',
      title: 'Mobile-First Design',
      description:
        'Check-in customers, view bookings, update availability—all from your mobile device. Manage your business from anywhere.',
      gradient: 'linear-gradient(135deg, #d4a855 0%, #b8923f 100%)',
      image: 'assets/images/landing/feature_mobile_first.png',
    },
    {
      id: 'customer-history',
      icon: 'users',
      title: 'Know Your Customers',
      description:
        'Track booking history, preferences, and payment status. Build lasting relationships, not just one-time transactions.',
      gradient: 'linear-gradient(135deg, #5b8def 0%, #4a7bdc 100%)',
      image: 'assets/images/landing/feature_know_your_customers.png',
    },
    {
      id: 'smart-pricing',
      icon: 'chart',
      title: 'Dynamic Pricing',
      description:
        'Set peak and off-peak rates, create promo codes, and maximize revenue during high-demand periods automatically.',
      gradient: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
      image: 'assets/images/landing/feature_dynamic_pricing.png',
    },
    {
      id: 'security',
      icon: 'lock',
      title: 'Bank-Level Security',
      description:
        'GDPR-compliant data handling, role-based permissions, and complete audit trails. Your data is safe with us.',
      gradient: 'linear-gradient(135deg, #1e2a3a 0%, #2d3f54 100%)',
      image: 'assets/images/landing/feature_bank_level_security.png',
    },
  ];
}
