import { parseSmsSignalMessage, ingestSmsSignal, type DeviceSignal, type DsnSmsSignal } from './deviceSignals';

const valid: DsnSmsSignal = { type: 'dsn:sms-signal', from: 'VM-DEMOBK', body: 'Your a/c is blocked. Call 1800...', receivedAt: '2026-10-07T10:00:00.000Z' };

describe('parseSmsSignalMessage', () => {
  it('accepts a well-formed envelope object', () => {
    expect(parseSmsSignalMessage(valid)).toEqual(valid);
  });
  it('accepts the same envelope as a JSON string', () => {
    expect(parseSmsSignalMessage(JSON.stringify(valid))).toEqual(valid);
  });
  it('rejects a foreign message (wrong/absent type tag) with null', () => {
    expect(parseSmsSignalMessage({ type: 'webpackHotUpdate' })).toBeNull();
    expect(parseSmsSignalMessage({ from: 'x', body: 'y', receivedAt: 'z' })).toBeNull();
  });
  it('rejects malformed JSON and non-objects without throwing', () => {
    expect(parseSmsSignalMessage('{not json')).toBeNull();
    expect(parseSmsSignalMessage(42)).toBeNull();
    expect(parseSmsSignalMessage(null)).toBeNull();
  });
  it('rejects an envelope missing or mistyping any required field', () => {
    expect(parseSmsSignalMessage({ ...valid, from: undefined } as object)).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, body: 123 } as object)).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, receivedAt: undefined } as object)).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, from: '' })).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, receivedAt: '' })).toBeNull();
  });
  it('rejects array input and a __proto__-polluting payload without honoring injected keys', () => {
    expect(parseSmsSignalMessage([valid])).toBeNull();
    const polluted = parseSmsSignalMessage(JSON.stringify({ ...valid, __proto__: { injected: true } }));
    expect(polluted).toEqual(valid);
    expect(({} as Record<string, unknown>).injected).toBeUndefined();
  });
  it('strips extra fields, returning only the typed envelope', () => {
    const parsed = parseSmsSignalMessage({ ...valid, extra: 'ignored', amountMinor: 5000000 });
    expect(parsed).toEqual(valid);
    expect(parsed).not.toHaveProperty('extra');
  });
});

describe('ingestSmsSignal', () => {
  it('appends a signal with a stable id', () => {
    const out = ingestSmsSignal([], valid);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ from: valid.from, body: valid.body, receivedAt: valid.receivedAt });
    expect(out[0].id).toBeTruthy();
  });
  it('de-duplicates on (from, receivedAt) without mutating the input array', () => {
    const once: DeviceSignal[] = ingestSmsSignal([], valid);
    const again = ingestSmsSignal(once, valid);
    expect(again).toHaveLength(1);
    expect(once).toHaveLength(1); // original not mutated
  });
  it('appends a signal that differs in from or receivedAt', () => {
    const once = ingestSmsSignal([], valid);
    expect(ingestSmsSignal(once, { ...valid, receivedAt: '2026-10-07T10:01:00.000Z' })).toHaveLength(2);
    expect(ingestSmsSignal(once, { ...valid, from: 'OTHER' })).toHaveLength(2);
  });
  it('does not collide when a field contains the id separator character', () => {
    const a = ingestSmsSignal([], { ...valid, from: 'a|b', receivedAt: 'c' });
    expect(ingestSmsSignal(a, { ...valid, from: 'a', receivedAt: 'b|c' })).toHaveLength(2);
  });
});
