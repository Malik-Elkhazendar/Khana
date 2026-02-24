import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LandingComponent } from './landing.component';
import { LoggerService } from '../../shared/services/logger.service';

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
  let loggerMock: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    loggerMock = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    await TestBed.configureTestingModule({
      imports: [
        LandingComponent,
        RouterModule.forRoot([]),
        TranslateModule.forRoot(),
      ],
      providers: [{ provide: LoggerService, useValue: loggerMock }],
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

  it('should initialize with scrollY as 0', () => {
    expect(component.scrollY()).toBe(0);
  });

  it('should initialize with isScrolled as false', () => {
    expect(component.isScrolled()).toBe(false);
  });

  it('should update isScrolled when scrollY exceeds 50', () => {
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 100,
    });
    component['handleScroll']();
    expect(component.isScrolled()).toBe(true);
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY,
    });
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

  it('should handle scrollToSection safely when element does not exist', () => {
    component.scrollToSection('non-existent');

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'client.landing.scroll_target.missing',
      'Section with id "non-existent" not found',
      { sectionId: 'non-existent' }
    );
  });

  it('should disconnect observer on destroy', () => {
    const mockObserver = {
      disconnect: jest.fn(),
      observe: jest.fn(),
      unobserve: jest.fn(),
    } as unknown as IntersectionObserver;

    component['observer'] = mockObserver;
    component.ngOnDestroy();

    expect(mockObserver.disconnect).toHaveBeenCalled();
  });
});
