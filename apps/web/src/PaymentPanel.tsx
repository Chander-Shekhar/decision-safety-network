import { useEffect, useRef, useState } from 'react';
import type { PaymentState } from '../../../packages/contracts/src/payment';

/** A minimal, already-trusted view of the case's open draft, for display only. */
export interface PaymentPanelDraft {
  beneficiaryId: string;
  amountMinor: number;
  newPayee: boolean;
  /** The draft's own version counter - used only to detect "the draft changed" for the recheck trigger below, never displayed. */
  version: number;
}

/**
 * Live-recheck status, independent of `paymentState`. `rechecking` mirrors
 * wireframe frame 03's "RECHECKING" fallback; `degraded` mirrors its "AI
 * CHECK UNAVAILABLE" fallback. Neither ever implies a settled transfer or an
 * enhanced Pause finding - manual controls (submit/already-paid) stay
 * available either way (frame 03: "Failure remains actionable").
 */
type RecheckStatus = 'idle' | 'rechecking' | 'degraded';

export interface PaymentPanelProps {
  draft?: PaymentPanelDraft;
  paymentState: PaymentState;
  /** Segment ids known at render time; a grown set is one of this panel's three recheck triggers (a new decisive segment). */
  segmentIds?: string[];
  onSubmit?: () => void;
  /**
   * The authenticated recheck route (`POST .../payment/recheck`), injected
   * by the caller (real HTTP wiring is Task 12's `api-client.ts` - this
   * component never calls Firestore/Gemini/`fetch` directly). This panel
   * only decides *when* to call it: immediately once the payment is
   * pending, again whenever the pending draft changes, and again whenever a
   * new segment id appears while still pending.
   */
  onRecheck?: () => Promise<void>;
  onAlreadyPaid?: () => void;
}

const formatAmount = (amountMinor: number): string => (amountMinor / 100).toLocaleString('en-IN');

/**
 * The "Transfer draft" panel from wireframe frame 02, plus frame 03's two
 * non-fabricating recheck fallback states. Never controls transfer state
 * itself (DSN-009 owns pause/cancel/verify/continue); shows a persistent
 * **Simulated** label both before and after submit, and talks to the rest
 * of the app only through injected callbacks - never Firestore/Gemini
 * directly.
 */
export function PaymentPanel({ draft, paymentState, segmentIds = [], onSubmit, onRecheck, onAlreadyPaid }: PaymentPanelProps): React.JSX.Element {
  const [recheckStatus, setRecheckStatus] = useState<RecheckStatus>('idle');
  const lastTriggerKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (paymentState !== 'pending' || !onRecheck) {
      return;
    }
    const triggerKey = `${draft?.version ?? ''}:${segmentIds.length}`;
    if (lastTriggerKey.current === triggerKey) {
      return;
    }
    lastTriggerKey.current = triggerKey;

    let cancelled = false;
    setRecheckStatus('rechecking');
    onRecheck()
      .then(() => {
        if (!cancelled) {
          setRecheckStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecheckStatus('degraded');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentState, draft?.version, segmentIds.length, onRecheck]);

  const canSubmit = Boolean(draft) && paymentState === 'draft';

  return (
    <section aria-label="Transfer draft">
      <h2>Transfer draft</h2>
      <p>SIMULATED</p>
      <p>No money moves in this prototype.</p>

      {draft ? (
        <dl>
          <dt>Beneficiary</dt>
          <dd>
            {draft.beneficiaryId} &middot; {draft.newPayee ? 'new payee' : 'known payee'}
          </dd>
          <dt>Amount</dt>
          <dd>₹ {formatAmount(draft.amountMinor)}</dd>
        </dl>
      ) : (
        <p>No transfer drafted yet.</p>
      )}

      {paymentState === 'pending' && recheckStatus === 'rechecking' && (
        <div role="status">
          <h3>Rechecking your updated transfer</h3>
          <p>Your simulated transfer is still pending. We do not yet have a current, source-backed link to the caller&apos;s request.</p>
        </div>
      )}
      {paymentState === 'pending' && recheckStatus === 'degraded' && (
        <div role="status">
          <h3>We cannot complete the AI check now</h3>
          <p>We will not guess whether this transfer is safe. It remains pending until you choose an action.</p>
        </div>
      )}
      {paymentState !== 'pending' && (
        <div>
          <p>Still checking the connection</p>
          <p>No enhanced Pause from words alone.</p>
        </div>
      )}

      <button type="button" onClick={() => onSubmit?.()} disabled={!canSubmit}>
        Submit intent
      </button>
      <p>This begins a pending human decision, not an authorized payment or real hold.</p>

      <button type="button" onClick={() => onAlreadyPaid?.()}>
        I already paid &rarr; recovery in this case
      </button>
    </section>
  );
}
