// Stable foundation contract (plan Task 1 / DSN-003). Feature modules define
// their own typed projection extensions in their own contract files and read
// them via `readCase<FeatureProjection>`; they must not edit this file.

/** Canonical legal states for a Safety Case. */
export type Phase = 'Observe' | 'Check' | 'Pause' | 'Verify' | 'Recover' | 'Resolve';

/** The fast-read case projection. Not a second authority over event history. */
export interface CaseEnvelope {
  id: string;
  ownerUid: string;
  version: number;
  phase: Phase;
  planVersion: number;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp after which the case is no longer readable. Unset = never expires. */
  expiresAt?: string;
}

/**
 * Append-only, metadata-only event envelope. Never stores a raw command
 * payload or transcript text; see `commitCaseCommand`'s `requestHash`.
 */
export interface CaseEvent {
  id: string;
  caseId: string;
  actorUid: string;
  kind: string;
  at: string;
  causationId: string;
  policyVersion: string;
  modelVersion?: string;
  refs: string[];
  result: CaseCommandResult;
}

/** A client- or server-issued case command. Idempotent by `idempotencyKey`. */
export interface CaseCommand {
  caseId: string;
  actorUid: string;
  idempotencyKey: string;
  expectedVersion: number;
  kind: string;
  payload: unknown;
}

/** Minimal receipt returned for a committed (or replayed) command. */
export interface CaseCommandResult {
  id: string;
  version: number;
  phase: Phase;
}

/**
 * A pure function from the current (possibly feature-extended) projection
 * and the command to the next projection. `commitCaseCommand` stamps
 * `version`/`updatedAt` on the result; reducers must not set them.
 */
export type CaseReducer<T extends CaseEnvelope = CaseEnvelope> = (
  current: T,
  command: CaseCommand,
) => T;
