import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('on first run, welcomes the user and points to Settings', async () => {
    const onOpenSettings = vi.fn();
    const user = userEvent.setup();
    render(<HomeScreen firstRun allyStatus="ready" onStartSession={vi.fn()} onOpenSettings={onOpenSettings} />);

    expect(screen.getByText(/first time/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /go to settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('once configured, summarises protection with one primary action and a Settings link', async () => {
    const onStart = vi.fn();
    const onOpenSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeScreen
        plan={{ callListening: 'unverified-only', processingConsent: true, bankAccounts: [{ id: 'a', label: 'Everyday Savings', last4: '4821' }] }}
        allyStatus="ready"
        onStartSession={onStart}
        onOpenSettings={onOpenSettings}
      />,
    );
    expect(screen.getByText(/unverified numbers only/i)).toBeVisible();
    expect(screen.getByText(/Everyday Savings/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start a protected session' }));
    expect(onStart).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /edit settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('marks the ready ally as a sample so it is not mistaken for a real paired helper', () => {
    render(
      <HomeScreen
        plan={{ callListening: 'per-call', processingConsent: true, bankAccounts: [] }}
        allyStatus="ready"
        allyIsSample
        onStartSession={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText(/Ally ready \(sample\)/i)).toBeVisible();
  });
});
