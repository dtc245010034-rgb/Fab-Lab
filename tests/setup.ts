import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library's auto-cleanup is not registered.
afterEach(() => {
  cleanup();
});

// jsdom has no 2-D canvas and logs "not implemented" on every getContext call. Tests that reach
// a canvas get null, as in a browser that refuses a context; drawing is checked in a real browser.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement['getContext'];
}
