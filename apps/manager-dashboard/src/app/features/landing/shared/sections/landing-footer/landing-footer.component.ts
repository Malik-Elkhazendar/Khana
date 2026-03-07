import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  getLandingFooterLinks,
  LandingFooterLinksConfig,
  LandingLocale,
} from '../../../../../shared/navigation/landing-links';
import { LandingFooterContent } from '../../content/landing-content.model';

@Component({
  selector: 'app-landing-footer-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing-footer.component.html',
  styleUrl: './landing-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFooterSectionComponent {
  readonly content = input.required<LandingFooterContent>();
  readonly locale = input.required<LandingLocale>();

  readonly currentYear = new Date().getFullYear();
  readonly links = computed<LandingFooterLinksConfig>(() =>
    getLandingFooterLinks(this.locale())
  );
  readonly homeRoute = computed(() => (this.locale() === 'ar' ? '/ar' : '/'));
  readonly alternateRoute = computed(() =>
    this.locale() === 'ar' ? '/' : '/ar'
  );

  footerSectionAriaLabel(title: string): string {
    return this.locale() === 'ar' && this.content().footerSectionAriaPrefix
      ? `${this.content().footerSectionAriaPrefix}${title}`
      : `${title} navigation`;
  }
}
