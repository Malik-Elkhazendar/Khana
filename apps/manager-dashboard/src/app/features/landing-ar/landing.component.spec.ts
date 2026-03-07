import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LandingArabicComponent } from './landing.component';

const AR_TRANSLATIONS = {
  SHARED: {
    LANGUAGE: {
      SWITCH_TO_ARABIC: 'التبديل إلى العربية',
      SWITCH_TO_ENGLISH: 'التبديل إلى الإنجليزية',
      LANGUAGE_ARABIC: 'العربية',
      LANGUAGE_ENGLISH: 'English',
      SHORT_ARABIC: 'ع',
      SHORT_ENGLISH: 'EN',
    },
  },
};

describe('LandingArabicComponent', () => {
  let component: LandingArabicComponent;
  let fixture: ComponentFixture<LandingArabicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LandingArabicComponent,
        RouterModule.forRoot([]),
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('ar', AR_TRANSLATIONS);
    translateService.use('ar');

    fixture = TestBed.createComponent(LandingArabicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the shared landing page in rtl', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const landingPage = compiled.querySelector('.landing-page');
    expect(landingPage?.getAttribute('dir')).toBe('rtl');
    expect(landingPage?.getAttribute('lang')).toBe('ar');
  });
});
