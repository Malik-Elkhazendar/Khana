import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ComparisonItem {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-problem-solution',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-container">
      <!-- Section Header -->
      <header class="section-header">
        <span class="section-eyebrow">The Transformation</span>
        <h2 class="section-title">
          From <span class="text-chaos">Chaos</span> to
          <span class="text-control">Control</span>
        </h2>
        <p class="section-subtitle">
          See how facility managers across MENA are transforming their booking
          operations
        </p>
      </header>

      <!-- Comparison Grid -->
      <div class="comparison-grid">
        <!-- The Old Way -->
        <div class="comparison-card old-way">
          <div class="card-header">
            <div class="card-icon-container old">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4" />
                <circle cx="12" cy="17" r="1" />
              </svg>
            </div>
            <h3 class="card-title">The Old Way</h3>
            <span class="card-subtitle">WhatsApp & Paper</span>
          </div>

          <ul class="comparison-list" role="list">
            @for (item of oldWayItems; track item.text) {
            <li class="comparison-item negative">
              <span class="item-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </span>
              <span class="item-text">{{ item.text }}</span>
            </li>
            }
          </ul>

          <!-- Visual Chaos Indicator -->
          <div class="chaos-visual" aria-hidden="true">
            <div class="chaos-message msg-1">
              <span class="msg-time">9:45 AM</span>
              <span class="msg-text">Is Court 2 free tomorrow at 5?</span>
            </div>
            <div class="chaos-message msg-2">
              <span class="msg-time">9:47 AM</span>
              <span class="msg-text">Can I book Friday 6PM?</span>
            </div>
            <div class="chaos-message msg-3">
              <span class="msg-time">9:52 AM</span>
              <span class="msg-text">Still waiting for confirmation...</span>
            </div>
            <div class="chaos-overlay"></div>
          </div>
        </div>

        <!-- Divider -->
        <div class="comparison-divider" aria-hidden="true">
          <div class="divider-line"></div>
          <div class="divider-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div class="divider-line"></div>
        </div>

        <!-- The Khana Way -->
        <div class="comparison-card new-way">
          <div class="card-header">
            <div class="card-icon-container new">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <h3 class="card-title">The Khana Way</h3>
            <span class="card-subtitle">Real-Time Control</span>
          </div>

          <ul class="comparison-list" role="list">
            @for (item of newWayItems; track item.text) {
            <li class="comparison-item positive">
              <span class="item-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </span>
              <span class="item-text">{{ item.text }}</span>
            </li>
            }
          </ul>

          <!-- Visual Success Indicator -->
          <div class="success-visual" aria-hidden="true">
            <div class="success-card">
              <div class="success-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 12l2 2 4-4" />
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                </svg>
              </div>
              <div class="success-content">
                <span class="success-title">Booking Confirmed</span>
                <span class="success-detail">Instantly, no waiting</span>
              </div>
            </div>
            <div class="success-glow"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Image Placeholder -->
      <div class="comparison-image-container">
        <div class="comparison-image-wrapper">
          <img
            src="assets/images/landing/problem_solution_comparison.png"
            alt="Before and after comparison showing transformation from WhatsApp chaos to Khana's organized dashboard"
            class="comparison-image"
            width="1200"
            height="675"
          />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .section-container {
        padding: var(--space-16) var(--space-4);
        max-width: 80rem;
        margin: 0 auto;

        @media (min-width: 64rem) {
          padding: calc(var(--space-16) * 1.5) var(--space-8);
        }
      }

      // ============================================
      // Section Header
      // ============================================
      .section-header {
        text-align: center;
        margin-block-end: var(--space-12);
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

      .text-chaos {
        color: var(--color-error);
        position: relative;

        &::after {
          content: '';
          position: absolute;
          inset-inline: 0;
          inset-block-end: 0.1em;
          height: 3px;
          background: var(--color-error);
          opacity: 0.3;
          border-radius: var(--radius-full);
        }
      }

      .text-control {
        background: linear-gradient(
          135deg,
          var(--color-success) 0%,
          #1f6357 100%
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
      }

      // ============================================
      // Comparison Grid
      // ============================================
      .comparison-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-6);
        margin-block-end: var(--space-12);

        @media (min-width: 64rem) {
          grid-template-columns: 1fr auto 1fr;
          gap: var(--space-8);
          align-items: stretch;
        }
      }

      // ============================================
      // Comparison Cards
      // ============================================
      .comparison-card {
        position: relative;
        padding: var(--space-8);
        border-radius: var(--radius-xl);
        overflow: hidden;
      }

      .old-way {
        background: linear-gradient(
          135deg,
          rgba(196, 69, 54, 0.05) 0%,
          rgba(196, 69, 54, 0.02) 100%
        );
        border: 1px solid rgba(196, 69, 54, 0.15);
      }

      .new-way {
        background: linear-gradient(
          135deg,
          rgba(45, 125, 111, 0.05) 0%,
          rgba(45, 125, 111, 0.02) 100%
        );
        border: 1px solid rgba(45, 125, 111, 0.15);
      }

      .card-header {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
        margin-block-end: var(--space-6);
      }

      .card-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: var(--radius-lg);

        svg {
          width: 24px;
          height: 24px;
        }

        &.old {
          background: rgba(196, 69, 54, 0.1);
          color: var(--color-error);
        }

        &.new {
          background: rgba(45, 125, 111, 0.1);
          color: var(--color-success);
        }
      }

      .card-title {
        font-family: var(--font-display);
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
      }

      .card-subtitle {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      // ============================================
      // Comparison List
      // ============================================
      .comparison-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .comparison-item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
      }

      .item-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: var(--radius-full);
        flex-shrink: 0;
        margin-block-start: 2px;

        svg {
          width: 14px;
          height: 14px;
        }

        .negative & {
          background: rgba(196, 69, 54, 0.15);
          color: var(--color-error);
        }

        .positive & {
          background: rgba(45, 125, 111, 0.15);
          color: var(--color-success);
        }
      }

      .item-text {
        font-size: var(--text-base);
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      // ============================================
      // Chaos Visual
      // ============================================
      .chaos-visual {
        position: relative;
        margin-block-start: var(--space-8);
        padding: var(--space-4);
        background: rgba(196, 69, 54, 0.03);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .chaos-message {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-3);
        background: white;
        border-radius: var(--radius-md);
        margin-block-end: var(--space-2);
        opacity: 0.7;
        transform: rotate(-1deg);

        &.msg-2 {
          transform: rotate(0.5deg);
          opacity: 0.5;
        }

        &.msg-3 {
          transform: rotate(-0.5deg);
          opacity: 0.3;
        }
      }

      .msg-time {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .msg-text {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .chaos-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          transparent 0%,
          rgba(196, 69, 54, 0.05) 100%
        );
        pointer-events: none;
      }

      // ============================================
      // Success Visual
      // ============================================
      .success-visual {
        position: relative;
        margin-block-start: var(--space-8);
        padding: var(--space-4);
        background: rgba(45, 125, 111, 0.03);
        border-radius: var(--radius-lg);
      }

      .success-card {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-4);
        background: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
      }

      .success-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: linear-gradient(
          135deg,
          var(--color-success) 0%,
          #1f6357 100%
        );
        border-radius: var(--radius-md);
        color: white;

        svg {
          width: 24px;
          height: 24px;
        }
      }

      .success-content {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .success-title {
        font-family: var(--font-display);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      .success-detail {
        font-size: var(--text-sm);
        color: var(--color-success);
      }

      .success-glow {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: 50%;
        width: 200px;
        height: 200px;
        background: radial-gradient(
          circle,
          rgba(45, 125, 111, 0.15) 0%,
          transparent 70%
        );
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      // ============================================
      // Divider
      // ============================================
      .comparison-divider {
        display: none;

        @media (min-width: 64rem) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          padding-block: var(--space-12);
        }
      }

      .divider-line {
        flex: 1;
        width: 2px;
        background: linear-gradient(
          180deg,
          transparent 0%,
          var(--color-accent) 50%,
          transparent 100%
        );
      }

      .divider-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: linear-gradient(
          135deg,
          var(--color-accent) 0%,
          var(--color-secondary) 100%
        );
        border-radius: var(--radius-full);
        color: white;
        box-shadow: 0 4px 20px rgba(212, 168, 85, 0.3),
          0 0 0 4px rgba(212, 168, 85, 0.1);

        svg {
          width: 24px;
          height: 24px;
        }

        [dir='rtl'] & svg {
          transform: scaleX(-1);
        }
      }

      // ============================================
      // Image Placeholder
      // ============================================
      .comparison-image-container {
        max-width: 1000px;
        margin-inline: auto;
      }

      .comparison-image {
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
        border-radius: var(--radius-xl);
        display: block;
        box-shadow: var(--shadow-2xl);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemSolutionComponent {
  readonly oldWayItems: ComparisonItem[] = [
    { icon: 'cross', text: 'Endless WhatsApp messages to check availability' },
    { icon: 'cross', text: 'Paper calendars with crossed-out bookings' },
    { icon: 'cross', text: 'Phone tag just to confirm a slot' },
    { icon: 'cross', text: 'Double-bookings that embarrass your business' },
    { icon: 'cross', text: 'No visibility into revenue or patterns' },
  ];

  readonly newWayItems: ComparisonItem[] = [
    { icon: 'check', text: 'Instant availability visible to everyone' },
    { icon: 'check', text: 'Digital calendar synced across all devices' },
    { icon: 'check', text: 'Automatic confirmations in seconds' },
    { icon: 'check', text: 'Smart conflict detection prevents overlaps' },
    { icon: 'check', text: 'Complete analytics and revenue tracking' },
  ];
}
