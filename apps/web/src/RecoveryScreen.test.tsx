import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryScreen } from './RecoveryScreen';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';

const baseState: RecoveryState = {
  caseId: 'case-1',
  known: { facts: { centralClaim: 'Account compromised' }, evidenceIds: [] },
  proposedPayment: {
    source: 'simulated-draft',
    sourceLabel: 'Simulated draft',
    sourceRetained: true,
    payee: 'safe-new',
    amountMinor: 5_000_000,
    fingerprint: 'fp-1',
  },
  paidPayment: null,
  missing: ['paidPayee', 'paidAmountMinor', 'transactionTime', 'paymentRail', 'referenceId'],
  bankAction: { status: 'ready', route: 'Demo Bank', simulated: true },
  helpline1930Action: { status: 'ready', route: '1930', sourceUrl: 'https://cybercrime.gov.in/', reviewedAt: '2026-10-02' },
  acknowledgement: null,
};

describe('RecoveryScreen', () => {
  it('shows Demo Bank and 1930 with equal priority BEFORE the paid-detail question', () => {
    render(<RecoveryScreen state={baseState} />);
    const bank = screen.getByRole('region', { name: /demo bank support/i });
    const helpline = screen.getByRole('region', { name: /call 1930/i });
    const question = screen.getByText(/did you pay these same details/i);
    expect(bank.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(helpline.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // same heading level, both ready
    expect(within(bank).getByRole('heading').tagName).toBe(within(helpline).getByRole('heading').tagName);
    expect(within(bank).getByText(/ready/i)).toBeVisible();
    expect(within(helpline).getByText(/ready/i)).toBeVisible();
  });

  it('labels the bank route Simulated/fictional but never badges the real 1930 route as fictional or simulated', () => {
    render(<RecoveryScreen state={baseState} />);
    const bank = screen.getByRole('region', { name: /demo bank support/i });
    const helpline = screen.getByRole('region', { name: /call 1930/i });
    expect(within(bank).getByText(/simulated/i)).toBeVisible();
    expect(within(bank).getByText(/fictional/i)).toBeVisible();
    expect(helpline.textContent).not.toMatch(/simulated|fictional|fake|demo/i);
  });

  it('shows the 1930 official source and review date', () => {
    render(<RecoveryScreen state={baseState} />);
    const helpline = screen.getByRole('region', { name: /call 1930/i });
    expect(within(helpline).getByText(/2026-10-02/)).toBeVisible();
    const link = within(helpline).getByRole('link', { name: /cybercrime\.gov\.in/i });
    expect(link).toHaveAttribute('href', 'https://cybercrime.gov.in/');
  });

  it('shows the labeled prefill and offers both match and edit, stating a cancelled proposal is not proof', () => {
    render(<RecoveryScreen state={baseState} />);
    expect(screen.getByText(/pre-filled from this case/i)).toBeVisible();
    expect(screen.getByText(/simulated draft/i)).toBeVisible();
    expect(screen.getByText(/safe-new/)).toBeVisible();
    expect(screen.getByText(/50,000/)).toBeVisible();
    expect(screen.getByText(/cancelled proposal is not proof/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /yes, they match/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /no, edit paid details/i })).toBeVisible();
  });

  it('match sends the exact fingerprint shown', async () => {
    const onMatch = vi.fn();
    const user = userEvent.setup();
    render(<RecoveryScreen state={baseState} onMatch={onMatch} />);
    await user.click(screen.getByRole('button', { name: /yes, they match/i }));
    expect(onMatch).toHaveBeenCalledWith('fp-1');
  });

  it('edit collects paid details, converts rupees to minor units, and omits blank optional fields', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<RecoveryScreen state={baseState} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /no, edit paid details/i }));
    await user.type(screen.getByLabelText(/who did you pay/i), 'other-payee');
    await user.type(screen.getByLabelText(/amount you paid/i), '12345.50');
    await user.click(screen.getByRole('button', { name: /save paid details/i }));
    expect(onEdit).toHaveBeenCalledWith({ paidPayee: 'other-payee', paidAmountMinor: 1_234_550 });
  });

  it('offers no one-tap match without a complete prefill and goes straight to the paid-details form', () => {
    render(<RecoveryScreen state={{ ...baseState, proposedPayment: null }} />);
    expect(screen.queryByRole('button', { name: /yes, they match/i })).toBeNull();
    expect(screen.getByLabelText(/who did you pay/i)).toBeVisible();
  });

  it('labels a caller-request prefill honestly with source not retained, never as a simulated draft', () => {
    const state: RecoveryState = {
      ...baseState,
      proposedPayment: {
        source: 'caller-request',
        sourceLabel: 'Caller request (confirmed by you) · source not retained',
        sourceRetained: false,
        payee: 'safe-new',
        amountMinor: 5_000_000,
        fingerprint: 'fp-2',
      },
    };
    render(<RecoveryScreen state={state} />);
    expect(screen.getByText(/source not retained/i)).toBeVisible();
    expect(screen.queryByText(/simulated draft/i)).toBeNull();
  });

  it('lists unknown fields as Unknown and prompts for them', () => {
    render(<RecoveryScreen state={baseState} />);
    const needed = screen.getByRole('region', { name: /still needed/i });
    expect(within(needed).getByText(/transaction time/i)).toBeVisible();
    expect(within(needed).getByText(/reference id/i)).toBeVisible();
    expect(within(needed).getAllByText(/unknown/i).length).toBeGreaterThanOrEqual(2);
  });

  it('after the owner reports paid details, shows them as user-reported and hides the match question', () => {
    const state: RecoveryState = {
      ...baseState,
      paidPayment: { paidPayee: 'safe-new', paidAmountMinor: 5_000_000, origin: 'user-reported' },
      missing: ['transactionTime', 'paymentRail', 'referenceId'],
    };
    render(<RecoveryScreen state={state} />);
    expect(screen.getByText(/reported by you/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /yes, they match/i })).toBeNull();
    expect(screen.queryByText(/did you pay these same details/i)).toBeNull();
  });

  it('warns about follow-on recovery scams in blame-free language', () => {
    render(<RecoveryScreen state={baseState} />);
    expect(screen.getByText(/follow-on .*recovery.* scams/i)).toBeVisible();
    expect(screen.getByText(/do not pay a stranger who promises to retrieve funds/i)).toBeVisible();
    expect(screen.queryByText(/your fault|you should have|careless/i)).toBeNull();
  });

  it('labels the local acknowledgement Simulated without implying a real filing or call', async () => {
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(<RecoveryScreen state={baseState} onAcknowledge={onAcknowledge} />);
    const ack = screen.getByRole('region', { name: /local status/i });
    expect(within(ack).getByText(/simulated acknowledgement/i)).toBeVisible();
    expect(within(ack).getByText(/not an official receipt/i)).toBeVisible();
    await user.click(within(ack).getByRole('button', { name: /demo bank/i }));
    expect(onAcknowledge).toHaveBeenCalledWith('bank');
    expect(screen.queryByText(/we (filed|reported|called)|report (was )?(filed|submitted)|complaint registered/i)).toBeNull();
  });

  it('shows a recorded acknowledgement as a simulated local note', () => {
    const state: RecoveryState = {
      ...baseState,
      acknowledgement: { action: 'bank', status: 'local-note-recorded', simulated: true, at: '2026-10-04T10:00:00.000Z' },
    };
    render(<RecoveryScreen state={state} />);
    const ack = screen.getByRole('region', { name: /local status/i });
    expect(within(ack).getByText(/local note recorded/i)).toBeVisible();
    expect(within(ack).getAllByText(/simulated/i).length).toBeGreaterThan(0);
  });

  it('never shows a scam probability, risk score, or mental-state label', () => {
    render(<RecoveryScreen state={baseState} />);
    expect(screen.queryByText(/scam probability|risk score|likely (a )?scam|mental state/i)).toBeNull();
  });
});
