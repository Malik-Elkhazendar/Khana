import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  computed,
  OnInit,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSectionComponent implements OnInit {
  @Input() scrollY = 0;

  readonly parallaxOffset = computed(() => this.scrollY * -0.3);

  readonly stats = [
    { value: '10K+', label: 'Bookings Managed' },
    { value: '100+', label: 'Facilities' },
    { value: '99.9%', label: 'Uptime' },
  ];

  readonly stars = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16 + Math.random() * 32,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 4,
  }));

  readonly calendarDays = [
    { date: 6, booked: false, today: false },
    { date: 7, booked: true, today: false },
    { date: 8, booked: true, today: false },
    { date: 9, booked: false, today: false },
    { date: 10, booked: true, today: false },
    { date: 11, booked: false, today: true },
    { date: 12, booked: true, today: false },
  ];

  ngOnInit(): void {
    // Component initialized
  }
}
