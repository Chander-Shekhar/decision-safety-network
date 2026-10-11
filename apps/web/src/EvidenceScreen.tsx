import { useState } from 'react';
import { ActionBar, Button, Callout, Card, Field } from './ui';

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

/** Locally mirrored display shape of the API's `ReportDraft` (DSN-028); the screen never imports apps/api types. */
export interface ReportDraftFieldView {
  ncrpField: string;
  value: string;
  blank: boolean;
  provenanceLabel: string;
}

export interface ReportDraftView {
  label: string;
  sourceDate: string;
  fields: ReportDraftFieldView[];
  recoveryScamWarning: string;
  channelLabel: string;
}

export interface EvidenceScreenProps {
  timeline: EvidenceTimelineEntry[];
  /** False whenever export consent is absent or has been revoked - see `apps/api/src/export.ts`'s own consent gate. */
  exportAllowed: boolean;
  retentionMode: EvidenceRetentionMode;
  onExport?: () => void;
  /** Pre-filled, user-reviewable 1930/NCRP draft built from confirmed facts only. */
  reportDraft?: ReportDraftView;
  /** False when the case cannot record a 1930 handoff (the server requires the Recover phase). Defaults to true. */
  handoffAllowed?: boolean;
  /** True only after the user clicked "Open official channel" and the handoff was recorded. Never means filed/accepted. */
  handedOff?: boolean;
  /** Explicit user action only: record the handoff (optional caller number goes on the private list), then open the official channel. */
  onOpenOfficialChannel?: (callerNumber?: string) => void;
  /** Explicit user action only: download the pre-filled form to review and enter in the official channel yourself. */
  onDownloadReportDraft?: () => void;
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
export function EvidenceScreen({
  timeline,
  exportAllowed,
  retentionMode,
  onExport,
  reportDraft,
  handoffAllowed = true,
  handedOff = false,
  onOpenOfficialChannel,
  onDownloadReportDraft,
}: EvidenceScreenProps): React.JSX.Element {
  const [callerNumber, setCallerNumber] = useState('');
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
        {handedOff ? (
          <p className="font-medium">
            You opened the official channel. This app has not filed a report and cannot confirm that one was received or accepted &mdash; finish and submit it there yourself.
          </p>
        ) : (
          <p className="font-medium">Draft for your review &mdash; not submitted.</p>
        )}

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

        {reportDraft && (
          <section aria-label="Pre-filled 1930/NCRP report" className="flex flex-col gap-space-2">
            <h4 className="text-sm font-semibold">Pre-filled 1930/NCRP report (Simulated)</h4>
            <div role="alert" aria-label="Recovery scam warning">
              <Callout kind="caution">{reportDraft.recoveryScamWarning}</Callout>
            </div>
            <p className="text-sm text-text-muted">
              Filled only from facts you confirmed, source date {reportDraft.sourceDate}. Fields we could not confirm are left blank, not guessed. You review it and submit it yourself; nothing is sent for you.
            </p>
            <dl className="flex flex-col gap-space-1 text-sm">
              {reportDraft.fields.map((field) => (
                <div key={field.ncrpField}>
                  <dt className="font-medium">{field.ncrpField}</dt>
                  <dd>
                    {field.blank ? <span className="text-text-muted">(left blank)</span> : field.value}
                    {!field.blank && field.provenanceLabel && <span className="text-text-muted"> &mdash; {field.provenanceLabel}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <Field label="Caller's number (optional)" htmlFor="report-caller-number" hint="If you add it, it goes only on your own private list after you open the official channel.">
              <input
                id="report-caller-number"
                type="text"
                value={callerNumber}
                maxLength={40}
                onChange={(event) => setCallerNumber(event.target.value)}
                className="rounded-md border border-border bg-surface-raised px-space-3 py-space-2 text-text"
              />
            </Field>
            <ActionBar>
              <Button variant="secondary" onClick={() => onDownloadReportDraft?.()}>
                Download pre-filled form
              </Button>
              <Button onClick={() => onOpenOfficialChannel?.(callerNumber.trim() === '' ? undefined : callerNumber.trim())} disabled={!handoffAllowed}>
                Open official channel ({reportDraft.channelLabel})
              </Button>
            </ActionBar>
            {!handoffAllowed && <p className="text-sm text-text-muted">The official-channel handoff is available once you are in the recovery step.</p>}
          </section>
        )}

        <p className="text-xs text-text-muted">Retention: {RETENTION_LABELS[retentionMode]}</p>
        {!exportAllowed && <p>Export is unavailable right now &mdash; export consent was either never given or has been revoked.</p>}
      </Card>
    </section>
  );
}
