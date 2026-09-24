import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia. Default to "not matching" (desktop)
// so existing tests keep exercising the desktop layout unless a test
// explicitly stubs a narrower result for useIsMobile.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
