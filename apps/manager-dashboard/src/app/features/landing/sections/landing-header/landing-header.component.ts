import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageSwitcherComponent } from '../../../../shared/components/language-switcher/language-switcher.component';

interface NavItem {
  label: string;
  sectionId: string;
}

@Component({
  selector: 'app-landing-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LanguageSwitcherComponent],
  templateUrl: './landing-header.component.html',
  styleUrl: './landing-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeaderComponent {
  @Input() isScrolled = false;
  @Output() navigateToSection = new EventEmitter<string>();

  readonly mobileMenuOpen = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'Features', sectionId: 'features' },
    { label: 'How It Works', sectionId: 'how-it-works' },
    { label: 'Testimonials', sectionId: 'testimonials' },
  ];

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  onMobileNavClick(sectionId: string): void {
    this.mobileMenuOpen.set(false);
    this.navigateToSection.emit(sectionId);
  }
}
