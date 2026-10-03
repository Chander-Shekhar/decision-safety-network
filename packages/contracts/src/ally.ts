// Case-scoped Safety Ally contract (plan Task 9 / DSN-011). Mirrors case.ts
// and evidence.ts's split: this file holds only types and constants;
// Firestore-touching preview/grant/revoke/read/respond logic lives in
// apps/api/src/{ally,ally-routes}.ts and must not be duplicated here.

/** One selected excerpt in the packet: the id and exact text only - no speaker, order, or segment link. */
export interface AllyPacketEvidence {
  id: string;
  excerpt: string;
}

/**
 * The minimum allowlisted packet content (PRD C8). Built field-by-field,
 * never by deleting fields from a case object, so a new case field can
 * never leak by default. `amountMinor` is `null` when no draft exists.
 */
export interface AllyPacketContent {
  claim: string;
  proposedAction: string;
  amountMinor: number | null;
  verificationGap: string;
  selectedEvidence: AllyPacketEvidence[];
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
  'selectedEvidence',
  'verificationGap',
] as const;

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
  selectedEvidenceIds: string[];
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
  | { idempotencyKey: string; kind: 'checked-source'; source: string };
