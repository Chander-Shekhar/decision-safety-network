import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryScreen } from './RecoveryScreen';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';

const baseState: RecoveryState = {
  caseId: 'case-1',
  known: { facts: { centralClaim: 'Account compromised', claimedIdentity: 'Demo Bank fraud team' }, evidenceIds: [] },
  proposedPayment: {
    source: 'caller-request',
    sourceLabel: 'Caller request (confirmed by you)',
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
  guidedFreeze: {
    guided: true,
    realFreeze: false,
    scope: 'affected-account-only',
    helpline: { institution: 'Demo Bank', number: '1800 000 0000', source: 'demo-bank-registry', registryVersion: 'cup-1', simulated: true },
    script: 'I paid Rs 50,000 to safe-new.\nPlease put a hold on this one account.',
  },
};

const contact = { organisation: 'Demo Bank', phoneNumber: '+911800123123', source: 'demo-registry' as const };

describe('RecoveryScreen', () => {
  it('seeds the Decide-step number as a direct call link and shows the script', () => {
    render(<RecoveryScreen state={baseState} officialContact={contact} />);
    const bank = screen.getByRole('region', { name: /call your bank/i });
    expect(within(bank).getByRole('link', { name: /call demo bank/i })).toHaveAttribute('href', 'tel:+911800123123');
    expect(within(bank).getByText(/I paid Rs 50,000 to safe-new/)).toBeVisible();
    expect(screen.queryByText('1800 000 0000')).toBeNull();
  });

  it('without a found number, points to the number on the card instead of a fake one', () => {
    render(<RecoveryScreen state={baseState} officialContact={null} />);
    const bank = screen.getByRole('region', { name: /call your bank/i });
    expect(within(bank).queryByRole('link')).toBeNull();
    expect(within(bank).getByText(/back of your card/i)).toBeVisible();
  });

  it('offers 1930 with the official source', () => {
    render(<RecoveryScreen state={baseState} />);
    const r = screen.getByRole('region', { name: /report to 1930/i });
    expect(within(r).getByRole('link', { name: '1930' })).toHaveAttribute('href', 'tel:1930');
    expect(within(r).getByRole('link', { name: /cybercrime\.gov\.in/i })).toHaveAttribute('href', 'https://cybercrime.gov.in/');
  });

  it('labels what the caller said in plain words, never raw field names', () => {
    render(<RecoveryScreen state={baseState} />);
    const heard = screen.getByRole('region', { name: /what the caller said/i });
    expect(within(heard).getByText('Who they said they were')).toBeVisible();
    expect(within(heard).getByText('What they told you')).toBeVisible();
    expect(heard.textContent).not.toMatch(/claimedIdentity|centralClaim/);
  });

  it('shows the prefill and match sends the exact fingerprint', async () => {
    const onMatch = vi.fn();
    render(<RecoveryScreen state={baseState} onMatch={onMatch} />);
    expect(screen.getByText(/safe-new/, { selector: 'dd' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /yes, that's right/i }));
    expect(onMatch).toHaveBeenCalledWith('fp-1');
  });

  it('edit converts rupees to minor units and omits blank optional fields', async () => {
    const onEdit = vi.fn();
    render(<RecoveryScreen state={baseState} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: /no, let me fix it/i }));
    await userEvent.type(screen.getByLabelText(/who did you pay/i), 'other-payee');
    await userEvent.type(screen.getByLabelText(/amount you paid/i), '12345.50');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onEdit).toHaveBeenCalledWith({ paidPayee: 'other-payee', paidAmountMinor: 1_234_550 });
  });

  it('goes straight to the form without a prefill', () => {
    render(<RecoveryScreen state={{ ...baseState, proposedPayment: null }} />);
    expect(screen.queryByRole('button', { name: /yes, that's right/i })).toBeNull();
    expect(screen.getByLabelText(/who did you pay/i)).toBeVisible();
  });

  it('after paid details are saved, shows them and hides the question', () => {
    const state: RecoveryState = { ...baseState, paidPayment: { paidPayee: 'safe-new', paidAmountMinor: 5_000_000, origin: 'user-reported' } };
    render(<RecoveryScreen state={state} />);
    expect(screen.getByText(/saved as you told us/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /yes, that's right/i })).toBeNull();
  });

  it('warns about recovery scams without blame', () => {
    render(<RecoveryScreen state={baseState} />);
    expect(screen.getByText(/get your money back for a fee/i)).toBeVisible();
    expect(screen.queryByText(/your fault|you should have|careless/i)).toBeNull();
  });
});
