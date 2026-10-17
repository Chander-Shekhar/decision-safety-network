// Case-scoped Safety Ally contract (plan Task 9 / DSN-011). Mirrors case.ts
// and evidence.ts's split: this file holds only types and constants;
// Firestore-touching preview/grant/revoke/read/respond logic lives in
// apps/api/src/{ally,ally-routes}.ts and must not be duplicated here.

/**
 * The minimum allowlisted packet content (PRD C8). Built field-by-field,
 * never by deleting fields from a case object, so a new case field can
 * never leak by default. `amountMinor` is `null` when no draft exists.
 * `summary` is a short, AI-derived gist of the call (composed from the
 * extracted facts) - never raw transcript excerpts.
 */
export interface AllyPacketContent {
  claim: string;
  proposedAction: string;
  amountMinor: number | null;
  verificationGap: string;
  summary: string;
}

/** What the ally receives: the frozen content plus the case and grant-expiry identifiers. */
export interface AllyPacket extends AllyPacketContent {
  caseId: string;
  expiresAt: string;
}

/** The exact set of keys an `AllyPacket` may ever carry. */
export const ALLY_PACKET_KEYS = [
  'amountMinor',
  'caseId',
  'claim',
  'expiresAt',
  'proposedAction',
  'summary',
  'verificationGap',
] as const;

/**
 * Who shared a case, for the ally to reach: the owner's self-entered profile.
 * Deliberately NOT part of `AllyPacket` (a hash-pinned allowlist); read through
 * its own route after the same authorization recheck.
 */
export interface AllySharer {
  caseId: string;
  displayName?: string;
  mobile?: string;
}

/** One case shared with the signed-in ally, for the ally's auto-discovered list. Lightweight: no packet body. */
export interface AllyGrantedCase {
  caseId: string;
  claim: string;
  expiresAt: string;
}

/**
 * The owner-only preview: the exact content an ally would see, bound to the
 * case version and content hash. Creating one grants nothing.
 */
export interface AllyPreview {
  caseId: string;
  caseVersion: number;
  packetHash: string;
  packetContent: AllyPacketContent;
}

/**
 * A case-specific grant to one ally. `packetSnapshot` is the frozen content
 * shown in the preview; revocation purges it (and the selection) to `null`
 * / `[]` so a revoked grant retains no case content.
 */
export interface AllyGrant {
  caseId: string;
  allyUid: string;
  packetSnapshot: AllyPacketContent | null;
  packetHash: string;
  expiresAt: string;
  revokedAt?: string;
}

/**
 * The only responses an ally can record. There is deliberately no payment
 * command, no caller-certification, and no transfer-control member.
 */
export type AllyResponse =
  | { idempotencyKey: string; kind: 'contact-request' }
  | { idempotencyKey: string; kind: 'pause-recommendation' }
  | { idempotencyKey: string; kind: 'contact-caller' }
  | { idempotencyKey: string; kind: 'checked-source'; source: string };

/**
 * DSN-027: a WhatsApp share built ONLY from the already-granted minimum
 * packet. `url` is a `https://wa.me/?text=` link the human opens; nothing is
 * sent server-side.
 */
export interface AllyWhatsAppSummary {
  caseId: string;
  text: string;
  url: string;
  expiresAt: string;
}

/**
 * DSN-027: the ally's "contact the caller on the owner's behalf" preparation.
 * It records an advisory response and returns a script; it never dials,
 * grants fund control, or certifies the caller.
 */
export interface AllyCallerContact {
  caseId: string;
  script: string;
  canControlFunds: false;
  canCertifyCaller: false;
}
