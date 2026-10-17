import { useState } from 'react';
import type { Phase } from '../../../packages/contracts/src/case';
import type { PaymentReason, PaymentState } from '../../../packages/contracts/src/payment';
import { ActionBar, Badge, Button } from './ui';

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
  /** Display name of the owner's Safety Ally, used in the "Ask … for help" path. Defaults to a generic label. */
  allyName?: string;
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

/** One of the two always-available help paths: a short title + reassurance + a single large action. */
function ActionPath({
  title,
  body,
  cta,
  variant,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  variant: 'primary' | 'secondary';
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-space-3 rounded-lg border border-border bg-surface-raised p-space-4 shadow-sm">
      <div className="flex flex-col gap-space-1">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-sm text-text-muted">{body}</p>
      </div>
      <Button variant={variant} size="lg" onClick={() => onClick?.()}>
        {cta}
      </Button>
    </div>
  );
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
  allyName = 'your Safety Ally',
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

  if (resolved) {
    return (
      <section aria-label="Action console">
        <div role="status" className="rounded-lg border border-border bg-surface-sunken p-space-4">
          {paymentState === 'cancelled' ? (
            <>
              <h3 className="font-semibold">
                Transfer cancelled <Badge tone="simulated">Simulated</Badge>
              </h3>
              <p>The transfer will not proceed.</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold">
                Transfer continued <Badge tone="simulated">Simulated</Badge>
              </h3>
              <p>You chose to continue after acknowledging the request remains unverified.</p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Action console" className="flex flex-col gap-space-4">
      {/* Only when a transfer is actually on the table (e.g. drafted on the Pay step and
          revisited here): the stop/continue controls, led by the reasons to slow down. */}
      {hasOpenPayment && (
        <div className="flex flex-col gap-space-3 rounded-lg border border-pause bg-surface-sunken p-space-4">
          <div className="flex flex-col gap-space-1">
            <h3 className="font-semibold text-text">There&apos;s a transfer waiting on your decision</h3>
            {reasons.length > 0 && (
              <ul className="list-disc pl-space-4 text-sm text-text-muted">
                {reasons.slice(0, MAX_VISIBLE_REASONS).map((reason) => (
                  <li key={reason.code}>{reason.text}</li>
                ))}
              </ul>
            )}
          </div>

          <ActionBar>
            <Button variant="pause" size="lg" onClick={() => onPause?.()}>
              Pause transfer
            </Button>
            <Button variant="secondary" onClick={() => onCancel?.()}>
              Cancel transfer
            </Button>
          </ActionBar>

          {ackGated ? (
            <div className="flex flex-col gap-space-2 rounded-md border border-border bg-surface-raised p-space-3">
              {aiCheckDegraded && (
                <p>Safety check unavailable &mdash; choose an action. Continuing still requires your acknowledgment.</p>
              )}
              <label className="flex items-start gap-space-2">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                I understand the caller&apos;s request remains unverified, and I choose to continue.
              </label>
              <ActionBar>
                <Button variant="ghost" disabled={!acknowledged} onClick={() => onContinue?.()}>
                  Confirm Continue
                </Button>
              </ActionBar>
            </div>
          ) : (
            <ActionBar>
              <Button variant="ghost" onClick={() => onContinue?.()}>
                Continue the transfer
              </Button>
            </ActionBar>
          )}
        </div>
      )}

      {/* The two ways to get help without deciding alone - always available. */}
      <ActionPath
        title={`Ask ${allyName} for help`}
        body="Share this call with your Safety Ally. They'll reach out so you don't have to handle it alone — take a breather."
        cta="Ask my ally"
        variant="primary"
        onClick={onAskAlly}
      />
      <ActionPath
        title="Verify officially"
        body="Reach the real organisation yourself, using a number you look up — never a number the caller gave you."
        cta="Verify officially"
        variant="secondary"
        onClick={onVerify}
      />
    </section>
  );
}
