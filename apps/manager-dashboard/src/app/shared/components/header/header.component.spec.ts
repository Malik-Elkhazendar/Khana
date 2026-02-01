import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, RouterModule.forRoot([])],
    }).compileComponents();
  });

  it('creates the component', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('toggles the mobile menu state', () => {
    const { component } = setup();

    expect(component.mobileMenuOpen()).toBe(false);

    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(true);

    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
  });

  it('toggles the user menu state', () => {
    const { component } = setup();

    expect(component.userMenuOpen()).toBe(false);

    component.toggleUserMenu();
    expect(component.userMenuOpen()).toBe(true);

    component.toggleUserMenu();
    expect(component.userMenuOpen()).toBe(false);
  });

  it('navigates with the router and closes menus', () => {
    const { component } = setup();
    const router = TestBed.inject(Router);
    const navigateSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    component.toggleMobileMenu();
    component.navigate('/bookings');

    expect(navigateSpy).toHaveBeenCalledWith('/bookings');
    expect(component.mobileMenuOpen()).toBe(false);

    component.toggleUserMenu();
    component.navigate('/calendar');

    expect(navigateSpy).toHaveBeenCalledWith('/calendar');
    expect(component.userMenuOpen()).toBe(false);
  });

  it('does not navigate when the route is null', () => {
    const { component } = setup();
    const router = TestBed.inject(Router);
    const navigateSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
    const preventDefault = jest.fn();

    component.navigate(null, { preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('closes menus on logout', () => {
    const { component } = setup();

    component.toggleMobileMenu();
    component.logout();
    expect(component.mobileMenuOpen()).toBe(false);

    component.toggleUserMenu();
    component.logout();
    expect(component.userMenuOpen()).toBe(false);
  });

  it('renders the guest button when no user is set', () => {
    const { fixture } = setup();

    const guestButton = fixture.nativeElement.querySelector(
      '.user-button--ghost'
    ) as HTMLButtonElement | null;
    const userName = fixture.nativeElement.querySelector('.user-name');

    expect(guestButton).toBeTruthy();
    expect(userName).toBeNull();
  });

  it('renders the user name and role when currentUser is set', () => {
    const { fixture, component } = setup();

    patchState((component as { state: unknown }).state as any, {
      currentUser: { name: 'Ava Hassan', role: 'Manager' },
    });
    fixture.detectChanges();

    const guestButton = fixture.nativeElement.querySelector(
      '.user-button--ghost'
    );
    const userName = fixture.nativeElement.querySelector('.user-name');
    const userRole = fixture.nativeElement.querySelector('.user-role');

    expect(guestButton).toBeNull();
    expect(userName?.textContent).toContain('Ava Hassan');
    expect(userRole?.textContent).toContain('Manager');
  });
});
