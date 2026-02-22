import { TestBed } from '@angular/core/testing';
import { LocaleFormatService } from './locale-format.service';

describe('LocaleFormatService', () => {
  let service: LocaleFormatService;
  let previousLang: string;

  beforeEach(() => {
    previousLang = document.documentElement.lang;
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocaleFormatService);
  });

  afterEach(() => {
    document.documentElement.lang = previousLang;
  });

  it('uses en-SA locale by default', () => {
    document.documentElement.lang = 'en';
    expect(service.getCurrentLocale()).toBe('en-SA');
  });

  it('uses ar-SA locale when document language is Arabic', () => {
    document.documentElement.lang = 'ar';
    expect(service.getCurrentLocale()).toBe('ar-SA');
  });

  it('formats date values with the active locale', () => {
    document.documentElement.lang = 'en';
    const value = service.formatDate('2026-02-21T10:00:00Z', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    expect(value).toContain('2026');
  });

  it('formats currency values with the active locale', () => {
    document.documentElement.lang = 'en';
    const value = service.formatCurrency(3500, 'SAR');
    expect(value).toContain('SAR');
  });
});
