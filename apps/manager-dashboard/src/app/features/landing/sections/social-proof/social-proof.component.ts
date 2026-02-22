import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  rating: number;
  avatarInitials: string;
}

interface Stat {
  value: string;
  label: string;
  suffix?: string;
}

@Component({
  selector: 'app-social-proof',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-proof.component.html',
  styleUrl: './social-proof.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialProofComponent {
  readonly currentIndex = signal(0);

  readonly testimonials: Testimonial[] = [
    {
      id: '1',
      quote:
        "Khana reduced our booking errors by 95%. Our customers love the instant confirmations, and we've seen a 30% increase in repeat bookings.",
      author: 'Ahmed Al-Rashid',
      role: 'Operations Manager',
      company: 'Padel Club Dubai',
      rating: 5,
      avatarInitials: 'AR',
    },
    {
      id: '2',
      quote:
        "Before Khana, we spent 3 hours daily managing WhatsApp bookings. Now it's completely automated. I wish we had found this sooner!",
      author: 'Sara Al-Mahmoud',
      role: 'Owner',
      company: 'Desert Rose Chalets',
      rating: 5,
      avatarInitials: 'SM',
    },
    {
      id: '3',
      quote:
        'The real-time calendar is a game-changer. Our staff can focus on customer service instead of juggling phone calls and messages.',
      author: 'Mohammed Khalil',
      role: 'General Manager',
      company: 'Sports City Complex',
      rating: 5,
      avatarInitials: 'MK',
    },
    {
      id: '4',
      quote:
        'Finally, a system that understands our market. The Arabic support and RTL interface made adoption seamless for our entire team.',
      author: 'Fatima Al-Hassan',
      role: 'Director',
      company: 'Al-Noor Tennis Academy',
      rating: 5,
      avatarInitials: 'FH',
    },
    {
      id: '5',
      quote:
        'Revenue tracking was impossible before. Now I can see exactly which courts are most profitable and optimize pricing accordingly.',
      author: 'Khalid Ibrahim',
      role: 'Business Owner',
      company: 'Golden Gate Sports',
      rating: 5,
      avatarInitials: 'KI',
    },
  ];

  readonly stats: Stat[] = [
    { value: '100', suffix: '+', label: 'Facilities' },
    { value: '10K', suffix: '+', label: 'Bookings Managed' },
    { value: '4.9', suffix: '/5', label: 'Average Rating' },
    { value: '99.9', suffix: '%', label: 'Uptime' },
  ];

  readonly visibleCount = signal(
    typeof window !== 'undefined' && window.innerWidth >= 1024
      ? 3
      : typeof window !== 'undefined' && window.innerWidth >= 768
      ? 2
      : 1
  );

  readonly maxIndex = computed(
    () => this.testimonials.length - this.visibleCount()
  );

  readonly dotsArray = computed(() =>
    Array.from({ length: this.maxIndex() + 1 })
  );

  nextSlide(): void {
    if (this.currentIndex() < this.maxIndex()) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  prevSlide(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  goToSlide(index: number): void {
    this.currentIndex.set(index);
  }
}
