// Shared Vitest setup for @dsn/web component tests.
// Registers jest-dom matchers (toBeVisible, toBeChecked, toBeDisabled, ...)
// and auto-cleans the DOM between tests. Feature tasks rely on this.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
