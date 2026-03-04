import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

if (typeof window !== 'undefined') {
  const win = window as Window &
    typeof globalThis & {
      IntersectionObserver?: typeof IntersectionObserver;
    };

  if (win.IntersectionObserver) {
    // Already available in runtime.
  } else {
    class MockIntersectionObserver {
      constructor(
        private readonly callback: IntersectionObserverCallback,
        private readonly options?: IntersectionObserverInit
      ) {
        void this.callback;
        void this.options;
      }

      observe(): void {
        void this.callback;
      }

      unobserve(): void {
        void this.options;
      }

      disconnect(): void {
        void this.callback;
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    const mock =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    win.IntersectionObserver = mock;
    (
      globalThis as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver = mock;
  }
}
