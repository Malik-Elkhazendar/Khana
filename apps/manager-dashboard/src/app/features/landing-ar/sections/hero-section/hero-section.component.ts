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
  selector: 'app-hero-section-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSectionArComponent implements OnInit {
  @Input() scrollY = 0;

  readonly parallaxOffset = computed(() => this.scrollY * -0.3);

  readonly stats = [
    { value: '١٠٠٠٠+', label: 'حجوزات مُدارة' },
    { value: '١٠٠+', label: 'منشأة' },
    { value: '٩٩٫٩٪', label: 'التوافر' },
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
    { date: '٦', booked: false, today: false },
    { date: '٧', booked: true, today: false },
    { date: '٨', booked: true, today: false },
    { date: '٩', booked: false, today: false },
    { date: '١٠', booked: true, today: false },
    { date: '١١', booked: false, today: true },
    { date: '١٢', booked: true, today: false },
  ];

  ngOnInit(): void {
    // Component initialized
  }
}
