import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  signal,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LandingHeaderArComponent } from './sections/landing-header/landing-header.component';
import { HeroSectionArComponent } from './sections/hero-section/hero-section.component';
import { ProblemSolutionArComponent } from './sections/problem-solution/problem-solution.component';
import { FeaturesGridArComponent } from './sections/features-grid/features-grid.component';
import { HowItWorksArComponent } from './sections/how-it-works/how-it-works.component';
import { SocialProofArComponent } from './sections/social-proof/social-proof.component';
import { BottomCtaArComponent } from './sections/bottom-cta/bottom-cta.component';
import { LandingFooterArComponent } from './sections/landing-footer/landing-footer.component';

@Component({
  selector: 'app-landing-ar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LandingHeaderArComponent,
    HeroSectionArComponent,
    ProblemSolutionArComponent,
    FeaturesGridArComponent,
    HowItWorksArComponent,
    SocialProofArComponent,
    BottomCtaArComponent,
    LandingFooterArComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingArabicComponent implements OnInit, OnDestroy {
  private observer: IntersectionObserver | null = null;
  readonly animatedSections = viewChildren<ElementRef>('animatedSection');

  readonly scrollY = signal(0);
  readonly isScrolled = signal(false);

  ngOnInit(): void {
    try {
      // Component initialization
      if (typeof window !== 'undefined') {
        this.initScrollListener();
        this.initScrollObserver();
      }
    } catch (error) {
      console.error('Landing page initialization failed:', error);
      // Fallback: disable animations if observer fails
      this.handleInitializationError(error);
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }
  }

  private handleScroll = (): void => {
    const scrollPosition = window.scrollY;
    this.scrollY.set(scrollPosition);
    this.isScrolled.set(scrollPosition > 50);
  };

  private initScrollListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    }
  }

  private initScrollObserver(): void {
    try {
      if (typeof IntersectionObserver === 'undefined') {
        console.warn(
          'IntersectionObserver not supported - animations disabled'
        );
        return;
      }

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('animate-in');
              // Optional: unobserve after animation
              // this.observer?.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px',
        }
      );

      // Observe all sections with the animate-on-scroll class
      document.querySelectorAll('.animate-on-scroll').forEach((el) => {
        this.observer?.observe(el);
      });
    } catch (error) {
      console.error('Failed to initialize scroll observer:', error);
      // Animations will simply not run - page still functional
    }
  }

  scrollToSection(sectionId: string): void {
    try {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.warn(`Section with id "${sectionId}" not found`);
      }
    } catch (error) {
      console.error('Scroll to section failed:', error);
      // Fallback: try instant scroll without smooth behavior
      try {
        document.getElementById(sectionId)?.scrollIntoView();
      } catch (fallbackError) {
        console.error('Fallback scroll also failed:', fallbackError);
      }
    }
  }

  private handleInitializationError(error: unknown): void {
    // Log error for monitoring
    console.error('Landing component error:', error);

    // Disable scroll animations gracefully
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Remove event listeners to prevent memory leaks
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }
  }
}
