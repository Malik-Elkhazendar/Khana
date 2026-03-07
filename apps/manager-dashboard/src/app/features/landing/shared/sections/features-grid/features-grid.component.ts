import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  input,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  LandingFeaturesGridContent,
  LandingLanguage,
} from '../../content/landing-content.model';

@Component({
  selector: 'app-features-grid-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './features-grid.component.html',
  styleUrl: './features-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesGridSectionComponent implements AfterViewInit, OnDestroy {
  readonly content = input.required<LandingFeaturesGridContent>();
  readonly locale = input.required<LandingLanguage>();

  @ViewChild('grid') grid!: ElementRef<HTMLElement>;

  private observer: IntersectionObserver | undefined;
  private readonly platformId = inject(PLATFORM_ID);

  get learnMoreHref(): string {
    return this.locale() === 'ar' ? '/ar#how-it-works' : '#how-it-works';
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupObserver();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  featureLinkAriaLabel(title: string): string {
    return this.locale() === 'ar'
      ? `اعرف المزيد عن ${title}`
      : `Learn more about ${title}`;
  }

  private setupObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    if (this.grid) {
      this.observer.observe(this.grid.nativeElement);
    }
  }
}
