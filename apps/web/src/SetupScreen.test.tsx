import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupScreen } from './SetupScreen';
import { HomeScreen } from './HomeScreen';

describe('SetupScreen', () => {
  it('requires a call-listening choice before continuing, and offers the three modes', async () => {
    const user = userEvent.setup();
    render(<SetupScreen onComplete={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /all calls/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /unverified numbers only/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /decide per call at pickup/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /unverified numbers only/i }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('walks ally and account steps and completes with the collected values; one primary action per step', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<SetupScreen onComplete={onComplete} />);
    await user.click(screen.getByRole('radio', { name: /all calls/i }));
    await user.click(screen.getByRole('checkbox', { name: /allow processing/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Step 2 of 3')).toBeVisible();
    await user.type(screen.getByLabelText(/ally pairing code/i), 'ABC123');
    await user.click(screen.getByRole('checkbox', { name: /selected evidence excerpts/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Step 3 of 3')).toBeVisible();
    expect(screen.getByText(/ending 4821/)).toBeVisible();
    await user.type(screen.getByLabelText('Account nickname'), 'Demo Current');
    await user.type(screen.getByLabelText('Last 4 digits'), '99a99');
    await user.click(screen.getByRole('button', { name: 'Add account' }));
    expect(screen.getByText(/ending 9999/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const values = onComplete.mock.calls[0][0];
    expect(values).toMatchObject({
      callListening: 'all-calls',
      processingConsent: true,
      allySharingConsent: true,
      allyPairingCode: 'ABC123',
    });
    expect(values.allyShareFields).toContain('selectedEvidence');
    expect(values.bankAccounts.map((a: { label: string }) => a.label)).toEqual(['Demo Bank Savings', 'Demo Current']);
  });

  it('will not finish without at least one registered account', async () => {
    const user = userEvent.setup();
    render(<SetupScreen onComplete={vi.fn()} initial={{ callListening: 'per-call' }} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: /remove demo bank savings/i }));
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeDisabled();
  });
});

describe('HomeScreen', () => {
  it('summarises the configured protection with one primary action', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeScreen
        plan={{ callListening: 'unverified-only', processingConsent: true, bankAccounts: [{ id: 'a', label: 'Demo Savings', last4: '4821' }] }}
        allyStatus="none"
        onStartSession={onStart}
        onEditPlan={vi.fn()}
      />,
    );
    expect(screen.getByText(/unverified numbers only/i)).toBeVisible();
    expect(screen.getByText(/Demo Savings/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start a protected session' }));
    expect(onStart).toHaveBeenCalled();
  });
});
