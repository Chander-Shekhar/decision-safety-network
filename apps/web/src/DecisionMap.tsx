import { useId, useState } from 'react';
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
  live: 'Live processing',
  degraded: 'Live processing degraded',
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
  procedureCheck: 'Procedure check',
};

/**
 * Fields that are the model's *read* of the conversation — the manipulation
 * patterns it recognised and its judgment of whether what was asked is a
 * legitimate procedure — not something the caller said. Pulled out of the
 * caller-claims list and shown as highlighted observations so the owner doesn't
 * mistake analysis for an extracted quote. Both are LLM-produced per call (see
 * `EXTRACT_FIELD_GUIDANCE` in apps/api/src/gemini.ts), never a fixed keyword
 * list, so they generalise across scam shapes.
 */
const OBSERVATION_FIELDS = new Set(['observedTactics', 'procedureCheck']);

/**
 * Fields kept out of the map entirely. `verificationStatus` is the model's
 * terse note on the caller's own verification gap (e.g. "Unverified") — it reads
 * as meaningless to the owner and duplicates the real, automatic public-listings
 * check shown under Claimed identity, so we don't surface it here. It still
 * flows to the report/ally packet via the facts projection.
 */
const HIDDEN_FROM_MAP = new Set(['verificationStatus']);

/**
 * Owner-facing marker for a fact the owner has acted on. Only the non-default
 * states are shown — a model-extracted fact carries no per-row tag (the map
 * header already frames every point as an unverified caller claim, and a pill
 * on all ~8 rows was just clutter). `user-confirmed` reads "You confirmed what
 * was said" — attesting the extraction captured the call accurately, never that
 * the claim is true. There is no per-fact "Confirm" endorsement control, and no
 * separate attest button: advancing out of the step (the single Next action)
 * attests the facts in bulk.
 */
const PROVENANCE_COPY: Partial<Record<FactOrigin, string>> = {
  'user-confirmed': 'You confirmed what was said',
  'user-corrected': 'You corrected this',
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
 * The "What we heard" panel from wireframe frame 02 — read-only. It reframes a
 * persuasive live call into a short, scannable list of discrete claims: each
 * fact is labeled as something the caller *said* (not verified truth), tagged
 * with its provenance and uncertainty, and backed by the exact transcript
 * excerpt (revealed via "View source"). Below the claims sits "What we noticed"
 * — the model's observations (tactics, procedure check). It never displays a
 * scam probability or mental-state label and never implies a claim is
 * independently verified. Correcting a misheard fact and attesting the facts
 * match the call are handled at the step level (see `FactCorrectionPanel` and
 * the Review step's forward action), not per-fact here.
 */
export function DecisionMap({
  status = 'live',
  facts,
  sourceRetained = true,
  webEvidence,
  resolveSource,
}: DecisionMapProps): React.JSX.Element {
  // Caller claims (shown as fact rows) vs the model's observations (shown highlighted, separately).
  const extracted = facts.filter((f) => !OBSERVATION_FIELDS.has(f.field) && !HIDDEN_FROM_MAP.has(f.field));
  const observations = facts.filter((f) => OBSERVATION_FIELDS.has(f.field) && f.value !== 'unknown');

  return (
    <section aria-label="What we heard">
      <Card title="What we heard">
        <p className="text-text-muted">
          The key points pulled from the call, one by one. Each is only what the caller <em>said</em> — none of it is
          independently verified. Open a source to see the exact words.
        </p>
        <p role="status" className="text-xs font-medium text-text-muted">
          {STATUS_COPY[status]}
        </p>

        <ol aria-label="Case facts" className="flex flex-col divide-y divide-border">
          {extracted.map((fact) => (
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

        <ObservationList observations={observations} />
      </Card>
    </section>
  );
}

/**
 * Our read of the conversation — the manipulation patterns we recognised plus a
 * plain-language procedure check — rendered as highlighted observations, visually
 * distinct from the caller-claim fact rows above. These are our analysis, not
 * quotes, so they carry no "View source" and no caller-claim framing. This is a
 * warning surface — it tells the owner they may be being manipulated — so it uses
 * the scoped alert (red) treatment, not the calm info blue.
 */
function ObservationList({ observations }: { observations: Fact[] }): React.JSX.Element | null {
  if (observations.length === 0) return null;
  return (
    <section
      aria-label="What we noticed"
      className="mt-space-4 flex flex-col gap-space-2 rounded-md border-l-4 border-alert bg-alert-soft p-space-3"
    >
      <div>
        <h3 className="text-sm font-semibold text-alert">What we noticed</h3>
        <p className="text-xs text-text-muted">Signs the caller may be trying to manipulate you</p>
      </div>
      <ul className="flex flex-col gap-space-2">
        {observations.map((o) => (
          <li key={o.field} className="flex flex-col gap-space-1">
            <p className="text-sm font-semibold text-text">{FIELD_LABELS[o.field] ?? o.field}</p>
            <p className="text-base font-normal text-text">{o.value}</p>
          </li>
        ))}
      </ul>
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
  const isUnknown = fact.value === 'unknown';
  const hasSource = fact.sourceSegmentIds.length > 0;
  const label = FIELD_LABELS[fact.field] ?? fact.field;
  const provenance = PROVENANCE_COPY[fact.origin];
  const excerpts = hasSource ? (resolveSource?.(fact.sourceSegmentIds) ?? []) : [];

  return (
    <div className="flex flex-col gap-space-1">
      {/* Label is the hero — it tells you WHAT this is (a claimed identity, a requested action).
          "View source" sits quietly in the corner as a hover/focus popover, out of the reading flow. */}
      <div className="flex items-start justify-between gap-space-3">
        <h3 className="text-sm font-semibold text-text">{label}</h3>
        {hasSource &&
          (sourceRetained ? (
            <SourceHover label={label} excerpts={excerpts} />
          ) : (
            <span className="shrink-0 text-xs text-text-muted">Source not retained</span>
          ))}
      </div>
      {fact.uncertainty !== 'low' && (
        <p className="text-xs text-text-muted">
          <span aria-hidden="true">~ </span>
          {fact.uncertainty === 'high' ? 'Low confidence' : 'Unconfirmed'}
        </p>
      )}
      {/* The value, read calmly: not shouting (the label carries the emphasis). */}
      <p className="text-base font-normal text-text">{isUnknown ? 'Unknown' : fact.value}</p>
      {provenance && <p className="text-xs text-text-muted">{provenance}</p>}
      <WebEvidenceList evidence={webEvidence} />
    </div>
  );
}

/**
 * The source excerpt as a corner affordance: a small "View source" link that
 * reveals the backing transcript on hover or keyboard focus (role="tooltip"),
 * instead of an inline block that pushed every fact apart. The panel is a child
 * of the hover group, so moving the pointer into it to read/scroll keeps it
 * open; it is width- and height-bounded so a long excerpt scrolls rather than
 * sprawling across the map.
 */
function SourceHover({ label, excerpts }: { label: string; excerpts: readonly SourceExcerpt[] }): React.JSX.Element {
  const panelId = useId();
  return (
    <span className="group relative inline-block shrink-0">
      <button
        type="button"
        aria-describedby={panelId}
        className="text-xs text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        View source
      </button>
      <span
        id={panelId}
        role="tooltip"
        aria-label={`Source for ${label.toLowerCase()}`}
        className="absolute right-0 top-full z-20 mt-space-1 hidden max-h-64 w-80 max-w-[80vw] overflow-y-auto rounded-md border border-border bg-surface-raised p-space-3 text-left text-sm font-normal text-text shadow-md group-hover:block group-focus-within:block"
      >
        {excerpts.length > 0 ? (
          excerpts.map((e, i) => (
            <span key={i} className="block">
              <span className="text-text-muted">{e.speaker}: </span>
              {e.text}
            </span>
          ))
        ) : (
          <span className="text-text-muted">Source excerpt unavailable.</span>
        )}
      </span>
    </span>
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
