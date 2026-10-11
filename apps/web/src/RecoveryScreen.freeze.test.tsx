import { render, screen, within } from '@testing-library/react';
import { RecoveryScreen } from './RecoveryScreen';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';

const state: RecoveryState = {
  caseId: 'case-1',
  known: { facts: {}, evidenceIds: [] },
  proposedPayment: null,
  paidPayment: null,
  missing: [],
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

describe('RecoveryScreen guided freeze (DSN-027)', () => {
  it('shows a guided card with the helpline link and the case-filled script, and says it is not a real freeze', () => {
    render(<RecoveryScreen state={state} />);
    const card = screen.getByRole('region', { name: /protect the affected account/i });
    expect(within(card).getByText(/not a real freeze/i)).toBeVisible();
    expect(within(card).getByText(/for the account you paid from only/i)).toBeVisible();
    expect(within(card).getByRole('link', { name: '1800 000 0000' })).toHaveAttribute('href', 'tel:18000000000');
    expect(within(card).getByText(/I paid Rs 50,000 to safe-new/)).toBeVisible();
    expect(within(card).queryByText(/account (has been|is|was) frozen/i)).toBeNull();
  });

  it('renders no guided card when the API supplies none', () => {
    const { guidedFreeze: _omit, ...rest } = state;
    render(<RecoveryScreen state={rest} />);
    expect(screen.queryByRole('region', { name: /protect the affected account/i })).toBeNull();
  });
});
