import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  LandingHowItWorksContent,
  LandingLanguage,
} from '../../content/landing-content.model';

@Component({
  selector: 'app-how-it-works-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksSectionComponent {
  readonly content = input.required<LandingHowItWorksContent>();
  readonly locale = input.required<LandingLanguage>();

  stepAriaLabel(stepNumber: number, title: string): string {
    return this.locale() === 'ar'
      ? `الخطوة ${stepNumber}: ${title}`
      : `Step ${stepNumber}: ${title}`;
  }
}
