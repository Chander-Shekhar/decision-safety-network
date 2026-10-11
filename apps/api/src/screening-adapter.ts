// Swappable third-party caller-ID / reputation adapter (DSN-024). The Cup
// ships only the simulated implementation; a real provider implements the
// same interface. The adapter's raw return is treated as untrusted and is
// normalized by `screening.ts` - nothing it returns is passed through.

import type { CallerIdSignal } from '../../../packages/contracts/src/screening.js';

export interface CallerIdAdapter {
  /** Looks up a normalized E.164-style number. May throw; callers degrade to no signal. */
  lookup(normalizedNumber: string): Promise<CallerIdSignal>;
}

/** Synthetic fixtures. +91 99999 000xx are demo numbers, not real subscribers. */
const SIMULATED_SIGNALS: Readonly<Record<string, CallerIdSignal>> = {
  '+919999900001': { category: 'spam-reported', reportCount: 214 },
  '+919999900002': { category: 'unknown' },
};

/** Deterministic simulated provider. Unlisted numbers return no signal. */
export function createSimulatedCallerIdAdapter(): CallerIdAdapter {
  return {
    async lookup(normalizedNumber) {
      return SIMULATED_SIGNALS[normalizedNumber] ?? { category: 'no-signal' };
    },
  };
}
