import { TestBed } from '@angular/core/testing';
import { LayoutStore } from './layout.store';

describe('LayoutStore', () => {
  let store: InstanceType<typeof LayoutStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(LayoutStore);
  });

  afterEach(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    }
    TestBed.resetTestingModule();
  });

  it('should have initial state', () => {
    expect(store.sidebarCollapsed()).toBe(false);
    expect(store.mobileDrawerOpen()).toBe(false);
    expect(store.currentTheme()).toBe('light');
    expect(store.language()).toBe('en');
    expect(store.dir()).toBe('ltr');
  });

  it('toggleSidebar() should toggle sidebarCollapsed', () => {
    expect(store.sidebarCollapsed()).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarCollapsed()).toBe(true);
    store.toggleSidebar();
    expect(store.sidebarCollapsed()).toBe(false);
  });

  it('openMobileDrawer() should set mobileDrawerOpen to true', () => {
    store.openMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);
  });

  it('closeMobileDrawer() should set mobileDrawerOpen to false', () => {
    store.openMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);
    store.closeMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(false);
  });

  it('toggleMobileDrawer() should toggle mobileDrawerOpen', () => {
    expect(store.mobileDrawerOpen()).toBe(false);
    store.toggleMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);
    store.toggleMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(false);
  });

  it('setTheme() should set currentTheme to dark', () => {
    expect(store.currentTheme()).toBe('light');
    store.setTheme('dark');
    expect(store.currentTheme()).toBe('dark');
  });

  it('setTheme() should set currentTheme to light', () => {
    store.setTheme('dark');
    expect(store.currentTheme()).toBe('dark');
    store.setTheme('light');
    expect(store.currentTheme()).toBe('light');
  });

  it('setLanguage() should set language to ar and dir to rtl', () => {
    store.setLanguage('ar');
    expect(store.language()).toBe('ar');
    expect(store.dir()).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('setLanguage() should set language to en and dir to ltr', () => {
    store.setLanguage('ar');
    store.setLanguage('en');
    expect(store.language()).toBe('en');
    expect(store.dir()).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
