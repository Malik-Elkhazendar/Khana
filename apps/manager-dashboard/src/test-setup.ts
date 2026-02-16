import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  class MockIntersectionObserver {
    constructor(
      private readonly callback: IntersectionObserverCallback,
      private readonly options?: IntersectionObserverInit
    ) {
      void this.callback;
      void this.options;
    }

    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  const win = window as typeof window & {
    IntersectionObserver?: typeof IntersectionObserver;
  };

  win.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
  (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
    win.IntersectionObserver;
}
