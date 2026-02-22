import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppLanguage, LanguageService } from '../../services/language.service';

type LanguageSwitcherTone = 'light' | 'dark';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent {
  @Input() tone: LanguageSwitcherTone = 'light';
  @Input() fullWidth = false;
  @Input() useShortLabel = false;
  @Input() showLabel = true;

  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  get currentLanguage(): AppLanguage {
    return this.languageService.getCurrentLanguage();
  }

  get nextLanguage(): AppLanguage {
    return this.currentLanguage === 'en' ? 'ar' : 'en';
  }

  get switchLabelKey(): string {
    return this.nextLanguage === 'ar'
      ? 'SHARED.LANGUAGE.SWITCH_TO_ARABIC'
      : 'SHARED.LANGUAGE.SWITCH_TO_ENGLISH';
  }

  get languageLabelKey(): string {
    if (this.useShortLabel) {
      return this.nextLanguage === 'ar'
        ? 'SHARED.LANGUAGE.SHORT_ARABIC'
        : 'SHARED.LANGUAGE.SHORT_ENGLISH';
    }
    return this.nextLanguage === 'ar'
      ? 'SHARED.LANGUAGE.LANGUAGE_ARABIC'
      : 'SHARED.LANGUAGE.LANGUAGE_ENGLISH';
  }

  toggleLanguage(): void {
    const targetLanguage = this.nextLanguage;
    this.languageService.setLanguage(targetLanguage);
    this.syncLandingRoute(targetLanguage);
  }

  private syncLandingRoute(targetLanguage: AppLanguage): void {
    const currentUrl = this.router.parseUrl(this.router.url);
    const primarySegments = currentUrl.root.children['primary']?.segments ?? [];
    const currentPath = `/${primarySegments
      .map((segment) => segment.path)
      .join('/')}`;
    const normalizedPath = currentPath === '/' ? '/' : currentPath;

    if (normalizedPath !== '/' && normalizedPath !== '/ar') {
      return;
    }

    const targetPath = targetLanguage === 'ar' ? '/ar' : '/';
    if (normalizedPath === targetPath) {
      return;
    }

    const targetTree = this.router.createUrlTree(
      targetLanguage === 'ar' ? ['/ar'] : ['/'],
      {
        queryParams: currentUrl.queryParams,
        fragment: currentUrl.fragment ?? undefined,
      }
    );
    void this.router.navigateByUrl(targetTree);
  }
}
