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
  templateUrl: './features-grid.component.html',
  styleUrl: './features-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesGridComponent implements AfterViewInit, OnDestroy {
  @ViewChild('grid') grid!: ElementRef<HTMLElement>;

  private observer: IntersectionObserver | undefined;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly el = inject(ElementRef);
  readonly learnMoreHref = '#how-it-works';

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
      image: 'assets/images/landing/feature_realtime_calendar.png?v=3',
    },
    {
      id: 'conflict-detection',
      icon: 'shield',
      title: 'Zero Double-Bookings',
      description:
        'Our smart system automatically detects and prevents overlapping bookings before they happen. Never disappoint a customer again.',
      gradient: 'linear-gradient(135deg, #c75d4a 0%, #a84a39 100%)',
      image: 'assets/images/landing/feature_zero_double_bookings.png?v=3',
    },
    {
      id: 'mobile-first',
      icon: 'mobile',
      title: 'Mobile-First Design',
      description:
        'Check-in customers, view bookings, update availability—all from your mobile device. Manage your business from anywhere.',
      gradient: 'linear-gradient(135deg, #d4a855 0%, #b8923f 100%)',
      image: 'assets/images/landing/feature_mobile_first.png?v=3',
    },
    {
      id: 'customer-history',
      icon: 'users',
      title: 'Know Your Customers',
      description:
        'Track booking history, preferences, and payment status. Build lasting relationships, not just one-time transactions.',
      gradient: 'linear-gradient(135deg, #5b8def 0%, #4a7bdc 100%)',
      image: 'assets/images/landing/feature_know_your_customers.png?v=3',
    },
    {
      id: 'smart-pricing',
      icon: 'chart',
      title: 'Dynamic Pricing',
      description:
        'Set peak and off-peak rates, create promo codes, and maximize revenue during high-demand periods automatically.',
      gradient: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
      image: 'assets/images/landing/feature_dynamic_pricing.png?v=3',
    },
    {
      id: 'security',
      icon: 'lock',
      title: 'Bank-Level Security',
      description:
        'GDPR-compliant data handling, role-based permissions, and complete audit trails. Your data is safe with us.',
      gradient: 'linear-gradient(135deg, #1e2a3a 0%, #2d3f54 100%)',
      image: 'assets/images/landing/feature_bank_level_security.png?v=3',
    },
  ];
}
