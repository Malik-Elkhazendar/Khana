import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LandingDirection,
  LandingSocialProofContent,
} from '../../content/landing-content.model';

@Component({
  selector: 'app-social-proof-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-proof.component.html',
  styleUrl: './social-proof.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialProofSectionComponent {
  readonly content = input.required<LandingSocialProofContent>();
  readonly direction = input.required<LandingDirection>();

  readonly currentIndex = signal(0);
  readonly visibleCount = signal(
    typeof window !== 'undefined' && window.innerWidth >= 1024
      ? 3
      : typeof window !== 'undefined' && window.innerWidth >= 768
      ? 2
      : 1
  );

  readonly maxIndex = computed(
    () => this.content().testimonials.length - this.visibleCount()
  );

  readonly trackIndex = computed(() =>
    this.direction() === 'rtl'
      ? this.maxIndex() - this.currentIndex()
      : this.currentIndex()
  );

  readonly dotsArray = computed(() =>
    Array.from({ length: this.maxIndex() + 1 }, (_, index) => index)
  );

  nextSlide(): void {
    if (this.currentIndex() < this.maxIndex()) {
      this.currentIndex.update((index) => index + 1);
    }
  }

  prevSlide(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((index) => index - 1);
    }
  }

  goToSlide(index: number): void {
    this.currentIndex.set(index);
  }

  testimonialAriaLabel(author: string): string {
    return this.direction() === 'rtl'
      ? `شهادة من ${author}`
      : `Testimonial from ${author}`;
  }

  ratingAriaLabel(rating: number): string {
    return this.direction() === 'rtl'
      ? `تقييم ${rating} من 5 نجوم`
      : `${rating} out of 5 stars`;
  }

  dotAriaLabel(index: number): string {
    return this.direction() === 'rtl'
      ? `انتقل إلى الشهادة رقم ${index + 1}`
      : `Go to testimonial ${index + 1}`;
  }
}
