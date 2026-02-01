import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingHeaderArComponent } from './landing-header.component';
import { RouterModule } from '@angular/router';

describe('LandingHeaderArComponent', () => {
  let component: LandingHeaderArComponent;
  let fixture: ComponentFixture<LandingHeaderArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingHeaderArComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingHeaderArComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 3 navigation items in Arabic', () => {
    expect(component.navItems.length).toBe(3);
    expect(component.navItems[0].label).toBe(
      '\u0627\u0644\u0645\u064a\u0632\u0627\u062a'
    );
    expect(component.navItems[1].label).toBe(
      '\u0643\u064a\u0641 \u062a\u0639\u0645\u0644'
    );
    expect(component.navItems[2].label).toBe(
      '\u0622\u0631\u0627\u0621 \u0627\u0644\u0639\u0645\u0644\u0627\u0621'
    );
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
});
