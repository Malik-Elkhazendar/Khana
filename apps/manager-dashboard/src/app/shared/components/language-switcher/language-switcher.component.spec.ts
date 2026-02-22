import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import { LanguageSwitcherComponent } from './language-switcher.component';

@Component({
  template: '',
  standalone: true,
})
class StubRouteComponent {}

const EN_TRANSLATIONS = {
  SHARED: {
    LANGUAGE: {
      SWITCH_TO_ARABIC: 'Switch to Arabic',
      SWITCH_TO_ENGLISH: 'Switch to English',
      LANGUAGE_ARABIC: 'العربية',
      LANGUAGE_ENGLISH: 'English',
      SHORT_ARABIC: 'ع',
      SHORT_ENGLISH: 'EN',
    },
  },
};

describe('LanguageSwitcherComponent', () => {
  const languageServiceMock = {
    getCurrentLanguage: jest.fn(() => 'en' as const),
    setLanguage: jest.fn(),
  };

  let router: Router;

  const setup = () => {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  };

  beforeEach(async () => {
    languageServiceMock.getCurrentLanguage.mockReturnValue('en');
    languageServiceMock.setLanguage.mockReset();

    await TestBed.configureTestingModule({
      imports: [
        LanguageSwitcherComponent,
        TranslateModule.forRoot(),
        RouterTestingModule.withRoutes([
          { path: '', component: StubRouteComponent },
          { path: 'ar', component: StubRouteComponent },
          { path: 'dashboard/bookings', component: StubRouteComponent },
        ]),
      ],
      providers: [{ provide: LanguageService, useValue: languageServiceMock }],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');

    router = TestBed.inject(Router);
  });

  it('creates the component', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('toggles language to Arabic and navigates on landing route', async () => {
    const { component } = setup();
    const navigateSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    await component.toggleLanguage();

    expect(languageServiceMock.setLanguage).toHaveBeenCalledWith('ar');
    expect(navigateSpy).toHaveBeenCalled();
  });

  it('toggles language without route navigation on non-landing pages', async () => {
    await router.navigateByUrl('/dashboard/bookings');
    const { component } = setup();
    const navigateSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    await component.toggleLanguage();

    expect(languageServiceMock.setLanguage).toHaveBeenCalledWith('ar');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('renders short label when useShortLabel is enabled', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('useShortLabel', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ع');
  });
});
