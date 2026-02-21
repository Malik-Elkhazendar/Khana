import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'ar';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  private readonly LANG_KEY = 'khana_user_lang';
  private latestRequestedLanguage: AppLanguage = 'en';
  readonly languageVersion = signal(0);
  private readonly currentLanguage = signal<AppLanguage>('en');

  constructor() {
    const initial = this.normalizeLanguage(this.translateService?.currentLang);
    if (initial) {
      this.currentLanguage.set(initial);
      this.latestRequestedLanguage = initial;
    }

    this.translateService?.onLangChange.subscribe(({ lang }) => {
      const normalized = this.normalizeLanguage(lang) ?? 'en';
      if (normalized !== this.latestRequestedLanguage) {
        return;
      }
      this.currentLanguage.set(normalized);
      this.updateDocumentDirection(normalized);
      localStorage.setItem(this.LANG_KEY, normalized);
      this.languageVersion.update((value) => value + 1);
    });
  }

  public init(): void {
    const savedLang = this.normalizeLanguage(
      localStorage.getItem(this.LANG_KEY)
    );
    const browserLang = this.normalizeLanguage(
      this.translateService?.getBrowserLang()
    );
    const defaultLang = savedLang ?? browserLang ?? 'en';

    this.setLanguage(defaultLang);
  }

  public setLanguage(lang: AppLanguage): void {
    const normalized = this.normalizeLanguage(lang) ?? 'en';
    this.latestRequestedLanguage = normalized;
    this.currentLanguage.set(normalized);
    this.updateDocumentDirection(normalized);
    localStorage.setItem(this.LANG_KEY, normalized);
    this.translateService?.use(normalized);
    this.languageVersion.update((value) => value + 1);
  }

  public getCurrentLanguage(): AppLanguage {
    return this.currentLanguage();
  }

  public toggleLanguage(): void {
    const nextLang = this.getCurrentLanguage() === 'en' ? 'ar' : 'en';
    this.setLanguage(nextLang);
  }

  private updateDocumentDirection(lang: AppLanguage): void {
    const htmlLang = lang === 'ar' ? 'ar' : 'en';
    const htmlDir = lang === 'ar' ? 'rtl' : 'ltr';

    document.documentElement.lang = htmlLang;
    document.documentElement.dir = htmlDir;

    if (lang === 'ar') {
      document.body.classList.add('lang-ar');
    } else {
      document.body.classList.remove('lang-ar');
    }
  }

  private normalizeLanguage(
    lang: string | null | undefined
  ): AppLanguage | null {
    if (!lang) return null;
    const normalized = lang.toLowerCase();
    if (normalized.startsWith('ar')) return 'ar';
    if (normalized.startsWith('en')) return 'en';
    return null;
  }
}
