import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ComparisonItem {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-problem-solution',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './problem-solution.component.html',
  styleUrl: './problem-solution.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemSolutionComponent {
  readonly oldWayItems: ComparisonItem[] = [
    { icon: 'cross', text: 'Endless WhatsApp messages to check availability' },
    { icon: 'cross', text: 'Paper calendars with crossed-out bookings' },
    { icon: 'cross', text: 'Phone tag just to confirm a slot' },
    { icon: 'cross', text: 'Double-bookings that embarrass your business' },
    { icon: 'cross', text: 'No visibility into revenue or patterns' },
  ];

  readonly newWayItems: ComparisonItem[] = [
    { icon: 'check', text: 'Instant availability visible to everyone' },
    { icon: 'check', text: 'Digital calendar synced across all devices' },
    { icon: 'check', text: 'Automatic confirmations in seconds' },
    { icon: 'check', text: 'Smart conflict detection prevents overlaps' },
    { icon: 'check', text: 'Complete analytics and revenue tracking' },
  ];
}
