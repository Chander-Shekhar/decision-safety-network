// User-submitted, pre-filled 1930/NCRP report contract (DSN-028). Additive.
// Trust rules: the product never submits, files, or confirms receipt of a
// report. This is a draft the user reviews and hands off themselves; it is
// populated only from owner-confirmed facts and unknown fields stay blank.

export const REPORT_DRAFT_LABEL = 'Draft for your review — not submitted';

export interface ReportFieldProvenance {
  origin: string;
  provenanceLabel: string;
  correctedAt: string | null;
}

export interface ReportField {
  ncrpField: string;
  /** The case field it maps to, or null when no supported case field exists (always blank). */
  caseField: string | null;
  /** Empty string when blank - never guessed. */
  value: string;
  blank: boolean;
  provenance: ReportFieldProvenance | null;
}

export interface ReportHandoff {
  mechanism: 'user-opens-official-channel';
  channelLabel: string;
  /** Fictional, non-resolving endpoint - the authority side is simulated. */
  channelUrl: string;
  simulated: true;
  /** A human must open the channel and submit; the server never does. */
  requiresUserAction: true;
}

export interface ReportDraft {
  caseId: string;
  label: typeof REPORT_DRAFT_LABEL;
  submitted: false;
  simulated: true;
  generatedAt: string;
  /** Date the NCRP-style field reference was last reviewed. */
  sourceDate: string;
  fieldMapVersion: string;
  fieldMapSource: string;
  fields: ReportField[];
  recoveryScamWarning: string;
  handoff: ReportHandoff;
}

/** Result of the user's explicit handoff action. Never states the report was filed or accepted. */
export interface ReportHandoffResult {
  handedOff: true;
  filed: false;
  statement: string;
  fraudList: { maskedNumber: string; basis: 'authority-report' } | null;
}
