import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionConsole, type ActionConsoleCaseState } from './ActionConsole';
import type { PaymentReason } from '../../../packages/contracts/src/payment';

const reasons: PaymentReason[] = [
  { code: 'manipulation-cue', text: 'The caller used urgency pressure.', sourceSegmentIds: ['s1'] },
  { code: 'unverified-new-payee', text: 'This payee has never been paid before and is unverified.', sourceSegmentIds: ['s1'] },
];

const joinedCase: ActionConsoleCaseState = { phase: 'Pause', paymentState: 'paused', reasons };
const checkCase: ActionConsoleCaseState = { phase: 'Check', paymentState: 'pending', reasons: [] };

describe('ActionConsole', () => {
  it('shows up to 3 source-grounded reasons from the persisted projection, never a fourth', () => {
    const many: PaymentReason[] = [
      ...reasons,
      { code: 'large-amount', text: 'This is a larger transfer than usual.', sourceSegmentIds: ['s1'] },
      { code: 'extra', text: 'A fourth reason that must not render.', sourceSegmentIds: ['s1'] },
    ];
    render(<ActionConsole caseState={{ ...joinedCase, reasons: many }} />);
    expect(screen.getByText(/urgency pressure/i)).toBeVisible();
    expect(screen.getByText(/never been paid before/i)).toBeVisible();
    expect(screen.getByText(/larger transfer than usual/i)).toBeVisible();
    expect(screen.queryByText(/fourth reason/i)).toBeNull();
  });

  it('persistently labels the surface Simulated and uses pre-OTP framing', () => {
    render(<ActionConsole caseState={joinedCase} />);
    expect(screen.getAllByText(/simulated/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/before you enter an otp/i)).toBeVisible();
  });

  it('never shows a scam probability, risk score, or mental-state label', () => {
    render(<ActionConsole caseState={joinedCase} />);
    expect(screen.queryByText(/scam probability|risk score|likely (a )?scam|mental state/i)).toBeNull();
  });

  it('never claims a real transfer was held, reversed, or completed', () => {
    render(<ActionConsole caseState={joinedCase} />);
    expect(screen.queryByText(/we held your real transfer|real transfer (was|has been)/i)).toBeNull();
  });

  it('lets the owner pause the simulated transfer', async () => {
    const onPause = vi.fn();
    const user = userEvent.setup();
    render(<ActionConsole caseState={joinedCase} onPause={onPause} />);
    await user.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPause).toHaveBeenCalled();
  });

  it('lets the owner cancel the simulated transfer', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ActionConsole caseState={joinedCase} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('lets the owner verify officially, regardless of payment state', async () => {
    const onVerify = vi.fn();
    const user = userEvent.setup();
    const quiet: ActionConsoleCaseState = { phase: 'Observe', paymentState: undefined, reasons: [] };
    render(<ActionConsole caseState={quiet} onVerify={onVerify} />);
    await user.click(screen.getByRole('button', { name: /verify officially/i }));
    expect(onVerify).toHaveBeenCalled();
  });

  it('only opens the ask-my-ally preview; never shows it as completed or dropped', async () => {
    const onAskAlly = vi.fn();
    const user = userEvent.setup();
    render(<ActionConsole caseState={joinedCase} onAskAlly={onAskAlly} />);
    await user.click(screen.getByRole('button', { name: /ask my ally/i }));
    expect(onAskAlly).toHaveBeenCalled();
    expect(screen.queryByText(/shared|granted|dropped|completed/i)).toBeNull();
  });

  it('a joined Pause case starts the continue acknowledgment unchecked with Confirm Continue disabled', () => {
    render(<ActionConsole caseState={joinedCase} />);
    expect(screen.getByRole('checkbox', { name: /understand.*unverified/i })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /confirm continue/i })).toBeDisabled();
  });

  it('enables Confirm Continue only once the acknowledgment is checked, then calls onContinue', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<ActionConsole caseState={joinedCase} onContinue={onContinue} />);

    const checkbox = screen.getByRole('checkbox', { name: /understand.*unverified/i });
    const confirmButton = screen.getByRole('button', { name: /confirm continue/i });
    await user.click(checkbox);
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onContinue).toHaveBeenCalled();
  });

  it('a non-joined Check case uses an ordinary confirmation, with no acknowledgment gate', () => {
    render(<ActionConsole caseState={checkCase} />);
    expect(screen.queryByRole('checkbox', { name: /understand.*unverified/i })).toBeNull();
    expect(screen.getByRole('button', { name: /continue the simulated transfer/i })).toBeEnabled();
  });

  it('an ordinary Continue click calls onContinue directly, without an acknowledgment gate', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<ActionConsole caseState={checkCase} onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: /continue the simulated transfer/i }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('gates the acknowledgment and still requires it when the AI check is degraded, even from Check', () => {
    render(<ActionConsole caseState={checkCase} aiCheckDegraded />);
    expect(screen.getByText(/safety check could not be completed/i)).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /understand.*unverified/i })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /confirm continue/i })).toBeDisabled();
  });

  it('keeps manual Pause/Cancel/Verify actions enabled while the AI check is degraded', () => {
    render(<ActionConsole caseState={joinedCase} aiCheckDegraded onPause={vi.fn()} onCancel={vi.fn()} onVerify={vi.fn()} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /verify officially/i })).toBeEnabled();
  });

  it('shows a resolved, honest cancellation summary instead of action buttons once cancelled', () => {
    render(<ActionConsole caseState={{ phase: 'Resolve', paymentState: 'cancelled', reasons }} />);
    expect(screen.getByText(/cancelled, not just hidden/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /pause/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
  });

  it('hides Pause/Cancel/Continue when there is no open payment to act on, but still offers Verify and Ask My Ally', () => {
    render(<ActionConsole caseState={{ phase: 'Observe', paymentState: undefined, reasons: [] }} />);
    expect(screen.queryByRole('button', { name: /pause/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    expect(screen.getByRole('button', { name: /verify officially/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /ask my ally/i })).toBeVisible();
  });

  it('renders without throwing, and shows zero reason rows, for a projection with no reasons field at all (a quiet case createCase just made)', () => {
    const noReasonsField = { phase: 'Observe', paymentState: undefined } as unknown as ActionConsoleCaseState;
    expect(() => render(<ActionConsole caseState={noReasonsField} />)).not.toThrow();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
