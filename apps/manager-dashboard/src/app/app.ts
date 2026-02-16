import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { LayoutStore } from './shared/state/layout.store';
import { AuthService } from './shared/services/auth.service';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly title = 'Khana Manager Dashboard';
  private readonly router = inject(Router);
  private readonly layoutStore = inject(LayoutStore);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Restore authentication session from sessionStorage
    this.authService.restoreSession();

    const resolveLanguage = (url: string) =>
      url.startsWith('/ar') ? 'ar' : 'en';

    this.layoutStore.setLanguage(resolveLanguage(this.router.url));

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects ?? event.url;
        this.layoutStore.setLanguage(resolveLanguage(url));
      });
  }
}
