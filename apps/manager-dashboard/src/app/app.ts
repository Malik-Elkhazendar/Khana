import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { LayoutStore } from './shared/state/layout.store';
import { AuthService } from './shared/services/auth.service';
import { LanguageService } from './shared/services/language.service';

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
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Restore authentication session from sessionStorage
    this.authService.restoreSession();
    this.languageService.init();

    const resolveRouteLanguage = (url: string): 'en' | 'ar' | null => {
      const path = (url.split('?')[0] ?? '').split('#')[0] || '/';
      if (path === '/ar' || path.startsWith('/ar/')) return 'ar';
      if (path === '/' || path === '/en' || path.startsWith('/en/')) {
        return 'en';
      }
      return null;
    };

    const syncLanguageState = (url: string): void => {
      const routeLanguage = resolveRouteLanguage(url);
      if (routeLanguage) {
        if (this.languageService.getCurrentLanguage() !== routeLanguage) {
          this.languageService.setLanguage(routeLanguage);
        }
        this.layoutStore.setLanguage(routeLanguage);
        return;
      }

      this.layoutStore.setLanguage(this.languageService.getCurrentLanguage());
    };

    syncLanguageState(this.router.url);

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects ?? event.url;
        syncLanguageState(url);
      });
  }
}
