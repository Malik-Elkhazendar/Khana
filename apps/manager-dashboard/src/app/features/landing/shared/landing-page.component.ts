import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingPageContent } from './content/landing-content.model';
import { LoggerService } from '../../../shared/services/logger.service';
import { LandingHeaderSectionComponent } from './sections/landing-header/landing-header.component';
import { HeroSectionComponent } from './sections/hero-section/hero-section.component';
import { ProblemSolutionSectionComponent } from './sections/problem-solution/problem-solution.component';
import { FeaturesGridSectionComponent } from './sections/features-grid/features-grid.component';
import { HowItWorksSectionComponent } from './sections/how-it-works/how-it-works.component';
import { SocialProofSectionComponent } from './sections/social-proof/social-proof.component';
import { BottomCtaSectionComponent } from './sections/bottom-cta/bottom-cta.component';
import { LandingFooterSectionComponent } from './sections/landing-footer/landing-footer.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    LandingHeaderSectionComponent,
    HeroSectionComponent,
    ProblemSolutionSectionComponent,
    FeaturesGridSectionComponent,
    HowItWorksSectionComponent,
    SocialProofSectionComponent,
    BottomCtaSectionComponent,
    LandingFooterSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent implements OnInit, OnDestroy {
  readonly content = input.required<LandingPageContent>();
  readonly logPrefix = input.required<string>();

  private readonly logger = inject(LoggerService);
  private observer: IntersectionObserver | null = null;

  readonly scrollY = signal(0);
  readonly isScrolled = signal(false);

  ngOnInit(): void {
    try {
      if (typeof window !== 'undefined') {
        this.initScrollListener();
        this.initScrollObserver();
      }
    } catch (error) {
      this.logger.error(
        this.eventKey('initialization.failed'),
        'Landing page initialization failed',
        undefined,
        error
      );
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

  scrollToSection(sectionId: string): void {
    try {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        this.logger.warn(
          this.eventKey('scroll_target.missing'),
          `Section with id "${sectionId}" not found`,
          { sectionId }
        );
      }
    } catch (error) {
      this.logger.error(
        this.eventKey('scroll.failed'),
        'Scroll to section failed',
        { sectionId },
        error
      );
      try {
        document.getElementById(sectionId)?.scrollIntoView();
      } catch (fallbackError) {
        this.logger.error(
          this.eventKey('scroll.fallback_failed'),
          'Fallback scroll also failed',
          { sectionId },
          fallbackError
        );
      }
    }
  }

  private readonly handleScroll = (): void => {
    const scrollPosition = window.scrollY;
    this.scrollY.set(scrollPosition);
    this.isScrolled.set(scrollPosition > 50);
  };

  private initScrollListener(): void {
    window.addEventListener('scroll', this.handleScroll, { passive: true });
  }

  private initScrollObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.logger.warn(
        this.eventKey('intersection_observer.unsupported'),
        'IntersectionObserver not supported - animations disabled'
      );
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    document.querySelectorAll('.animate-on-scroll').forEach((element) => {
      this.observer?.observe(element);
    });
  }

  private handleInitializationError(error: unknown): void {
    this.logger.error(
      this.eventKey('component.error'),
      'Landing component error',
      undefined,
      error
    );

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }
  }

  private eventKey(suffix: string): string {
    return `${this.logPrefix()}.${suffix}`;
  }
}
