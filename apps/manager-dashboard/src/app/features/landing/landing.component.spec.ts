import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LandingComponent } from './landing.component';

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

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LandingComponent,
        RouterModule.forRoot([]),
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the shared landing page in english', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const landingPage = compiled.querySelector('.landing-page');
    expect(landingPage?.getAttribute('dir')).toBe('ltr');
    expect(landingPage?.getAttribute('lang')).toBe('en');
  });
});
