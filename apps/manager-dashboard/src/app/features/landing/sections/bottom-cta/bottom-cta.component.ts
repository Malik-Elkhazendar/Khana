import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../../environments/environment';

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
  selector: 'app-bottom-cta',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-cta.component.html',
  styleUrl: './bottom-cta.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomCtaComponent {
  private readonly salesEmail = environment.marketing.salesEmail;

  readonly headlinePrefix = 'Ready to Eliminate';
  readonly headlineAccent = 'Booking Chaos?';
  readonly subheadline =
    'Join 100+ facilities across MENA who have transformed their booking operations. Start your free trial today and see the difference in minutes.';

  readonly primaryActionLabel = 'Start Your Free Trial';
  readonly primaryActionAriaLabel = 'Start your free trial';

  readonly secondaryActions: SecondaryAction[] = [
    {
      id: 'demo',
      label: 'Schedule a Demo',
      ariaLabel: 'Schedule a demo with sales',
      href: this.createSalesMailto('Schedule a Demo'),
    },
    {
      id: 'sales',
      label: 'Contact Sales',
      ariaLabel: 'Contact sales team',
      href: this.createSalesMailto('Contact Sales'),
    },
  ];

  readonly trustItems: TrustItem[] = [
    { id: 'no-card', label: 'No credit card required' },
    { id: 'trial', label: '14-day free trial' },
    { id: 'cancel', label: 'Cancel anytime' },
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
