import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

@Component({
  selector: 'app-landing-footer-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="landing-footer" role="contentinfo">
      <div class="footer-container">
        <!-- Footer Top -->
        <div class="footer-top">
          <!-- Brand Column -->
          <div class="footer-brand">
            <a
              routerLink="/ar"
              class="footer-logo"
              aria-label="خانة - الصفحة الرئيسية"
            >
              <span class="logo-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path
                    d="M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span class="logo-text">Khana</span>
              <span class="logo-arabic">خانة</span>
            </a>

            <p class="footer-tagline">
              نظام التشغيل لعمليات الحجز المحلية. اقضِ على الفوضى. اسعد
              بالعملاء.
            </p>

            <!-- Social Links -->
            <div class="social-links" aria-label="روابط وسائل التواصل">
              <a href="#" class="social-link" aria-label="تابعنا على تويتر/إكس">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  />
                </svg>
              </a>
              <a href="#" class="social-link" aria-label="تابعنا على لينكدإن">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                  />
                </svg>
              </a>
              <a href="#" class="social-link" aria-label="تابعنا على إنستغرام">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
                  />
                </svg>
              </a>
            </div>
          </div>

          <!-- Navigation Columns -->
          @for (section of footerSections; track section.title) {
          <nav class="footer-nav" [attr.aria-label]="'تنقل ' + section.title">
            <h3 class="nav-title">{{ section.title }}</h3>
            <ul class="nav-list" role="list">
              @for (link of section.links; track link.label) {
              <li>
                <a [href]="link.href" class="nav-link">
                  {{ link.label }}
                </a>
              </li>
              }
            </ul>
          </nav>
          }
        </div>

        <!-- Footer Bottom -->
        <div class="footer-bottom">
          <p class="copyright">
            &copy; {{ currentYear }} خانة. جميع الحقوق محفوظة.
          </p>

          <div class="footer-legal">
            <a href="#">سياسة الخصوصية</a>
            <span class="divider" aria-hidden="true">&bull;</span>
            <a href="#">شروط الخدمة</a>
            <span class="divider" aria-hidden="true">&bull;</span>
            <a href="#">سياسة ملفات الارتباط</a>
          </div>

          <div class="language-selector">
            <a
              routerLink="/"
              class="language-btn"
              aria-label="التبديل إلى الإنجليزية"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path
                  d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                />
              </svg>
              <span>English</span>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                class="chevron"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      .landing-footer {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        padding: var(--space-12) var(--space-4);

        @media (min-width: 64rem) {
          padding: var(--space-16) var(--space-8);
        }
      }

      .footer-container {
        max-width: 80rem;
        margin: 0 auto;
      }

      // ============================================
      // Footer Top
      // ============================================
      .footer-top {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-10);
        padding-block-end: var(--space-10);
        border-block-end: 1px solid rgba(250, 248, 245, 0.1);

        @media (min-width: 48rem) {
          grid-template-columns: repeat(2, 1fr);
        }

        @media (min-width: 64rem) {
          grid-template-columns: 2fr repeat(4, 1fr);
          gap: var(--space-8);
        }
      }

      // ============================================
      // Footer Brand
      // ============================================
      .footer-brand {
        @media (min-width: 48rem) {
          grid-column: span 2;
        }

        @media (min-width: 64rem) {
          grid-column: span 1;
        }
      }

      .footer-logo {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        text-decoration: none;
        margin-block-end: var(--space-4);
        transition: opacity var(--transition-fast);

        &:hover {
          opacity: 0.8;
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
        width: 36px;
        height: 36px;
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        border-radius: var(--radius-md);

        svg {
          width: 20px;
          height: 20px;
          color: white;
        }
      }

      .logo-text {
        font-family: var(--font-display);
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--color-text-inverse);
      }

      .logo-arabic {
        font-size: var(--text-lg);
        color: rgba(250, 248, 245, 0.6);
      }

      .footer-tagline {
        font-size: var(--text-sm);
        color: rgba(250, 248, 245, 0.7);
        line-height: 1.7;
        margin-block-end: var(--space-6);
        max-width: 280px;
      }

      // ============================================
      // Social Links
      // ============================================
      .social-links {
        display: flex;
        gap: var(--space-3);
      }

      .social-link {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: rgba(250, 248, 245, 0.1);
        border-radius: var(--radius-md);
        color: var(--color-text-inverse);
        transition: all var(--transition-fast);

        svg {
          width: 18px;
          height: 18px;
        }

        &:hover {
          background: var(--color-accent);
          color: var(--color-primary);
          transform: translateY(-2px);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      }

      // ============================================
      // Footer Navigation
      // ============================================
      .footer-nav {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .nav-title {
        font-family: var(--font-display);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-inverse);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .nav-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .nav-link {
        font-size: var(--text-sm);
        color: rgba(250, 248, 245, 0.7);
        text-decoration: none;
        transition: color var(--transition-fast);

        &:hover {
          color: var(--color-accent);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }
      }

      // ============================================
      // Footer Bottom
      // ============================================
      .footer-bottom {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
        padding-block-start: var(--space-8);
        text-align: center;

        @media (min-width: 64rem) {
          flex-direction: row;
          justify-content: space-between;
          text-align: start;
        }
      }

      .copyright {
        font-size: var(--text-sm);
        color: rgba(250, 248, 245, 0.5);
      }

      .footer-legal {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        font-size: var(--text-sm);

        a {
          color: rgba(250, 248, 245, 0.6);
          text-decoration: none;
          transition: color var(--transition-fast);

          &:hover {
            color: var(--color-accent);
          }

          &:focus-visible {
            outline: 2px solid var(--color-accent);
            outline-offset: 2px;
            border-radius: var(--radius-sm);
          }
        }

        .divider {
          color: rgba(250, 248, 245, 0.3);
        }
      }

      .language-selector {
        position: relative;
      }

      .language-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: rgba(250, 248, 245, 0.1);
        border: 1px solid rgba(250, 248, 245, 0.2);
        border-radius: var(--radius-md);
        color: var(--color-text-inverse);
        font-size: var(--text-sm);
        cursor: pointer;
        transition: all var(--transition-fast);

        svg {
          width: 16px;
          height: 16px;
        }

        .chevron {
          width: 14px;
          height: 14px;
          opacity: 0.6;
        }

        &:hover {
          background: rgba(250, 248, 245, 0.15);
          border-color: rgba(250, 248, 245, 0.3);
        }

        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFooterArComponent {
  readonly currentYear = new Date().getFullYear();

  readonly footerSections: FooterSection[] = [
    {
      title: 'المنتج',
      links: [
        { label: 'الميزات', href: '#features' },
        { label: 'الأسعار', href: '#' },
        { label: 'خارطة الطريق', href: '#' },
        { label: 'سجل التحديثات', href: '#' },
      ],
    },
    {
      title: 'الشركة',
      links: [
        { label: 'من نحن', href: '#' },
        { label: 'المدونة', href: '#' },
        { label: 'الوظائف', href: '#' },
        { label: 'الصحافة', href: '#' },
      ],
    },
    {
      title: 'الدعم',
      links: [
        { label: 'مركز المساعدة', href: '#' },
        { label: 'تواصل معنا', href: '#' },
        { label: 'الحالة', href: '#' },
        { label: 'وثائق API', href: '#' },
      ],
    },
    {
      title: 'القانوني',
      links: [
        { label: 'الخصوصية', href: '#' },
        { label: 'الشروط', href: '#' },
        { label: 'الأمان', href: '#' },
        { label: 'GDPR', href: '#' },
      ],
    },
  ];
}
