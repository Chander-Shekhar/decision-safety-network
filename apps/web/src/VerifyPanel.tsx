import { ActionBar, Button, Card } from './ui';

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
  /**
   * When true, the "Verify with Demo Bank" affordance renders disabled. The owner
   * cannot start official verification until the case has left `Observe` (the state
   * machine has no `Observe → Verify` edge); the parent passes the phase gate here so
   * the blocked state reads as blocked rather than silently rejecting a click.
   */
  disabled?: boolean;
  onVerify?: () => void;
  onCancel?: () => void;
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
export function VerifyPanel({ registry, result, disabled, onVerify, onCancel }: VerifyPanelProps): React.JSX.Element {
  return (
    <section aria-label="Demo Bank verification">
      <Card title="Demo Bank verification">
        <dl className="grid grid-cols-[auto_1fr] gap-x-space-4 gap-y-space-1">
          <dt className="text-sm text-text-muted">Route</dt>
          <dd>{registry.routeLabel}</dd>
          <dt className="text-sm text-text-muted">Source</dt>
          <dd>{registry.source}</dd>
          <dt className="text-sm text-text-muted">Reviewed</dt>
          <dd>{registry.reviewedAt}</dd>
        </dl>
        <p className="text-sm text-text-muted">This route came from our registry, not from the caller.</p>

        {!result && (
          <ActionBar>
            <Button disabled={disabled} onClick={() => onVerify?.()}>
              Verify with Demo Bank
            </Button>
          </ActionBar>
        )}

        {result && (
          <div role="status" className="flex flex-col gap-space-3 rounded-md border border-border bg-surface-sunken p-space-4">
            <h3 className="text-base font-semibold">Claim not supported</h3>
            <p>
              Checked via {result.method}. No outbound fraud call or protected-account transfer request was recorded.
            </p>

            <ActionBar>
              <Button variant="cancel" onClick={() => onCancel?.()}>
                Cancel the transfer
              </Button>
            </ActionBar>
            {/* No Defer control here: there is no `deferred` PaymentState and no
                `defer` command in `act()` (both server-side, out of this
                component's scope) to back it, so a Defer button would be a
                no-op reaching the user. Re-add only alongside that backend, if
                the founder decides defer becomes a real action. */}
          </div>
        )}
      </Card>
    </section>
  );
}
