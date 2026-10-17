import { render, screen } from '@testing-library/react';
import { AllyScreen } from './AllyScreen';
import type { AllyPacket } from '../../../packages/contracts/src/ally';

const packet: AllyPacket = {
  caseId: 'case-1',
  expiresAt: '2026-10-05T10:00:00.000Z',
  claim: 'Account compromised',
  proposedAction: 'Transfer to a safe account',
  amountMinor: 5_000_000,
  verificationGap: 'Caller not independently verified',
  summary: 'A caller contacted them, claiming account compromised. They were pushed to transfer to a safe account. The caller has not been independently verified.',
};

describe('AllyScreen', () => {
  it('shows only claim, action, amount, verification gap, and the AI summary', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.getByText(/account compromised/i, { selector: 'dd' })).toBeVisible();
    expect(screen.getByText(/transfer to a safe account/i, { selector: 'dd' })).toBeVisible();
    expect(screen.getByText(/50,000/, { selector: 'dd' })).toBeVisible();
    expect(screen.getByText(/caller not independently verified/i)).toBeVisible();
    expect(screen.getByText(/short summary/i)).toBeVisible();
  });

  it('hides the full transcript, shares no recording, and says so', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.queryByText(/HIDDEN-TRANSCRIPT|UNSELECTED-EVIDENCE/)).toBeNull();
    expect(screen.getByText(/no recording or full transcript is shared/i)).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('labels the surface as a separate ally session', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.getByText(/safety ally/i)).toBeVisible();
    expect(screen.queryByText(/simulated/i)).toBeNull();
  });

  it('shows who shared the case and a tel: call link to them', () => {
    render(<AllyScreen packet={packet} sharer={{ caseId: 'case-1', displayName: 'Ravi', mobile: '98765 43210' }} />);
    expect(screen.getByText('Ravi')).toBeVisible();
    const call = screen.getByRole('link', { name: /call ravi/i });
    expect(call).toHaveAttribute('href', 'tel:+919876543210');
  });

  it('with no number on file, shows no call link and says they have not added one', () => {
    render(<AllyScreen packet={packet} sharer={{ caseId: 'case-1', displayName: 'Ravi' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/haven.t added a phone number/i)).toBeVisible();
  });

  it('has no hard-coded response actions - the call link is the only action', () => {
    render(<AllyScreen packet={packet} sharer={{ caseId: 'case-1', mobile: '9876543210' }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/your response|request contact|recommend pause|record source|contact the caller/i)).toBeNull();
  });

  it('offers no payment, continue, cancel, or caller-certification control', () => {
    render(<AllyScreen packet={packet} />);
    const names = screen.queryAllByRole('button').map((b) => b.textContent ?? '');
    expect(names.join(' | ')).not.toMatch(/pay|continue|cancel|approve|verified|certify|confirm caller|release|transfer/i);
    expect(screen.getByText(/you cannot control funds or certify the caller/i)).toBeVisible();
  });

  it('shows no packet once the grant is stale or revoked', () => {
    const { rerender } = render(<AllyScreen packet={packet} accessState="stale" />);
    expect(screen.queryByText(/account compromised/i)).toBeNull();
    expect(screen.getByText(/case changed/i)).toBeVisible();
    rerender(<AllyScreen packet={packet} accessState="revoked" />);
    expect(screen.queryByText(/account compromised/i)).toBeNull();
    expect(screen.getByText(/no longer have access/i)).toBeVisible();
  });
});
