import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingHeaderComponent } from './landing-header.component';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

describe('LandingHeaderComponent', () => {
  let component: LandingHeaderComponent;
  let fixture: ComponentFixture<LandingHeaderComponent>;
  let translateService: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LandingHeaderComponent,
        RouterModule.forRoot([]),
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');

    fixture = TestBed.createComponent(LandingHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 3 navigation items', () => {
    expect(component.navItems.length).toBe(3);
    expect(component.navItems[0].label).toBe('Features');
    expect(component.navItems[1].label).toBe('How It Works');
    expect(component.navItems[2].label).toBe('Testimonials');
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
