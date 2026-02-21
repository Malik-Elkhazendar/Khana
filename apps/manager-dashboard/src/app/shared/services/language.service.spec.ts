import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let langChange$: Subject<{ lang: string }>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.body.classList.remove('lang-ar');

    langChange$ = new Subject<{ lang: string }>();

    const translateServiceMock = {
      currentLang: 'en',
      onLangChange: langChange$.asObservable(),
      getBrowserLang: jest.fn(() => 'en'),
      use: jest.fn((lang: string) => of(lang)),
    };

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: translateServiceMock },
      ],
    });

    service = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    localStorage.clear();
    langChange$.complete();
  });

  it('should update document language and direction when switching to arabic', () => {
    service.setLanguage('ar');

    expect(service.getCurrentLanguage()).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.body.classList.contains('lang-ar')).toBe(true);
    expect(localStorage.getItem('khana_user_lang')).toBe('ar');
  });

  it('should ignore stale translation events from older language requests', () => {
    localStorage.setItem('khana_user_lang', 'ar');
    service.init();

    service.setLanguage('en');
    langChange$.next({ lang: 'ar' });

    expect(service.getCurrentLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.body.classList.contains('lang-ar')).toBe(false);
  });
});
