import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingArabicComponent } from './landing.component';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

  it('should initialize with scrollY as 0', () => {
    expect(component.scrollY()).toBe(0);
  });

  it('should initialize with isScrolled as false', () => {
    expect(component.isScrolled()).toBe(false);
  });

  it('should set RTL direction in template', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rtlContainer = compiled.querySelector('[dir="rtl"]');
    expect(rtlContainer).toBeTruthy();
    expect(rtlContainer?.getAttribute('lang')).toBe('ar');
  });

  it('should handle scrollToSection safely when element exists', () => {
    const mockElement = document.createElement('div');
    mockElement.id = 'test-section';
    Object.defineProperty(mockElement, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    document.body.appendChild(mockElement);

    component.scrollToSection('test-section');

    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    document.body.removeChild(mockElement);
  });

  it('should disconnect observer on destroy', () => {
    const mockObserver = {
      disconnect: jest.fn(),
      observe: jest.fn(),
      unobserve: jest.fn(),
    } as any;

    component['observer'] = mockObserver;
    component.ngOnDestroy();

    expect(mockObserver.disconnect).toHaveBeenCalled();
  });
});
