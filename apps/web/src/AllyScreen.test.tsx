import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllyScreen } from './AllyScreen';
import type { AllyPacket } from '../../../packages/contracts/src/ally';

const packet: AllyPacket = {
  caseId: 'case-1',
  expiresAt: '2026-10-05T10:00:00.000Z',
  claim: 'Account compromised',
  proposedAction: 'Transfer to a safe account',
  amountMinor: 5_000_000,
  verificationGap: 'Caller not independently verified',
  selectedEvidence: [{ id: 'e1', excerpt: 'Transfer ₹50,000 to safe-new' }],
};

describe('AllyScreen', () => {
  it('shows only claim, action, amount, verification gap, and selected evidence', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.getByText(/account compromised/i)).toBeVisible();
    expect(screen.getByText(/transfer to a safe account/i)).toBeVisible();
    expect(screen.getByText(/50,000/, { selector: 'dd' })).toBeVisible();
    expect(screen.getByText(/caller not independently verified/i)).toBeVisible();
    expect(screen.getByText(/Transfer ₹50,000 to safe-new/)).toBeVisible();
  });

  it('hides the full transcript and unselected evidence, and says so', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.queryByText(/HIDDEN-TRANSCRIPT|UNSELECTED-EVIDENCE/)).toBeNull();
    expect(screen.getByText(/no full transcript or unselected evidence is shared/i)).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('labels the surface as a separate ally session and Simulated', () => {
    render(<AllyScreen packet={packet} />);
    expect(screen.getByText(/safety ally/i)).toBeVisible();
    expect(screen.getAllByText(/simulated/i).length).toBeGreaterThan(0);
  });

  it('lets the ally request contact', async () => {
    const onContactRequest = vi.fn();
    const user = userEvent.setup();
    render(<AllyScreen packet={packet} onContactRequest={onContactRequest} />);
    await user.click(screen.getByRole('button', { name: /request contact/i }));
    expect(onContactRequest).toHaveBeenCalledTimes(1);
  });

  it('lets the ally recommend a pause', async () => {
    const onPauseRecommendation = vi.fn();
    const user = userEvent.setup();
    render(<AllyScreen packet={packet} onPauseRecommendation={onPauseRecommendation} />);
    await user.click(screen.getByRole('button', { name: /recommend pause/i }));
    expect(onPauseRecommendation).toHaveBeenCalledTimes(1);
  });

  it('records an independent source the ally checked', async () => {
    const onCheckedSource = vi.fn();
    const user = userEvent.setup();
    render(<AllyScreen packet={packet} onCheckedSource={onCheckedSource} />);
    await user.type(screen.getByLabelText(/independent source you checked/i), 'Called the number on my own bank card');
    await user.click(screen.getByRole('button', { name: /record source/i }));
    expect(onCheckedSource).toHaveBeenCalledWith('Called the number on my own bank card');
  });

  it('does not submit an empty checked source', async () => {
    const onCheckedSource = vi.fn();
    const user = userEvent.setup();
    render(<AllyScreen packet={packet} onCheckedSource={onCheckedSource} />);
    await user.click(screen.getByRole('button', { name: /record source/i }));
    expect(onCheckedSource).not.toHaveBeenCalled();
  });

  it('offers no payment, continue, cancel, or caller-certification control', () => {
    render(<AllyScreen packet={packet} />);
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '');
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
