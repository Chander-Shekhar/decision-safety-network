import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllySharePreview } from './AllySharePreview';
import type { AllyPacketContent } from '../../../packages/contracts/src/ally';

const packet: AllyPacketContent = {
  claim: 'Account compromised',
  proposedAction: 'Transfer to a safe account',
  amountMinor: 5_000_000,
  verificationGap: 'Caller not independently verified',
  selectedEvidence: [{ id: 'e1', excerpt: 'Transfer ₹50,000 to safe-new' }],
};

describe('AllySharePreview', () => {
  it('shows the exact packet including the selected excerpt, and says what is excluded', () => {
    render(<AllySharePreview allyName="Alex" packet={packet} />);
    expect(screen.getByText(/account compromised/i)).toBeVisible();
    expect(screen.getByText(/transfer to a safe account/i)).toBeVisible();
    expect(screen.getByText(/50,000/, { selector: 'dd' })).toBeVisible();
    expect(screen.getByText(/caller not independently verified/i)).toBeVisible();
    expect(screen.getByText(/Transfer ₹50,000 to safe-new/)).toBeVisible();
    expect(screen.getByText(/full transcript and other evidence are not included/i)).toBeVisible();
  });

  it('says the ally cannot see the case yet and that Simulated behavior is labeled', () => {
    render(<AllySharePreview allyName="Alex" packet={packet} />);
    expect(screen.getByText(/alex cannot see this case yet/i)).toBeVisible();
    expect(screen.getAllByText(/simulated/i).length).toBeGreaterThan(0);
  });

  it('requires an explicit Share click; rendering alone shares nothing', async () => {
    const onShare = vi.fn();
    const user = userEvent.setup();
    render(<AllySharePreview allyName="Alex" packet={packet} onShare={onShare} />);
    expect(onShare).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /share this case with alex/i }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('Not now leaves access denied: it never calls onShare', async () => {
    const onShare = vi.fn();
    const onNotNow = vi.fn();
    const user = userEvent.setup();
    render(<AllySharePreview allyName="Alex" packet={packet} onShare={onShare} onNotNow={onNotNow} />);
    await user.click(screen.getByRole('button', { name: /not now/i }));
    expect(onNotNow).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('a stale preview disables Share and asks for a refresh', async () => {
    const onShare = vi.fn();
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<AllySharePreview allyName="Alex" packet={packet} stale onShare={onShare} onRefresh={onRefresh} />);
    expect(screen.getByRole('button', { name: /share this case with alex/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /refresh preview/i }));
    expect(onRefresh).toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
  });

  it('states the grant is case-specific and revocable', () => {
    render(<AllySharePreview allyName="Alex" packet={packet} />);
    expect(screen.getByText(/only after you share/i)).toBeVisible();
    expect(screen.getByText(/revoke this grant at any time/i)).toBeVisible();
  });
});
