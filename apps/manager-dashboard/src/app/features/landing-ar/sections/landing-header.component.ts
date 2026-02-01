import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface NavItem {
  label: string;
  sectionId: string;
}

@Component({
  selector: 'app-landing-header-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="landing-header" [class.scrolled]="isScrolled" role="banner">
      <div class="header-container">
        <!-- Logo -->
        <a routerLink="/ar" class="logo" aria-label="خانة - الصفحة الرئيسية">
          <span class="logo-mark">
            <!-- 8-point star SVG icon -->
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span class="logo-text">Khana</span>
          <span class="logo-arabic">خانة</span>
        </a>

        <!-- Desktop Navigation -->
        <nav class="nav-desktop" aria-label="التنقل الرئيسي">
          <ul class="nav-list" role="list">
            @for (item of navItems; track item.sectionId) {
            <li>
              <button
                type="button"
                class="nav-link"
                (click)="navigateToSection.emit(item.sectionId)"
                [attr.aria-label]="'انتقل إلى قسم ' + item.label"
              >
                {{ item.label }}
              </button>
            </li>
            }
          </ul>
        </nav>

        <!-- CTA Buttons -->
        <div class="header-actions">
          <a
            routerLink="/bookings"
            class="btn btn-ghost"
            aria-label="تسجيل الدخول إلى حسابك"
          >
            تسجيل الدخول
          </a>
          <a
            routerLink="/bookings"
            class="btn btn-primary"
            aria-label="ابدأ محاولتك المجانية"
          >
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
          </a>
          <a
            routerLink="/"
            class="btn btn-ghost btn-icon-only"
            aria-label="التبديل إلى الإنجليزية - Switch to English"
            title="English"
          >
            <span class="lang-icon">EN</span>
          </a>
        </div>

        <!-- Mobile Menu Button -->
        <button
          type="button"
          class="mobile-menu-btn"
          (click)="toggleMobileMenu()"
          [attr.aria-expanded]="mobileMenuOpen()"
          aria-controls="mobile-menu"
          aria-label="تبديل قائمة التنقل"
        >
          <span class="hamburger" [class.open]="mobileMenuOpen()">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>

      <!-- Mobile Menu -->
      <nav
        id="mobile-menu"
        class="nav-mobile"
        [class.open]="mobileMenuOpen()"
        [attr.aria-hidden]="!mobileMenuOpen()"
        aria-label="تنقل الهاتف المحمول"
      >
        <ul class="mobile-nav-list" role="list">
          @for (item of navItems; track item.sectionId) {
          <li>
            <button
              type="button"
              class="mobile-nav-link"
              (click)="onMobileNavClick(item.sectionId)"
              [attr.aria-label]="'انتقل إلى قسم ' + item.label"
            >
              {{ item.label }}
            </button>
          </li>
          }
          <li class="mobile-cta">
            <a
              routerLink="/bookings"
              class="btn btn-primary btn-block"
              (click)="mobileMenuOpen.set(false)"
            >
              ابدأ محاولتك المجانية
            </a>
          </li>
        </ul>
      </nav>
    </header>
  `,
  styles: [
    `
      .landing-header {
        position: fixed;
        inset-block-start: 0;
        inset-inline: 0;
        z-index: 100;
        padding: var(--space-4);
        transition: all var(--transition-base);

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background: transparent;
          backdrop-filter: blur(0);
          -webkit-backdrop-filter: blur(0);
          transition: all var(--transition-base);
          z-index: -1;
        }

        &.scrolled {
          padding: var(--space-3) var(--space-4);

          &::before {
            background: rgba(30, 42, 58, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
          }

          .logo-text,
          .logo-arabic {
            color: var(--color-text-inverse);
          }

          .nav-link {
            color: var(--color-text-inverse);

            &:hover {
              color: var(--color-accent);
            }
          }

          .btn-ghost {
            color: var(--color-text-inverse);
            border-color: rgba(250, 248, 245, 0.3);

            &:hover {
              background: rgba(250, 248, 245, 0.1);
              border-color: var(--color-text-inverse);
            }
          }
        }
      }

      .header-container {
        max-width: 80rem;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-6);
      }

      // Logo
      .logo {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        text-decoration: none;
        transition: transform var(--transition-fast);

        &:hover {
          transform: scale(1.02);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 4px;
          border-radius: var(--radius-sm);
        }
      }

      .logo-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        border-radius: var(--radius-md);
        color: white;

        svg {
          width: 24px;
          height: 24px;
          animation: pulse-soft 3s ease-in-out infinite;
        }
      }

      .logo-text {
        font-family: var(--font-display);
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
        transition: color var(--transition-base);
      }

      .logo-arabic {
        font-size: var(--text-lg);
        color: var(--color-text-secondary);
        opacity: 0.7;
        transition: color var(--transition-base);
      }

      // Desktop Navigation
      .nav-desktop {
        display: none;

        @media (min-width: 64rem) {
          display: block;
        }
      }

      .nav-list {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        list-style: none;
      }

      .nav-link {
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text-secondary);
        background: none;
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          color: var(--color-accent);
          background: rgba(212, 168, 85, 0.08);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      }

      // Header Actions
      .header-actions {
        display: none;
        align-items: center;
        gap: var(--space-3);

        @media (min-width: 48rem) {
          display: flex;
        }
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5);
        font-family: var(--font-display);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        text-decoration: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
        white-space: nowrap;
      }

      .btn-icon-only {
        padding: var(--space-2) var(--space-3);
        min-width: 48px;

        .lang-icon {
          font-size: var(--text-base);
          font-weight: var(--font-bold);
        }
      }

      .btn-ghost {
        background: transparent;
        color: var(--color-text-primary);
        border: 1px solid var(--color-text-muted);

        &:hover {
          background: rgba(30, 42, 58, 0.05);
          border-color: var(--color-text-primary);
        }
      }

      .btn-primary {
        background: linear-gradient(
          135deg,
          var(--color-secondary) 0%,
          var(--color-secondary-dark) 100%
        );
        color: white;
        border: none;
        box-shadow: 0 4px 14px rgba(199, 93, 74, 0.35),
          0 0 0 0 rgba(199, 93, 74, 0);
        position: relative;
        overflow: hidden;

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
          transition: opacity var(--transition-fast);
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(199, 93, 74, 0.4),
            0 0 0 0 rgba(199, 93, 74, 0);

          &::before {
            opacity: 1;
          }
        }

        .btn-text,
        .btn-icon {
          position: relative;
          z-index: 1;
        }

        .btn-icon {
          width: 16px;
          height: 16px;
          transition: transform var(--transition-fast);
          transform: scaleX(-1);

          svg {
            width: 100%;
            height: 100%;
          }
        }

        &:hover .btn-icon {
          transform: scaleX(-1) translateX(4px);
        }
      }

      // Mobile Menu Button
      .mobile-menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;

        @media (min-width: 64rem) {
          display: none;
        }
      }

      .hamburger {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        width: 24px;
        height: 24px;

        span {
          display: block;
          width: 100%;
          height: 2px;
          background: var(--color-text-primary);
          border-radius: 1px;
          transition: all var(--transition-fast);
          transform-origin: center;
        }

        &.open {
          span:nth-child(1) {
            transform: translateY(7px) rotate(45deg);
          }
          span:nth-child(2) {
            opacity: 0;
            transform: scaleX(0);
          }
          span:nth-child(3) {
            transform: translateY(-7px) rotate(-45deg);
          }
        }
      }

      .scrolled .hamburger span {
        background: var(--color-text-inverse);
      }

      // Mobile Navigation
      .nav-mobile {
        position: absolute;
        inset-block-start: 100%;
        inset-inline: 0;
        background: var(--color-surface-elevated);
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: 0;
        max-height: 0;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0;

        &.open {
          max-height: 400px;
          padding: var(--space-4);
          opacity: 1;
        }

        @media (min-width: 64rem) {
          display: none;
        }
      }

      .mobile-nav-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .mobile-nav-link {
        display: block;
        width: 100%;
        padding: var(--space-3) var(--space-4);
        font-size: var(--text-base);
        font-weight: var(--font-medium);
        color: var(--color-text-primary);
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        text-align: start;
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          background: var(--color-surface-muted);
          color: var(--color-accent-dark);
        }
      }

      .mobile-cta {
        margin-block-start: var(--space-4);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-surface-muted);
      }

      .btn-block {
        width: 100%;
      }

      // Animation keyframes
      @keyframes pulse-soft {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.8;
          transform: scale(0.95);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeaderArComponent {
  @Input() isScrolled = false;
  @Output() navigateToSection = new EventEmitter<string>();

  readonly mobileMenuOpen = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'الميزات', sectionId: 'features' },
    { label: 'كيف تعمل', sectionId: 'how-it-works' },
    { label: 'آراء العملاء', sectionId: 'testimonials' },
  ];

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  onMobileNavClick(sectionId: string): void {
    this.mobileMenuOpen.set(false);
    this.navigateToSection.emit(sectionId);
  }
}
