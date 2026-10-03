import { describe, expect, it } from 'vitest';
import type { Phase } from '@dsn/contracts';
import { transition } from '../src/transitions.js';

/**
 * The canonical Cup state-transition table, copied verbatim from the locked
 * PRD's "Canonical Cup state transitions" (which matches plan Task 5's
 * executable table exactly - no reconciliation was needed). Duplicated here
 * deliberately: this test asserts `transition` against the *specification*,
 * not against its own implementation.
 */
const PRD_ALLOWED: Readonly<Record<Phase, readonly Phase[]>> = {
  Observe: ['Check', 'Recover', 'Resolve'],
  Check: ['Observe', 'Pause', 'Verify', 'Recover', 'Resolve'],
  Pause: ['Check', 'Verify', 'Recover', 'Resolve'],
  Verify: ['Pause', 'Recover', 'Resolve'],
  Recover: ['Resolve'],
  Resolve: ['Recover'],
};

const ALL_PHASES: readonly Phase[] = ['Observe', 'Check', 'Pause', 'Verify', 'Recover', 'Resolve'];

describe('transition: every allowed pair in the PRD table succeeds', () => {
  for (const from of ALL_PHASES) {
    for (const to of PRD_ALLOWED[from]) {
      it(`${from} -> ${to}`, () => {
        expect(transition(from, to, 'test-cause')).toBe(to);
      });
    }
  }
});

describe('transition: every pair not in the PRD table throws ILLEGAL_TRANSITION', () => {
  for (const from of ALL_PHASES) {
    for (const to of ALL_PHASES) {
      if (PRD_ALLOWED[from].includes(to)) {
        continue;
      }
      it(`${from} -> ${to} (including no-op self-transitions)`, () => {
        expect(() => transition(from, to, 'test-cause')).toThrow('ILLEGAL_TRANSITION');
      });
    }
  }
});

describe('transition: plan Task 5 literal examples', () => {
  it("throws for Observe -> Pause with cause 'model'", () => {
    expect(() => transition('Observe', 'Pause', 'model')).toThrow('ILLEGAL_TRANSITION');
  });

  it("allows Resolve -> Recover with cause 'already-paid'", () => {
    expect(transition('Resolve', 'Recover', 'already-paid')).toBe('Recover');
  });
});

describe('transition: cause is opaque audit metadata and never grants permission', () => {
  it('a model-attributed cause cannot unlock an illegal pair', () => {
    expect(() => transition('Observe', 'Verify', 'model')).toThrow('ILLEGAL_TRANSITION');
    expect(() => transition('Resolve', 'Pause', 'model')).toThrow('ILLEGAL_TRANSITION');
  });

  it('a model-timeout cause still only permits legal pairs', () => {
    expect(() => transition('Observe', 'Pause', 'model-timeout')).toThrow('ILLEGAL_TRANSITION');
    expect(transition('Check', 'Verify', 'model-timeout')).toBe('Verify');
  });

  it('a user-override cause does not bypass the table either way', () => {
    expect(transition('Pause', 'Check', 'user-override')).toBe('Check');
    expect(() => transition('Pause', 'Observe', 'user-override')).toThrow('ILLEGAL_TRANSITION');
  });

  it('a correction-rollback cause follows the same table as any other cause', () => {
    expect(transition('Pause', 'Check', 'correction-rollback')).toBe('Check');
    expect(() => transition('Verify', 'Check', 'correction-rollback')).toThrow('ILLEGAL_TRANSITION');
  });

  it('an empty cause string is still accepted as opaque metadata (never required to be meaningful for legality)', () => {
    expect(transition('Observe', 'Check', '')).toBe('Check');
  });
});

describe('transition: Resolve -> Recover is the only same-case transition out of Resolve', () => {
  it('rejects Resolve -> Observe/Check/Pause/Verify/Resolve', () => {
    expect(() => transition('Resolve', 'Observe', 'reopen')).toThrow('ILLEGAL_TRANSITION');
    expect(() => transition('Resolve', 'Check', 'reopen')).toThrow('ILLEGAL_TRANSITION');
    expect(() => transition('Resolve', 'Pause', 'reopen')).toThrow('ILLEGAL_TRANSITION');
    expect(() => transition('Resolve', 'Verify', 'reopen')).toThrow('ILLEGAL_TRANSITION');
    expect(() => transition('Resolve', 'Resolve', 'reopen')).toThrow('ILLEGAL_TRANSITION');
  });
});

describe('transition: thrown error is a real Error with the exact message', () => {
  it('message is exactly ILLEGAL_TRANSITION', () => {
    try {
      transition('Observe', 'Pause', 'model');
      expect.unreachable('expected transition to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('ILLEGAL_TRANSITION');
    }
  });
});
