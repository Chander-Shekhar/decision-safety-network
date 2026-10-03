import { useId, useState } from 'react';
import type { Fact, FactOrigin } from '../../../packages/contracts/src/facts';

/**
 * Live-extraction status for this case's Decision Map, independent of the
 * controlled session's own `SessionStatus` (SessionScreen). `degraded` means
 * the model timed out/errored after its one retry; manual correct/confirm
 * controls remain available either way (see frame 02's "Failure remains
 * actionable" rule).
 */
export type DecisionMapStatus = 'live' | 'degraded';

const STATUS_COPY: Record<DecisionMapStatus, string> = {
  live: 'Decision Map · Live processing',
  degraded: 'Decision Map · Live processing degraded',
};

/**
 * Human label for a required fact field. Mirrors
 * `packages/contracts/src/facts.ts`'s `REQUIRED_FACT_FIELDS`; this file does
 * not import that list because it is view-only and must render whatever
 * fields it is given, even if the set changes.
 */
const FIELD_LABELS: Record<string, string> = {
  claimedIdentity: 'Claimed identity',
  centralClaim: 'Central claim',
  requestedAction: 'Requested action',
  amount: 'Amount',
  payee: 'Payee',
  deadline: 'Deadline',
  observedTactics: 'Observed tactics',
  verificationStatus: 'Verification status',
};

/**
 * Provenance label per the wireframes README's "Provenance is not truth"
 * rule: `Caller claimed`, `User confirmed`, and `User corrected` are
 * different states, and none of them means the underlying claim is genuine.
 * Every fact also carries the persistent "Not independently verified"
 * qualifier below, regardless of origin.
 */
const PROVENANCE_COPY: Record<FactOrigin, string> = {
  model: 'Caller claimed',
  'user-confirmed': 'User confirmed',
  'user-corrected': 'User corrected',
};

export interface DecisionMapProps {
  status?: DecisionMapStatus;
  /**
   * One currently-displayed `Fact` per field - callers pass the merged,
   * trusted-aware view (typically `confirmed[field] ?? facts[field]`); this
   * component does not merge `FactsProjection`'s two maps itself.
   */
  facts: Fact[];
  /**
   * Whether source segments are still retrievable. False once a session's
   * retention mode has let raw source links expire (PRD C12) - at that
   * point a fact can still be displayed and corrected, but its source
   * excerpt can no longer be viewed.
   */
  sourceRetained?: boolean;
  onViewSource?: (field: string, sourceSegmentIds: string[]) => void;
  onCorrect?: (field: string, value: string) => void;
  onConfirm?: (field: string) => void;
}

/**
 * The "Decision Map" panel from wireframe frame 02: every displayed fact
 * links to its supporting transcript excerpt (or says plainly that none is
 * retained) and can be corrected or confirmed by the owner (PRD C3). Never
 * displays a scam probability or mental-state label, and never implies a
 * claim is independently verified - only that the caller claimed it, or
 * that the owner confirmed or corrected what was said or entered.
 */
export function DecisionMap({
  status = 'live',
  facts,
  sourceRetained = true,
  onViewSource,
  onCorrect,
  onConfirm,
}: DecisionMapProps): React.JSX.Element {
  return (
    <section aria-label="Decision Map">
      <h2>Decision Map</h2>
      <p role="status">{STATUS_COPY[status]}</p>
      <p>Source IDs and corrections travel with the case.</p>

      <ol aria-label="Case facts">
        {facts.map((fact) => (
          <li key={fact.field}>
            <FactCard
              fact={fact}
              sourceRetained={sourceRetained}
              onViewSource={onViewSource}
              onCorrect={onCorrect}
              onConfirm={onConfirm}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

interface FactCardProps {
  fact: Fact;
  sourceRetained: boolean;
  onViewSource?: (field: string, sourceSegmentIds: string[]) => void;
  onCorrect?: (field: string, value: string) => void;
  onConfirm?: (field: string) => void;
}

function FactCard({ fact, sourceRetained, onViewSource, onCorrect, onConfirm }: FactCardProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const correctionInputId = useId();
  const isUnknown = fact.value === 'unknown';
  const hasSource = fact.sourceSegmentIds.length > 0;
  const label = FIELD_LABELS[fact.field] ?? fact.field;

  function submitCorrection(): void {
    if (draft.length === 0) {
      return;
    }
    onCorrect?.(fact.field, draft);
    setDraft('');
  }

  return (
    <div>
      <h3>{label}</h3>
      <p>{PROVENANCE_COPY[fact.origin]}</p>
      <p>Not independently verified.</p>
      <p>{isUnknown ? 'Unknown' : fact.value}</p>
      <p>Certainty: {fact.uncertainty}</p>

      {hasSource ? (
        sourceRetained ? (
          <button type="button" onClick={() => onViewSource?.(fact.field, fact.sourceSegmentIds)}>
            View source
          </button>
        ) : (
          <p>Source not retained</p>
        )
      ) : null}

      {fact.origin === 'model' && !isUnknown && (
        <button type="button" onClick={() => onConfirm?.(fact.field)}>
          Confirm {label.toLowerCase()}
        </button>
      )}

      <div>
        <label htmlFor={correctionInputId}>Correct {label.toLowerCase()}</label>
        <input id={correctionInputId} type="text" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button type="button" onClick={submitCorrection}>
          Correct
        </button>
      </div>
    </div>
  );
}
