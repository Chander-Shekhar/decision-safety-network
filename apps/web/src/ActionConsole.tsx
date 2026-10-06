import { useState } from 'react';
import type { Phase } from '../../../packages/contracts/src/case';
import type { PaymentReason, PaymentState } from '../../../packages/contracts/src/payment';
import { ActionBar, Badge, Button, Card } from './ui';

/** ≤3 reasons shown (PRD C6) - never a 4th, even if the projection carries more. */
const MAX_VISIBLE_REASONS = 3;

/**
 * The slice of `PaymentProjection` this console reads. `reasons` is read
 * as-is from the persisted projection - this component never recomputes
 * policy client-side (that is `apps/api/src/policy.ts`'s `assessCase`, which
 * `act()` itself never calls either).
 */
export interface ActionConsoleCaseState {
  phase: Phase;
  /** Absent for a case with no payment draft yet (quiet Observe/Check case). */
  paymentState?: PaymentState;
  /** Absent for a quiet case `createCase` just made (its `CaseEnvelope` carries no `reasons` field at all) - defaulted to `[]` below, never read unguarded. */
  reasons?: PaymentReason[];
}

export interface ActionConsoleProps {
  caseState: ActionConsoleCaseState;
  /**
   * True while the model-backed safety recheck has failed or timed out
   * (mirrors `PaymentPanel`'s degraded recheck status). Every control here is
   * an explicit human decision routed through DSN-009's `act()`, which never
   * calls the model - so nothing below is ever disabled by this flag. It
   * only changes the Continue copy and keeps requiring acknowledgment.
   */
  aiCheckDegraded?: boolean;
  onPause?: () => void;
  onCancel?: () => void;
  onVerify?: () => void;
  onContinue?: () => void;
  /** Opens the DSN-011 ally-sharing preview only - no grant side effect here, and DSN-011 does not exist yet, so this is never shown as completed or dropped. */
  onAskAlly?: () => void;
}

/**
 * The explainable human action console (PRD C6/C9; wireframes 03/03b/05).
 * Every control is a plain callback into the authenticated action routes
 * (DSN-009's `act()`); this component never talks to Firestore or the model
 * directly. Controls are native `<button>`/`<input type="checkbox">`
 * elements, which are keyboard-operable (Enter/Space) by construction; sizing
 * for "large" touch targets is a visual/CSS concern left to a later styling
 * pass, matching `PaymentPanel.tsx`'s own unstyled precedent.
 */
export function ActionConsole({
  caseState,
  aiCheckDegraded = false,
  onPause,
  onCancel,
  onVerify,
  onContinue,
  onAskAlly,
}: ActionConsoleProps): React.JSX.Element {
  const [acknowledged, setAcknowledged] = useState(false);
  const { phase, paymentState, reasons = [] } = caseState;

  const resolved = paymentState === 'cancelled' || paymentState === 'continued';
  const hasOpenPayment = paymentState === 'pending' || paymentState === 'paused';
  // Only a joined, elevated case (phase Pause) or a degraded safety check
  // gates Continue behind an explicit acknowledgment (plan Task 7); an
  // ordinary Check-phase case uses a plain confirmation instead.
  const ackGated = phase === 'Pause' || aiCheckDegraded;

  return (
    <section aria-label="Action console">
      <Card title="Before you enter an OTP">
        <p>
          <Badge tone="simulated">SIMULATED PAYMENT</Badge>
        </p>
        <p className="text-sm text-text-muted">Nothing here moves real money. Every action below changes only this simulated case.</p>

        {resolved ? (
          <div role="status" className="rounded-md border border-border bg-surface-sunken p-space-3">
            {paymentState === 'cancelled' ? (
              <>
                <h3 className="font-semibold">Simulated transfer cancelled</h3>
                <p>Cancelled, not just hidden. The simulated transfer will not proceed.</p>
              </>
            ) : (
              <>
                <h3 className="font-semibold">Simulated transfer continued</h3>
                <p>You chose to continue the simulated transfer after acknowledging the request remains unverified.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <section aria-label="Why slow down">
              <h3 className="font-semibold">Why slow down?</h3>
              <ul className="list-disc pl-space-4">
                {reasons.slice(0, MAX_VISIBLE_REASONS).map((reason) => (
                  <li key={reason.code}>{reason.text}</li>
                ))}
              </ul>
            </section>

            <ActionBar>
              {hasOpenPayment && (
                <Button variant="pause" onClick={() => onPause?.()}>
                  Pause simulated transfer
                </Button>
              )}
              {hasOpenPayment && (
                <Button variant="cancel" onClick={() => onCancel?.()}>
                  Cancel simulated transfer
                </Button>
              )}
              <Button variant="secondary" onClick={() => onVerify?.()}>
                Verify officially
              </Button>
            </ActionBar>

            <ActionBar>
              <Button variant="secondary" onClick={() => onAskAlly?.()}>
                Ask my ally
              </Button>
            </ActionBar>
            <p className="text-sm text-text-muted">Opens a preview to share this case - nothing is sent yet.</p>

            {hasOpenPayment &&
              (ackGated ? (
                <div className="flex flex-col gap-space-2 rounded-md border border-border bg-surface-sunken p-space-3">
                  {aiCheckDegraded && (
                    <p>
                      The safety check could not be completed right now. The simulated transfer stays as it is until you choose an
                      action, and continuing still requires your acknowledgment.
                    </p>
                  )}
                  <label className="flex items-start gap-space-2">
                    <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                    I understand the caller&apos;s request remains unverified, and I choose to continue the simulated transfer.
                  </label>
                  <ActionBar>
                    <Button variant="secondary" disabled={!acknowledged} onClick={() => onContinue?.()}>
                      Confirm Continue
                    </Button>
                  </ActionBar>
                </div>
              ) : (
                <ActionBar>
                  <Button variant="secondary" onClick={() => onContinue?.()}>
                    Continue the simulated transfer
                  </Button>
                </ActionBar>
              ))}
          </>
        )}
      </Card>
    </section>
  );
}
