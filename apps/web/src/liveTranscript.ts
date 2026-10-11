import type { SessionSegmentView } from './SessionScreen';

/** DSN-025 prototype capture: a final speech-to-text segment from the native companion. The
 * audio itself never reaches the web client; only recognised text does. */
export interface DsnTranscriptSegment {
  type: 'dsn:transcript-segment';
  text: string;
  at: string; // ISO 8601
}

/** Native capture lifecycle, so the "recording" label is shown only while actually capturing. */
export interface DsnCaptureStatus {
  type: 'dsn:capture-status';
  active: boolean;
  /** True only when native is using the platform ON-DEVICE recognizer (API 31+); never assumed otherwise. */
  onDevice: boolean;
}

function asRecord(data: unknown): Record<string, unknown> | null {
  let obj: unknown = data;
  if (typeof data === 'string') {
    try { obj = JSON.parse(data); } catch { return null; }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  return obj as Record<string, unknown>;
}

/** Validate an untrusted `message` payload. Never throws; null for anything but a well-formed envelope. */
export function parseTranscriptSegmentMessage(data: unknown): DsnTranscriptSegment | null {
  const o = asRecord(data);
  if (!o || o.type !== 'dsn:transcript-segment') return null;
  if (typeof o.text !== 'string' || typeof o.at !== 'string' || o.at.length === 0) return null;
  const text = o.text.trim();
  if (text.length === 0) return null;
  return { type: 'dsn:transcript-segment', text, at: o.at };
}

export function parseCaptureStatusMessage(data: unknown): DsnCaptureStatus | null {
  const o = asRecord(data);
  if (!o || o.type !== 'dsn:capture-status' || typeof o.active !== 'boolean') return null;
  return { type: 'dsn:capture-status', active: o.active, onDevice: o.active && o.onDevice === true };
}

/** Tell the native shell (if any) the owner's saved call-listening preference, so capture can be
 * gated on it. `sessionEnded` (processing revoked / session closed) forces allowed:false so the mic stops. Inert in a plain browser (no `ReactNativeWebView`). Carries no call content. */
export function announceCapturePolicy(
  plan: { callListening?: string; processingConsent?: boolean; setupCompletedAt?: string } | null,
  sessionEnded = false,
  target: { postMessage(m: string): void } | undefined = (window as unknown as { ReactNativeWebView?: { postMessage(m: string): void } }).ReactNativeWebView,
): void {
  if (!target) return;
  const allowed = !sessionEnded && !!plan?.setupCompletedAt && !!plan.callListening && plan.processingConsent === true;
  target.postMessage(JSON.stringify({ type: 'dsn:capture-policy', allowed, callListening: plan?.callListening ?? null }));
}

/** Build the next gap-free, in-order segment of the same pipeline the controlled transcript
 * uses. Returns null for a duplicate (same `at` + text). `seen` carries accepted keys. */
export function nextLiveSegment(
  current: SessionSegmentView[],
  seen: Set<string>,
  sig: DsnTranscriptSegment,
): SessionSegmentView | null {
  const key = JSON.stringify([sig.at, sig.text]);
  if (seen.has(key)) return null;
  seen.add(key);
  const order = current.reduce((m, s) => Math.max(m, s.order), 0) + 1;
  return { id: `seg-${order}`, order, speaker: 'caller', text: sig.text };
}
