/** DSN-020 on-device signal from the native companion. A received message is a
 * CLAIM — never a verified fact and never an actually-paid record. */
export interface DsnSmsSignal {
  type: 'dsn:sms-signal';
  from: string;
  body: string;
  receivedAt: string; // ISO 8601
}

/** In-app representation after ingestion (adds a stable id for dedupe + React keys). */
export interface DeviceSignal {
  id: string;
  from: string;
  body: string;
  receivedAt: string;
}

/** Validate an untrusted `message` payload. Returns the typed signal only for a
 * well-formed dsn:sms-signal envelope; null for anything else. Never throws. */
export function parseSmsSignalMessage(data: unknown): DsnSmsSignal | null {
  let obj: unknown = data;
  if (typeof data === 'string') {
    try { obj = JSON.parse(data); } catch { return null; }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.type !== 'dsn:sms-signal') return null;
  if (typeof o.from !== 'string' || typeof o.body !== 'string' || typeof o.receivedAt !== 'string') return null;
  if (o.from.length === 0 || o.receivedAt.length === 0) return null;
  return { type: 'dsn:sms-signal', from: o.from, body: o.body, receivedAt: o.receivedAt };
}

/** Append a validated signal, de-duplicating on (from, receivedAt). The id is a
 * JSON tuple so a field containing the separator cannot forge a collision. */
export function ingestSmsSignal(current: DeviceSignal[], sig: DsnSmsSignal): DeviceSignal[] {
  const id = JSON.stringify([sig.from, sig.receivedAt]);
  if (current.some((s) => s.id === id)) return current;
  return [...current, { id, from: sig.from, body: sig.body, receivedAt: sig.receivedAt }];
}
