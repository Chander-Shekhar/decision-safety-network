/**
 * The display shape this panel reads from the versioned registry record
 * (`apps/api/src/demo-bank-registry.ts`'s `DEMO_BANK_REGISTRY`). A locally
 * defined, minimal interface rather than an import of that server module -
 * mirrors `PaymentPanel.tsx`'s own `PaymentPanelDraft`/`ActionConsole.tsx`'s
 * `ActionConsoleCaseState` precedent: a presentational component never
 * imports a server-side feature module's internal types across the
 * apps/api | apps/web boundary.
 */
export interface VerifyPanelRegistry {
  id: string;
  version: string;
  fictional: true;
  routeLabel: string;
  source: string;
  reviewedAt: string;
}

/** The display shape this panel reads from a completed `VerificationResult` (same locally-defined-mirror convention as `VerifyPanelRegistry` above). */
export interface VerifyPanelResult {
  bankId: string;
  registryVersion: string;
  method: string;
  checkedAt: string;
  outboundFraudCall: boolean;
  protectedTransferRequested: boolean;
  simulated: true;
}

export interface VerifyPanelProps {
  registry: VerifyPanelRegistry;
  /** Absent until the one-shot `verifyWithDemoBank` workflow (DSN-010) has completed for this case. */
  result?: VerifyPanelResult;
  onVerify?: () => void;
  onCancel?: () => void;
  onDefer?: () => void;
}

/**
 * The "Verify with Demo Bank" surface from wireframe frames 04/05. This
 * panel never collects a caller-supplied phone number, callback, URL, or
 * route - there is no such prop, and no free-text contact field is ever
 * rendered - the only route it can ever present is the versioned fictional
 * registry passed in via `registry` (PRD C7: "the workflow launches from the
 * versioned Demo Bank registry, never caller-supplied data"). It never calls
 * Firestore/the API/the model directly; every action is an injected
 * callback, matching `PaymentPanel.tsx`/`ActionConsole.tsx`'s convention.
 * Labels the surface **Simulated** persistently, both before and after a
 * result is recorded.
 */
export function VerifyPanel({ registry, result, onVerify, onCancel, onDefer }: VerifyPanelProps): React.JSX.Element {
  return (
    <section aria-label="Demo Bank verification">
      <h2>Demo Bank verification</h2>
      <p>SIMULATED</p>
      <p>FICTIONAL DEMO BANK &middot; REGISTRY v{registry.version}</p>
      <dl>
        <dt>Route</dt>
        <dd>{registry.routeLabel}</dd>
        <dt>Source</dt>
        <dd>{registry.source}</dd>
        <dt>Reviewed</dt>
        <dd>{registry.reviewedAt}</dd>
      </dl>
      <p>This route came from our registry, not from the caller. Caller-provided phone numbers are never used.</p>

      {!result && (
        <button type="button" onClick={() => onVerify?.()}>
          Verify with Demo Bank
        </button>
      )}

      {result && (
        <div role="status">
          <h3>Claim not supported</h3>
          <p>SIMULATED</p>
          <dl>
            <dt>Method</dt>
            <dd>{result.method}</dd>
            <dt>Registry version</dt>
            <dd>{result.registryVersion}</dd>
            <dt>Checked at</dt>
            <dd>{result.checkedAt}</dd>
          </dl>
          <p>No outbound fraud call was recorded in this simulation.</p>
          <p>No protected-account transfer was requested in this simulation.</p>

          <button type="button" onClick={() => onCancel?.()}>
            Cancel the simulated transfer
          </button>
          <button type="button" onClick={() => onDefer?.()}>
            Defer the decision
          </button>
          <p>Choosing Cancel ends this case&apos;s simulated transfer &mdash; cancelled, not just hidden.</p>
        </div>
      )}
    </section>
  );
}
