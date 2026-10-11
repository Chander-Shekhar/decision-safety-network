import { announceCapturePolicy, nextLiveSegment, parseCaptureStatusMessage, parseTranscriptSegmentMessage } from './liveTranscript';

const ok = { type: 'dsn:transcript-segment', text: ' move it now ', at: '2026-10-12T10:00:00.000Z' };

describe('parseTranscriptSegmentMessage', () => {
  it('accepts an object or JSON string envelope and trims text', () => {
    expect(parseTranscriptSegmentMessage(ok)?.text).toBe('move it now');
    expect(parseTranscriptSegmentMessage(JSON.stringify(ok))?.at).toBe(ok.at);
  });
  it.each([
    ['foreign type', { ...ok, type: 'dsn:sms-signal' }],
    ['missing text', { type: ok.type, at: ok.at }],
    ['blank text', { ...ok, text: '   ' }],
    ['missing at', { type: ok.type, text: 'x' }],
    ['non-string', 42],
    ['null', null],
    ['bad json', '{nope'],
  ])('rejects %s', (_n, v) => expect(parseTranscriptSegmentMessage(v)).toBeNull());
});

describe('parseCaptureStatusMessage', () => {
  it('accepts a boolean status and rejects others', () => {
    expect(parseCaptureStatusMessage({ type: 'dsn:capture-status', active: true })?.active).toBe(true);
    expect(parseCaptureStatusMessage({ type: 'dsn:capture-status', active: 'yes' })).toBeNull();
    expect(parseCaptureStatusMessage(ok)).toBeNull();
  });
});

describe('announceCapturePolicy', () => {
  const plan = { callListening: 'per-call', processingConsent: true, setupCompletedAt: '2026-10-12T00:00:00.000Z' };
  it('is inert without a native bridge', () => {
    expect(() => announceCapturePolicy(plan, undefined)).not.toThrow();
  });
  it('allows capture only for a completed plan with processing consent and a listening preference', () => {
    const post = vi.fn();
    announceCapturePolicy(plan, { postMessage: post });
    expect(JSON.parse(post.mock.calls[0][0])).toEqual({ type: 'dsn:capture-policy', allowed: true, callListening: 'per-call' });
    announceCapturePolicy({ ...plan, processingConsent: false }, { postMessage: post });
    expect(JSON.parse(post.mock.calls[1][0]).allowed).toBe(false);
    announceCapturePolicy(null, { postMessage: post });
    expect(JSON.parse(post.mock.calls[2][0])).toEqual({ type: 'dsn:capture-policy', allowed: false, callListening: null });
  });
});

describe('nextLiveSegment', () => {
  it('assigns the next gap-free order after existing segments and skips duplicates', () => {
    const seen = new Set<string>();
    const existing = [
      { id: 'seg-1', order: 1, speaker: 'caller', text: 'a' },
      { id: 'seg-2', order: 2, speaker: 'caller', text: 'b' },
    ];
    const sig = parseTranscriptSegmentMessage(ok)!;
    expect(nextLiveSegment(existing, seen, sig)).toEqual({ id: 'seg-3', order: 3, speaker: 'caller', text: 'move it now' });
    expect(nextLiveSegment(existing, seen, sig)).toBeNull();
  });
});
