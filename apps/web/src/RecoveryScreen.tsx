import { useState } from 'react';
import { ActionBar, Badge, Button, Card } from './ui';
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

const INPUT_CLASS =
  'rounded-md border border-border bg-surface-raised px-space-3 py-space-2 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

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
    <main aria-label="Recovery" className="mx-auto flex max-w-3xl flex-col gap-space-4 p-space-4 text-text">
      <h1 className="text-2xl font-semibold">You said you already paid</h1>
      <p>Many people are caught by convincing calls. We will reuse what you confirmed. Act quickly; you can fill gaps later.</p>

      <h2 className="text-xl font-semibold">First-hour options</h2>
      {/* Equal-weight routes: identical Card structure, same heading level (Card title = h2). */}
      <section aria-label="Contact Demo Bank support">
        <Card title="Contact Demo Bank support">
          <p>
            <Badge tone="simulated">SIMULATED BANK ROUTE &middot; DEMO BANK IS FICTIONAL</Badge>
          </p>
          <p>Independent registry route &middot; {state.bankAction.status}</p>
        </Card>
      </section>
      <section aria-label="Call 1930">
        <Card title="Call 1930">
          <p>
            <Badge tone="info">REAL PUBLIC ROUTE</Badge>
          </p>
          <p>Official route &middot; {helpline1930Action.status}</p>
          <p>
            Official source: <a href={helpline1930Action.sourceUrl} className="underline">cybercrime.gov.in</a>
          </p>
          <p>Source reviewed {helpline1930Action.reviewedAt}</p>
        </Card>
      </section>

      {knownEntries.length > 0 && (
        <section aria-label="What you already confirmed">
          <Card title="What you already confirmed">
            <dl className="flex flex-col gap-space-2">
              {knownEntries.map(([field, value]) => (
                <div key={field}>
                  <dt className="text-sm text-text-muted">{field}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      )}

      {paidPayment && (
        <section aria-label="Paid details">
          <Card title="Recorded as reported by you">
            <dl className="flex flex-col gap-space-1">
              <dt className="text-sm text-text-muted">Paid payee</dt>
              <dd>{paidPayment.paidPayee}</dd>
              <dt className="text-sm text-text-muted">Paid amount</dt>
              <dd>{formatRupees(paidPayment.paidAmountMinor)}</dd>
            </dl>
          </Card>
        </section>
      )}

      {!paidPayment && proposedPayment && (
        <section aria-label="Pre-filled from this case">
          <Card title="Pre-filled from this case">
            <p>{proposedPayment.sourceLabel}</p>
            <dl className="flex flex-col gap-space-1">
              <dt className="text-sm text-text-muted">Proposed payee</dt>
              <dd>{proposedPayment.payee}</dd>
              <dt className="text-sm text-text-muted">Proposed amount</dt>
              <dd>{formatRupees(proposedPayment.amountMinor)}</dd>
            </dl>
            <p>A cancelled proposal is not proof of the payment you made.</p>
            {!editing && (
              <>
                <p>Did you pay these same details?</p>
                <ActionBar>
                  <Button onClick={() => onMatch?.(proposedPayment.fingerprint)}>Yes, they match</Button>
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    No, edit paid details
                  </Button>
                </ActionBar>
                <p className="text-sm text-text-muted">Yes records paid details as user-reported, without retyping.</p>
              </>
            )}
          </Card>
        </section>
      )}

      {showForm && (
        <form aria-label="Paid details form" onSubmit={submit} className="flex flex-col gap-space-3 rounded-lg border border-border bg-surface-raised p-space-4">
          <label className="flex flex-col gap-space-1 text-sm font-medium">
            Who did you pay?
            <input className={INPUT_CLASS} value={payee} onChange={(e) => setPayee(e.target.value)} />
          </label>
          <label className="flex flex-col gap-space-1 text-sm font-medium">
            Amount you paid (&#8377;)
            <input className={INPUT_CLASS} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="flex flex-col gap-space-1 text-sm font-medium">
            Transaction time (optional)
            <input className={INPUT_CLASS} value={transactionTime} onChange={(e) => setTransactionTime(e.target.value)} />
          </label>
          <label className="flex flex-col gap-space-1 text-sm font-medium">
            Payment method (optional)
            <input className={INPUT_CLASS} value={paymentRail} onChange={(e) => setPaymentRail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-space-1 text-sm font-medium">
            Reference ID (optional)
            <input className={INPUT_CLASS} value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm font-medium">{error}</p>}
          <ActionBar>
            <Button type="submit">Save paid details</Button>
          </ActionBar>
        </form>
      )}

      <section aria-label="Still needed">
        <Card title="Still needed">
          {state.missing.length === 0 ? (
            <p>Nothing else is needed right now.</p>
          ) : (
            <ul className="list-disc pl-space-4">
              {state.missing.map((field) => (
                <li key={field}>{FIELD_LABELS[field]}: Unknown</li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section aria-label="Recovery scam warning">
        <Card title={<>Watch for follow-on &ldquo;recovery&rdquo; scams</>}>
          <p>Do not pay a stranger who promises to retrieve funds.</p>
        </Card>
      </section>

      <section aria-label="Local status only">
        <Card title={<>LOCAL STATUS ONLY &middot; SIMULATED ACKNOWLEDGEMENT</>}>
          <p>These notes stay in this app. They are not an official receipt and nothing is sent to anyone.</p>
          {acknowledgement && (
            <p role="status">
              Local note recorded for {acknowledgement.action === 'bank' ? 'Demo Bank' : '1930'} (simulated).
            </p>
          )}
          <ActionBar>
            <Button variant="secondary" onClick={() => onAcknowledge?.('bank')}>
              Note: I contacted Demo Bank
            </Button>
            <Button variant="secondary" onClick={() => onAcknowledge?.('helpline-1930')}>
              Note: I contacted 1930
            </Button>
          </ActionBar>
        </Card>
      </section>
    </main>
  );
}
