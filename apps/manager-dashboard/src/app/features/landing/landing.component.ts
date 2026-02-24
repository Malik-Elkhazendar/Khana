import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LandingHeaderComponent } from './sections/landing-header/landing-header.component';
import { HeroSectionComponent } from './sections/hero-section/hero-section.component';
import { ProblemSolutionComponent } from './sections/problem-solution/problem-solution.component';
import { FeaturesGridComponent } from './sections/features-grid/features-grid.component';
import { HowItWorksComponent } from './sections/how-it-works/how-it-works.component';
import { SocialProofComponent } from './sections/social-proof/social-proof.component';
import { BottomCtaComponent } from './sections/bottom-cta/bottom-cta.component';
import { LandingFooterComponent } from './sections/landing-footer/landing-footer.component';
import { LoggerService } from '../../shared/services/logger.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LandingHeaderComponent,
    HeroSectionComponent,
    ProblemSolutionComponent,
    FeaturesGridComponent,
    HowItWorksComponent,
    SocialProofComponent,
    BottomCtaComponent,
    LandingFooterComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly logger = inject(LoggerService);
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
      this.logger.error(
        'client.landing.initialization.failed',
        'Landing page initialization failed',
        undefined,
        error
      );
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
        this.logger.warn(
          'client.landing.intersection_observer.unsupported',
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
      this.logger.error(
        'client.landing.scroll_observer.failed',
        'Failed to initialize scroll observer',
        undefined,
        error
      );
      // Animations will simply not run - page still functional
    }
  }

  scrollToSection(sectionId: string): void {
    try {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        this.logger.warn(
          'client.landing.scroll_target.missing',
          `Section with id "${sectionId}" not found`,
          { sectionId }
        );
      }
    } catch (error) {
      this.logger.error(
        'client.landing.scroll.failed',
        'Scroll to section failed',
        { sectionId },
        error
      );
      // Fallback: try instant scroll without smooth behavior
      try {
        document.getElementById(sectionId)?.scrollIntoView();
      } catch (fallbackError) {
        this.logger.error(
          'client.landing.scroll.fallback_failed',
          'Fallback scroll also failed',
          { sectionId },
          fallbackError
        );
      }
    }
  }

  private handleInitializationError(error: unknown): void {
    // Log error for monitoring
    this.logger.error(
      'client.landing.component.error',
      'Landing component error',
      undefined,
      error
    );

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
