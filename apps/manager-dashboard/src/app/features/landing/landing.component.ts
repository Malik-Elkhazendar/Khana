import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingPageComponent } from './shared/landing-page.component';
import { LANDING_CONTENT_EN } from './shared/content/landing-content.en';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [LandingPageComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  readonly content = LANDING_CONTENT_EN;
}
