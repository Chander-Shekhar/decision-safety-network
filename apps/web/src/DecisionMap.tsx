import { useState } from 'react';
import type { Fact, FactOrigin } from '../../../packages/contracts/src/facts';
import type { WebVerificationEvidence } from '../../../packages/contracts/src/web-verification';
import { WebEvidenceList } from './VerifyPanel';
import { ActionBar, Button, Card, Disclosure, Field } from './ui';

/**
 * Live-extraction status for this case's Decision Map, independent of the
 * controlled session's own `SessionStatus` (SessionScreen). `degraded` means
 * the model timed out/errored after its one retry; the correction path stays
 * available either way (see frame 02's "Failure remains actionable" rule).
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
 * rule: `Caller claimed`, `You confirmed`, and `You corrected` are different
 * states, and none of them means the underlying claim is genuine. Shown as a
 * quiet inline tag (glyph + label, never color alone) on every fact.
 *
 * Note the owner-facing wording: `user-confirmed` reads "You confirmed what
 * was said" — attesting the extraction captured the call accurately, never
 * that the claim is true. The UI no longer offers a per-fact "Confirm"
 * endorsement control (it read as endorsing the caller's claim); the single
 * step-level "This matches the call" action attests accuracy in bulk.
 */
const PROVENANCE_COPY: Record<FactOrigin, string> = {
  model: 'Caller claimed',
  'user-confirmed': 'You confirmed what was said',
  'user-corrected': 'You corrected this',
};

const PROVENANCE_GLYPH: Record<FactOrigin, string> = {
  model: '?',
  'user-confirmed': '✓',
  'user-corrected': '✎',
};

/** A displayable transcript excerpt backing a fact, resolved by the caller from cited segment ids. */
export interface SourceExcerpt {
  speaker: string;
  text: string;
}

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
   * point a fact can still be displayed, but its source excerpt can no
   * longer be viewed.
   */
  sourceRetained?: boolean;
  /** Untrusted public-web evidence about the claimed identity (DSN-026); shown under that fact only. */
  webEvidence?: readonly WebVerificationEvidence[];
  /**
   * Resolve a fact's cited segment ids to displayable transcript excerpts for
   * the inline "View source" reveal. Returning an empty list renders a plain
   * "excerpt unavailable" note rather than a broken control.
   */
  resolveSource?: (sourceSegmentIds: string[]) => readonly SourceExcerpt[];
}

/**
 * The "Decision Map" panel from wireframe frame 02 — now read-only. It reframes
 * a persuasive live call into a short, scannable list of discrete claims: each
 * fact is labeled as something the caller *said* (not verified truth), tagged
 * with its provenance and uncertainty, and backed by the exact transcript
 * excerpt (revealed inline via "View source"). It never displays a scam
 * probability or mental-state label and never implies a claim is independently
 * verified. Correcting a misheard fact and attesting the facts are a good match
 * for the call are both handled at the step level (see `FactCorrectionPanel`
 * and the Review step's "This matches the call" action), not per-fact here.
 */
export function DecisionMap({
  status = 'live',
  facts,
  sourceRetained = true,
  webEvidence,
  resolveSource,
}: DecisionMapProps): React.JSX.Element {
  return (
    <section aria-label="Decision Map">
      <Card title="Decision Map">
        <p className="text-text-muted">
          The key points pulled from the call, one by one. Each is only what the caller <em>said</em> — none of it is
          independently verified. Open a source to see the exact words.
        </p>
        <p role="status" className="text-xs font-medium text-text-muted">
          {STATUS_COPY[status]}
        </p>

        <ol aria-label="Case facts" className="flex flex-col divide-y divide-border">
          {facts.map((fact) => (
            <li key={fact.field} className="py-space-3 first:pt-0 last:pb-0">
              <FactCard
                fact={fact}
                sourceRetained={sourceRetained}
                webEvidence={fact.field === 'claimedIdentity' ? webEvidence : undefined}
                resolveSource={resolveSource}
              />
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

interface FactCardProps {
  fact: Fact;
  sourceRetained: boolean;
  webEvidence?: readonly WebVerificationEvidence[];
  resolveSource?: (sourceSegmentIds: string[]) => readonly SourceExcerpt[];
}

function FactCard({ fact, sourceRetained, webEvidence, resolveSource }: FactCardProps): React.JSX.Element {
  const [showSource, setShowSource] = useState(false);
  const isUnknown = fact.value === 'unknown';
  const hasSource = fact.sourceSegmentIds.length > 0;
  const label = FIELD_LABELS[fact.field] ?? fact.field;
  const excerpts = showSource ? (resolveSource?.(fact.sourceSegmentIds) ?? []) : [];

  return (
    <div className="flex flex-col gap-space-2">
      <div className="flex flex-wrap items-baseline justify-between gap-space-2">
        <h3 className="text-sm font-medium text-text-muted">{label}</h3>
        <span className="inline-flex items-center gap-space-1 rounded-pill bg-surface-sunken px-space-2 text-xs text-text-muted">
          <span aria-hidden="true">{PROVENANCE_GLYPH[fact.origin]}</span>
          {PROVENANCE_COPY[fact.origin]}
        </span>
      </div>
      {fact.uncertainty !== 'low' && (
        <p className="text-xs text-text-muted">
          <span aria-hidden="true">~ </span>
          {fact.uncertainty === 'high' ? 'Low confidence' : 'Unconfirmed'}
        </p>
      )}
      <p className="text-base font-medium">{isUnknown ? 'Unknown' : fact.value}</p>
      <WebEvidenceList evidence={webEvidence} />

      {hasSource &&
        (sourceRetained ? (
          <div className="flex flex-col gap-space-2">
            <ActionBar>
              <Button variant="secondary" size="sm" onClick={() => setShowSource((v) => !v)}>
                {showSource ? 'Hide source' : 'View source'}
              </Button>
            </ActionBar>
            {showSource && (
              <div className="rounded-md bg-surface-sunken p-space-3 text-sm" aria-label={`Source for ${label.toLowerCase()}`}>
                {excerpts.length > 0 ? (
                  excerpts.map((e, i) => (
                    <p key={i}>
                      <span className="text-text-muted">{e.speaker}: </span>
                      {e.text}
                    </p>
                  ))
                ) : (
                  <p className="text-text-muted">Source excerpt unavailable.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-text-muted">Source not retained</span>
        ))}
    </div>
  );
}

export interface FactCorrectionPanelProps {
  facts: Fact[];
  /** Apply one or more corrections at once; each `{ field, value }` becomes a `user-corrected` fact. */
  onApply: (corrections: { field: string; value: string }[]) => void;
}

/**
 * The single, on-demand correction path for the Decision Map. Collapsed by
 * default so the map reads as clean read-only facts; opening it reveals one
 * input per fact, pre-placeholdered with the current value. The owner fixes as
 * many as they need and applies them in one go — the per-fact "Correct"
 * controls that cluttered every row are gone. Framed as "what was actually
 * said", not endorsement (PRD line 773: every claim has a correction path).
 */
export function FactCorrectionPanel({ facts, onApply }: FactCorrectionPanelProps): React.JSX.Element {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const pending = Object.entries(drafts)
    .map(([field, value]) => ({ field, value: value.trim() }))
    .filter((c) => c.value.length > 0);

  return (
    <section aria-label="Correct the facts">
      <Disclosure summary="Not right? Correct it">
        <div className="flex flex-col gap-space-4">
          <p className="text-sm text-text-muted">
            Change anything we misheard — you&apos;re telling us what was actually said, not vouching that it&apos;s true.
            Fix as many as you need, then apply.
          </p>
          {facts.map((fact) => {
            const label = FIELD_LABELS[fact.field] ?? fact.field;
            const id = `correct-${fact.field}`;
            return (
              <Field key={fact.field} label={label} htmlFor={id}>
                <input
                  id={id}
                  type="text"
                  value={drafts[fact.field] ?? ''}
                  placeholder={fact.value === 'unknown' ? 'Unknown' : fact.value}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [fact.field]: event.target.value }))}
                  className="rounded-md border border-border bg-surface-raised px-space-3 py-space-2 text-text"
                />
              </Field>
            );
          })}
          <ActionBar>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending.length === 0}
              onClick={() => {
                onApply(pending);
                setDrafts({});
              }}
            >
              {pending.length > 1 ? `Apply ${pending.length} corrections` : 'Apply correction'}
            </Button>
          </ActionBar>
        </div>
      </Disclosure>
    </section>
  );
}
