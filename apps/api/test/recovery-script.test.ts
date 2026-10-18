import { describe, it, expect } from 'vitest';
import { buildGuidedFreeze, withGeneratedScript } from '../src/recovery-freeze.js';

const known = { facts: { centralClaim: 'Account compromised' }, evidenceIds: [] };
const proposed = { payee: 'safe-new', amountMinor: 5_000_000 };
const state = () => ({ known, paidPayment: null, proposedPayment: proposed, guidedFreeze: buildGuidedFreeze({ known, paidPayment: null, proposed }) });

describe('withGeneratedScript', () => {
  it('uses the model-written script and sends only sanitised case facts', async () => {
    let seen: Record<string, string> = {};
    const out = await withGeneratedScript(state(), { write: async (s) => ((seen = s), 'Hello, I was scammed and paid money. Please hold my account.') });
    expect(out.guidedFreeze.script).toMatch(/^Hello, I was scammed/);
    expect(seen).toMatchObject({ paidTo: 'safe-new', amountPaid: 'Rs 50,000', callerClaimed: 'Account compromised' });
  });
  it('keeps the template when the writer fails or returns too little', async () => {
    const base = state();
    expect((await withGeneratedScript(base, { write: async () => { throw new Error('down'); } })).guidedFreeze.script).toBe(base.guidedFreeze.script);
    expect((await withGeneratedScript(base, { write: async () => 'ok' })).guidedFreeze.script).toBe(base.guidedFreeze.script);
  });
});
