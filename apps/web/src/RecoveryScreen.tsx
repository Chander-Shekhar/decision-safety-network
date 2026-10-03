import { useState } from 'react';
import type { PaidField, RecoveryState } from '../../../packages/contracts/src/recovery';

/** Details the owner typed. Blank optional fields are omitted, never sent as empty strings. */
export interface EditedPaidDetails {
  paidPayee: string;
  paidAmountMinor: number;
  transactionTime?: string;
  paymentRail?: string;
  referenceId?: string;
}

export interface RecoveryScreenProps {
  state: RecoveryState;
  /** Owner tapped "Yes, they match"; receives the exact fingerprint of the prefill shown. */
  onMatch?: (fingerprint: string) => void;
  onEdit?: (details: EditedPaidDetails) => void;
  onAcknowledge?: (action: 'bank' | 'helpline-1930') => void;
}

const FIELD_LABELS: Record<PaidField, string> = {
  paidPayee: 'Paid payee',
  paidAmountMinor: 'Paid amount',
  transactionTime: 'Transaction time',
  paymentRail: 'Payment method',
  referenceId: 'Reference ID',
};

function formatRupees(amountMinor: number): string {
  return `₹${(amountMinor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Whole rupees with up to two decimals -> minor units; null if the text is not a positive amount. */
function parseRupeesToMinor(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/**
 * Same-case "I already paid" recovery screen (wireframe frame 06). Purely
 * presentational: the authenticated API owns all data, and this component
 * never talks to Firestore or the model. The Demo Bank route and the real
 * 1930 route render as equal-priority siblings BEFORE the paid-detail
 * question. Only the Demo Bank route and local acknowledgements are labeled
 * Simulated; the real 1930 route is never badged fictional, and nothing here
 * claims a real call, filing, or report happened.
 */
export function RecoveryScreen({ state, onMatch, onEdit, onAcknowledge }: RecoveryScreenProps): React.JSX.Element {
  const { proposedPayment, paidPayment, helpline1930Action, acknowledgement } = state;
  const [editing, setEditing] = useState(false);
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionTime, setTransactionTime] = useState('');
  const [paymentRail, setPaymentRail] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showForm = !paidPayment && (editing || proposedPayment === null);
  const knownEntries = Object.entries(state.known.facts);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const minor = parseRupeesToMinor(amount);
    if (payee.trim() === '' || minor === null) {
      setError('Enter who you paid and a positive amount, for example 12345.50.');
      return;
    }
    setError(null);
    const details: EditedPaidDetails = { paidPayee: payee.trim(), paidAmountMinor: minor };
    if (transactionTime.trim() !== '') details.transactionTime = transactionTime.trim();
    if (paymentRail.trim() !== '') details.paymentRail = paymentRail.trim();
    if (referenceId.trim() !== '') details.referenceId = referenceId.trim();
    onEdit?.(details);
  }

  return (
    <main aria-label="Recovery">
      <h1>You said you already paid</h1>
      <p>Many people are caught by convincing calls. We will reuse what you confirmed. Act quickly; you can fill gaps later.</p>

      <h2>First-hour options</h2>
      <section aria-label="Contact Demo Bank support">
        <p>SIMULATED BANK ROUTE &middot; DEMO BANK IS FICTIONAL</p>
        <h3>Contact Demo Bank support</h3>
        <p>Independent registry route &middot; {state.bankAction.status}</p>
      </section>
      <section aria-label="Call 1930">
        <p>REAL PUBLIC ROUTE</p>
        <h3>Call 1930</h3>
        <p>Official route &middot; {helpline1930Action.status}</p>
        <p>
          Official source: <a href={helpline1930Action.sourceUrl}>cybercrime.gov.in</a>
        </p>
        <p>Source reviewed {helpline1930Action.reviewedAt}</p>
      </section>

      {knownEntries.length > 0 && (
        <section aria-label="What you already confirmed">
          <h2>What you already confirmed</h2>
          <dl>
            {knownEntries.map(([field, value]) => (
              <div key={field}>
                <dt>{field}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {paidPayment && (
        <section aria-label="Paid details">
          <h2>Recorded as reported by you</h2>
          <dl>
            <dt>Paid payee</dt>
            <dd>{paidPayment.paidPayee}</dd>
            <dt>Paid amount</dt>
            <dd>{formatRupees(paidPayment.paidAmountMinor)}</dd>
          </dl>
        </section>
      )}

      {!paidPayment && proposedPayment && (
        <section aria-label="Pre-filled from this case">
          <h2>Pre-filled from this case</h2>
          <p>{proposedPayment.sourceLabel}</p>
          <dl>
            <dt>Proposed payee</dt>
            <dd>{proposedPayment.payee}</dd>
            <dt>Proposed amount</dt>
            <dd>{formatRupees(proposedPayment.amountMinor)}</dd>
          </dl>
          <p>A cancelled proposal is not proof of the payment you made.</p>
          {!editing && (
            <>
              <p>Did you pay these same details?</p>
              <button type="button" onClick={() => onMatch?.(proposedPayment.fingerprint)}>
                Yes, they match
              </button>
              <button type="button" onClick={() => setEditing(true)}>
                No, edit paid details
              </button>
              <p>Yes records paid details as user-reported, without retyping.</p>
            </>
          )}
        </section>
      )}

      {showForm && (
        <form aria-label="Paid details form" onSubmit={submit}>
          <label>
            Who did you pay?
            <input value={payee} onChange={(e) => setPayee(e.target.value)} />
          </label>
          <label>
            Amount you paid (&#8377;)
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            Transaction time (optional)
            <input value={transactionTime} onChange={(e) => setTransactionTime(e.target.value)} />
          </label>
          <label>
            Payment method (optional)
            <input value={paymentRail} onChange={(e) => setPaymentRail(e.target.value)} />
          </label>
          <label>
            Reference ID (optional)
            <input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit">Save paid details</button>
        </form>
      )}

      <section aria-label="Still needed">
        <h2>Still needed</h2>
        {state.missing.length === 0 ? (
          <p>Nothing else is needed right now.</p>
        ) : (
          <ul>
            {state.missing.map((field) => (
              <li key={field}>{FIELD_LABELS[field]}: Unknown</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recovery scam warning">
        <h2>Watch for follow-on &ldquo;recovery&rdquo; scams</h2>
        <p>Do not pay a stranger who promises to retrieve funds.</p>
      </section>

      <section aria-label="Local status only">
        <h2>LOCAL STATUS ONLY &middot; SIMULATED ACKNOWLEDGEMENT</h2>
        <p>These notes stay in this app. They are not an official receipt and nothing is sent to anyone.</p>
        {acknowledgement && (
          <p role="status">
            Local note recorded for {acknowledgement.action === 'bank' ? 'Demo Bank' : '1930'} (simulated).
          </p>
        )}
        <button type="button" onClick={() => onAcknowledge?.('bank')}>
          Note: I contacted Demo Bank
        </button>
        <button type="button" onClick={() => onAcknowledge?.('helpline-1930')}>
          Note: I contacted 1930
        </button>
      </section>
    </main>
  );
}
