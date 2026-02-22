import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DASHBOARD_NAV_ITEMS } from '../../navigation/dashboard-nav';
import { UiIconComponent } from '../ui';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, UiIconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  @Input() isCollapsed = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  readonly navItems = DASHBOARD_NAV_ITEMS;

  onToggleClick(): void {
    this.toggleCollapse.emit();
  }

  trackByRoute(_: number, item: { route: string }): string {
    return item.route;
  }
}
