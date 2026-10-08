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
  it('rejects an envelope missing or mistyping required fields', () => {
    expect(parseSmsSignalMessage({ ...valid, from: undefined } as object)).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, body: 123 } as object)).toBeNull();
    expect(parseSmsSignalMessage({ ...valid, from: '' })).toBeNull();
  });
});

describe('ingestSmsSignal', () => {
  it('appends a signal with a stable id', () => {
    const out = ingestSmsSignal([], valid);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ from: valid.from, body: valid.body, receivedAt: valid.receivedAt });
    expect(out[0].id).toBeTruthy();
  });
  it('de-duplicates on (from, receivedAt)', () => {
    const once: DeviceSignal[] = ingestSmsSignal([], valid);
    expect(ingestSmsSignal(once, valid)).toHaveLength(1);
  });
});
