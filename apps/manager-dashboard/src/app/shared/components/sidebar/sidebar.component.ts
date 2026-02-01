import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

type NavItem = {
  label: string;
  route: string;
  icon: string;
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  @Input() isCollapsed = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  readonly navItems: NavItem[] = [
    { label: 'Calendar', route: '/calendar', icon: 'calendar' },
    { label: 'Bookings', route: '/bookings', icon: 'list' },
    { label: 'Preview', route: '/new', icon: 'eye' },
  ];

  onToggleClick(): void {
    this.toggleCollapse.emit();
  }

  trackByRoute(_: number, item: NavItem): string {
    return item.route;
  }
}
