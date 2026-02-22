import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

type AppLocale = 'en-SA' | 'ar-SA';

@Injectable({
  providedIn: 'root',
})
export class LocaleFormatService {
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  private readonly dateTimeFormatterCache = new Map<
    string,
    Intl.DateTimeFormat
  >();
  private readonly numberFormatterCache = new Map<string, Intl.NumberFormat>();
  private readonly localeSignal = signal<AppLocale>(this.resolveLocale());

  constructor() {
    if (
      typeof document === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return;
    }

    const observer = new MutationObserver(() => {
      const nextLocale = this.resolveLocale();
      if (nextLocale !== this.localeSignal()) {
        this.localeSignal.set(nextLocale);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });

    this.translateService?.onLangChange.subscribe(({ lang }) => {
      const nextLocale = this.mapLangToLocale(lang);
      if (nextLocale !== this.localeSignal()) {
        this.localeSignal.set(nextLocale);
      }
    });
  }

  getCurrentLocale(): AppLocale {
    const nextLocale = this.resolveLocale();
    if (nextLocale !== this.localeSignal()) {
      this.localeSignal.set(nextLocale);
    }
    return this.localeSignal();
  }

  private resolveLocale(): AppLocale {
    const activeLang = this.translateService?.currentLang;
    if (activeLang) {
      return this.mapLangToLocale(activeLang);
    }

    if (typeof document === 'undefined') {
      return 'en-SA';
    }
    const lang = (document.documentElement.lang || 'en').toLowerCase();
    return this.mapLangToLocale(lang);
  }

  private mapLangToLocale(lang: string): AppLocale {
    return lang.toLowerCase().startsWith('ar') ? 'ar-SA' : 'en-SA';
  }

  formatDate(
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions
  ): string {
    const date = this.toDate(value);
    if (!date) return '';
    return this.getDateTimeFormatter(this.getCurrentLocale(), options).format(
      date
    );
  }

  formatCurrency(
    amount: number,
    currency: string,
    options: Intl.NumberFormatOptions = {}
  ): string {
    return this.getNumberFormatter(this.getCurrentLocale(), {
      style: 'currency',
      currency,
      ...options,
    }).format(amount);
  }

  formatHourLabel(hour24: number): string {
    const safeHour = Math.min(Math.max(hour24, 0), 23);
    const baseDate = new Date(Date.UTC(2025, 0, 1, safeHour, 0, 0, 0));
    return this.formatDate(baseDate, {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    });
  }

  private toDate(value: Date | string | number): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getDateTimeFormatter(
    locale: AppLocale,
    options: Intl.DateTimeFormatOptions
  ): Intl.DateTimeFormat {
    const key = `${locale}|${this.serializeOptions(options)}`;
    const existing = this.dateTimeFormatterCache.get(key);
    if (existing) return existing;

    const formatter = new Intl.DateTimeFormat(locale, options);
    this.dateTimeFormatterCache.set(key, formatter);
    return formatter;
  }

  private getNumberFormatter(
    locale: AppLocale,
    options: Intl.NumberFormatOptions
  ): Intl.NumberFormat {
    const key = `${locale}|${this.serializeOptions(options)}`;
    const existing = this.numberFormatterCache.get(key);
    if (existing) return existing;

    const formatter = new Intl.NumberFormat(locale, options);
    this.numberFormatterCache.set(key, formatter);
    return formatter;
  }

  private serializeOptions(
    options: Intl.DateTimeFormatOptions | Intl.NumberFormatOptions
  ): string {
    return Object.entries(options as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${String(value)}`)
      .join('|');
  }
}
