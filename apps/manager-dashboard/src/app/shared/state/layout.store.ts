import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

type LayoutState = {
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  currentTheme: 'light' | 'dark';
  language: 'en' | 'ar';
  dir: 'ltr' | 'rtl';
};

const initialState: LayoutState = {
  sidebarCollapsed: false,
  mobileDrawerOpen: false,
  currentTheme: 'light',
  language: 'en',
  dir: 'ltr',
};

export const LayoutStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (store, documentRef = inject(DOCUMENT, { optional: true })) => ({
      // Toggle sidebar collapse state
      toggleSidebar(): void {
        patchState(store, {
          sidebarCollapsed: !store.sidebarCollapsed(),
        });
      },

      // Open mobile drawer (set to true)
      openMobileDrawer(): void {
        patchState(store, {
          mobileDrawerOpen: true,
        });
      },

      // Close mobile drawer (set to false)
      closeMobileDrawer(): void {
        patchState(store, {
          mobileDrawerOpen: false,
        });
      },

      // Toggle mobile drawer
      toggleMobileDrawer(): void {
        patchState(store, {
          mobileDrawerOpen: !store.mobileDrawerOpen(),
        });
      },

      // Set theme to light or dark
      setTheme(theme: 'light' | 'dark'): void {
        patchState(store, {
          currentTheme: theme,
        });
      },

      // Set language and update document direction
      setLanguage(language: 'en' | 'ar'): void {
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        patchState(store, {
          language,
          dir,
        });

        if (documentRef?.documentElement) {
          documentRef.documentElement.lang = language;
          documentRef.documentElement.dir = dir;
        }
      },
    })
  )
);
