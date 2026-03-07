import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LandingHeaderSectionComponent } from './landing-header.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';

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

describe('LandingHeaderSectionComponent', () => {
  let component: LandingHeaderSectionComponent;
  let fixture: ComponentFixture<LandingHeaderSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LandingHeaderSectionComponent,
        RouterModule.forRoot([]),
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');

    fixture = TestBed.createComponent(LandingHeaderSectionComponent);
    fixture.componentRef.setInput('content', LANDING_CONTENT_EN.header);
    fixture.componentRef.setInput('locale', 'en');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 3 navigation items', () => {
    expect(component.content().navItems).toHaveLength(3);
  });

  it('should toggle mobile menu', () => {
    expect(component.mobileMenuOpen()).toBe(false);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(true);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
  });

  it('should emit navigateToSection and close mobile menu', () => {
    jest.spyOn(component.navigateToSection, 'emit');
    component.mobileMenuOpen.set(true);

    component.onMobileNavClick('features');

    expect(component.navigateToSection.emit).toHaveBeenCalledWith('features');
    expect(component.mobileMenuOpen()).toBe(false);
  });

  it('should apply scrolled class when isScrolled is true', () => {
    fixture.componentRef.setInput('isScrolled', true);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.landing-header');
    expect(header.classList.contains('scrolled')).toBe(true);
  });
});
