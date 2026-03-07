import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  LandingHeroContent,
  LandingLanguage,
} from '../../content/landing-content.model';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSectionComponent {
  readonly content = input.required<LandingHeroContent>();
  readonly locale = input.required<LandingLanguage>();
  readonly scrollY = input(0);

  @Output() readonly navigateToSection = new EventEmitter<string>();

  readonly parallaxOffset = computed(() => this.scrollY() * -0.3);

  readonly stars = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16 + Math.random() * 32,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 4,
  }));
}
