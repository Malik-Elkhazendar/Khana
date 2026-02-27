import {
  DOCUMENT,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { getDashboardNavItemsForRole } from '../../navigation/dashboard-nav';
import { AuthStore } from '../../state/auth.store';
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

  private readonly document = inject(DOCUMENT);
  private readonly authStore = inject(AuthStore);
  readonly currentUser = this.authStore.user;
  readonly navItems = computed(() =>
    getDashboardNavItemsForRole(this.currentUser()?.role)
  );

  get toggleIcon(): string {
    const isRtl = this.document?.documentElement?.dir === 'rtl';
    if (this.isCollapsed) {
      return isRtl ? '‹' : '›';
    }
    return isRtl ? '›' : '‹';
  }

  onToggleClick(): void {
    this.toggleCollapse.emit();
  }

  trackByRoute(_: number, item: { route: string }): string {
    return item.route;
  }
}
