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
  selector: 'app-landing-header-ar',
  standalone: true,
  imports: [CommonModule, RouterModule, LanguageSwitcherComponent],
  templateUrl: './landing-header.component.html',
  styleUrl: './landing-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeaderArComponent {
  @Input() isScrolled = false;
  @Output() navigateToSection = new EventEmitter<string>();

  readonly mobileMenuOpen = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'الميزات', sectionId: 'features' },
    { label: 'كيف تعمل', sectionId: 'how-it-works' },
    { label: 'آراء العملاء', sectionId: 'testimonials' },
  ];

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  onMobileNavClick(sectionId: string): void {
    this.mobileMenuOpen.set(false);
    this.navigateToSection.emit(sectionId);
  }
}
