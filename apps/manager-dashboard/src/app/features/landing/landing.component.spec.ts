import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';
import { RouterModule } from '@angular/router';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent, RouterModule.forRoot([])],
    }).compileComponents();

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
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    component.scrollToSection('non-existent');
    expect(console.warn).toHaveBeenCalledWith(
      'Section with id "non-existent" not found'
    );
    warnSpy.mockRestore();
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
