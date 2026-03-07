import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageSwitcherComponent } from '../../../../../shared/components/language-switcher/language-switcher.component';
import {
  LandingHeaderContent,
  LandingLanguage,
} from '../../content/landing-content.model';

@Component({
  selector: 'app-landing-header-section',
  standalone: true,
  imports: [CommonModule, RouterModule, LanguageSwitcherComponent],
  templateUrl: './landing-header.component.html',
  styleUrl: './landing-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeaderSectionComponent {
  readonly content = input.required<LandingHeaderContent>();
  readonly locale = input.required<LandingLanguage>();
  readonly isScrolled = input(false);

  @Output() readonly navigateToSection = new EventEmitter<string>();

  readonly mobileMenuOpen = signal(false);
  readonly homeRoute = computed(() => (this.locale() === 'ar' ? '/ar' : '/'));

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  onMobileNavClick(sectionId: string): void {
    this.mobileMenuOpen.set(false);
    this.navigateToSection.emit(sectionId);
  }

  navItemAriaLabel(label: string): string {
    return this.locale() === 'ar'
      ? `انتقل إلى قسم ${label}`
      : `Navigate to ${label} section`;
  }
}
