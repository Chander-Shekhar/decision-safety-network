import { ActionBar, Badge, Button, Card } from './ui';

/**
 * One rendered timeline row's display shape - a locally defined mirror, not
 * an import of apps/api's internal retention/evidence types (same
 * presentational-boundary convention as `VerifyPanel.tsx`'s
 * `VerifyPanelRegistry`/`VerifyPanelResult`). `kind` only affects which
 * optional fields a given entry is expected to carry; rendering itself does
 * not branch on it.
 */
export interface EvidenceTimelineEntry {
  kind: 'confirmed-fact' | 'selected-excerpt' | 'correction';
  label: string;
  value?: string;
  /** Set on a `correction` entry: the still-retained original text/value it superseded, shown alongside it rather than overwriting it. */
  correctedFrom?: string;
}

export type EvidenceRetentionMode = 'delete-on-close' | 'facts-24h' | 'selected-7d';

export interface EvidenceScreenProps {
  timeline: EvidenceTimelineEntry[];
  /** False whenever export consent is absent or has been revoked - see `apps/api/src/export.ts`'s own consent gate. */
  exportAllowed: boolean;
  retentionMode: EvidenceRetentionMode;
  onExport?: () => void;
}

const RETENTION_LABELS: Record<EvidenceRetentionMode, string> = {
  'delete-on-close': 'Delete on close',
  'facts-24h': 'Confirmed facts only (24 hours)',
  'selected-7d': 'Selected excerpts (7 days)',
};

/**
 * The evidence/export surface from plan Task 11. Purely presentational -
 * never talks to Firestore/the API/the model directly; export is a single
 * injected `onExport` callback, matching `VerifyPanel.tsx`/`PaymentPanel.tsx`'s
 * convention. Labels the surface **Simulated** persistently and the preview
 * itself as "not submitted or accepted" (PRD C11/C12) - never a scam-
 * probability or mental-state label.
 */
export function EvidenceScreen({ timeline, exportAllowed, retentionMode, onExport }: EvidenceScreenProps): React.JSX.Element {
  return (
    <section aria-label="Evidence and export">
      <Card
        title="Evidence"
        footer={
          <ActionBar>
            <Button onClick={() => onExport?.()} disabled={!exportAllowed}>
              Download evidence
            </Button>
          </ActionBar>
        }
      >
        <p>
          <Badge tone="simulated">SIMULATED</Badge>
        </p>
        <p>This is a reviewable preview &mdash; not submitted or accepted. No report has been filed on your behalf.</p>

        <p>Retention: {RETENTION_LABELS[retentionMode]}</p>
        {retentionMode === 'delete-on-close' && (
          <p role="alert" className="rounded-md border border-border bg-surface-sunken p-space-3">
            Once this case closes under delete-on-close, its content is gone for good &mdash; there is no re-entry recovery path back into this case afterward.
          </p>
        )}

        <ol className="list-decimal pl-space-4">
          {timeline.map((entry, index) => (
            <li key={index}>
              <span>{entry.label}</span>
              {entry.value && <span> &mdash; {entry.value}</span>}
              {entry.correctedFrom && <span> (corrected from: {entry.correctedFrom})</span>}
            </li>
          ))}
        </ol>

        {!exportAllowed && <p>Export is unavailable right now &mdash; export consent was either never given or has been revoked.</p>}
      </Card>
    </section>
  );
}
