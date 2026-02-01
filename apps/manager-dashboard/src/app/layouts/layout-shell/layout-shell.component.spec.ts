import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { LayoutShellComponent } from './layout-shell.component';
import { LayoutStore } from '../../shared/state/layout.store';

describe('LayoutShellComponent', () => {
  let fixture: ComponentFixture<LayoutShellComponent>;
  let component: LayoutShellComponent;
  let store: InstanceType<typeof LayoutStore>;

  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  };

  beforeEach(async () => {
    setWindowWidth(1200);
    await TestBed.configureTestingModule({
      imports: [LayoutShellComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutShellComponent);
    component = fixture.componentInstance;
    store = component.layoutStore;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('toggles sidebar collapse state', () => {
    expect(store.sidebarCollapsed()).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarCollapsed()).toBe(true);
  });

  it('toggles mobile drawer state', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    expect(store.mobileDrawerOpen()).toBe(false);
    store.toggleMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);
  });

  it('detects desktop viewport width', () => {
    setWindowWidth(1200);
    component.onResize(new Event('resize'));
    expect(component.isDesktop()).toBe(true);
  });

  it('detects mobile viewport width', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    expect(component.isDesktop()).toBe(false);
  });

  it('renders header and router outlet', () => {
    const header = fixture.nativeElement.querySelector('app-header');
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    const drawer = fixture.nativeElement.querySelector('app-mobile-nav-drawer');
    expect(header).toBeTruthy();
    expect(outlet).toBeTruthy();
    expect(drawer).toBeTruthy();
  });

  it('renders sidebar on tablet widths', () => {
    setWindowWidth(900);
    component.onResize(new Event('resize'));
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('app-sidebar');
    expect(sidebar).toBeTruthy();
    expect(store.sidebarCollapsed()).toBe(true);
  });

  it('hides sidebar on mobile widths', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('app-sidebar');
    expect(sidebar).toBeNull();
  });

  it('renders skip link pointing to main content', () => {
    const skipLink = fixture.nativeElement.querySelector('.skip-link');
    expect(skipLink).toBeTruthy();
    expect(skipLink?.getAttribute('href')).toBe('#main-content');
  });

  it('closes the drawer when switching to desktop', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    store.toggleMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);

    setWindowWidth(1200);
    component.onResize(new Event('resize'));
    expect(store.mobileDrawerOpen()).toBe(false);
  });
});
