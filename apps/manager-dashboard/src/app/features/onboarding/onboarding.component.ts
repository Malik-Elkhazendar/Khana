import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OnboardingRouteFacade } from './internal/onboarding.route-facade';

/**
 * Owner onboarding route shell. Business setup, facility bootstrap, and invite
 * workflows live in the route facade so the component stays focused on layout.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent extends OnboardingRouteFacade {}
