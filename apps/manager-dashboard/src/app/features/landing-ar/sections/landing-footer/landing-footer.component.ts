import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  getLandingFooterLinks,
  LandingFooterSection,
  LandingLegalLinks,
  LandingSocialLinks,
} from '../../../../shared/navigation/landing-links';

@Component({
  selector: 'app-landing-footer-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing-footer.component.html',
  styleUrl: './landing-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFooterArComponent {
  readonly currentYear = new Date().getFullYear();
  private readonly links = getLandingFooterLinks('ar');
  readonly socialLinks: LandingSocialLinks = this.links.socialLinks;
  readonly legalLinks: LandingLegalLinks = this.links.legalLinks;
  readonly footerSections: LandingFooterSection[] = this.links.footerSections;
}
