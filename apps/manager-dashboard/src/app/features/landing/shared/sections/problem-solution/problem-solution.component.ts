import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingProblemSolutionContent } from '../../content/landing-content.model';

@Component({
  selector: 'app-problem-solution-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './problem-solution.component.html',
  styleUrl: './problem-solution.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemSolutionSectionComponent {
  readonly content = input.required<LandingProblemSolutionContent>();
}
