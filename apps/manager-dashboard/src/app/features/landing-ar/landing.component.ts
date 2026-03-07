import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingPageComponent } from '../landing/shared/landing-page.component';
import { LANDING_CONTENT_AR } from '../landing/shared/content/landing-content.ar';

@Component({
  selector: 'app-landing-ar',
  standalone: true,
  imports: [LandingPageComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingArabicComponent {
  readonly content = LANDING_CONTENT_AR;
}
