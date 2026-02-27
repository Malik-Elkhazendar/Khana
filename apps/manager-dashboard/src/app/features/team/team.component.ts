import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '../../shared/state/auth.store';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);

  readonly currentUser = this.authStore.user;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.refreshCurrentUser();
  }

  refreshCurrentUser(): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.authStore.setUser(user);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('DASHBOARD.PAGES.TEAM.ERROR');
      },
    });
  }
}
