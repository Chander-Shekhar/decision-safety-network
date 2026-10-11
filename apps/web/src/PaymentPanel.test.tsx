import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentPanel } from './PaymentPanel';

const draft = { beneficiaryId: 'safe-new', amountMinor: 50_000, newPayee: true, version: 1 };

describe('PaymentPanel', () => {
  it('carries no per-panel simulated stamp, before or after submit (header disclosure covers it)', () => {
    const { rerender } = render(<PaymentPanel draft={draft} paymentState="draft" />);
    expect(screen.queryByText(/simulated/i)).toBeNull();
    rerender(<PaymentPanel draft={draft} paymentState="pending" />);
    expect(screen.queryByText(/simulated/i)).toBeNull();
  });

  it('shows the beneficiary and amount from the draft, including new-payee', () => {
    render(<PaymentPanel draft={draft} paymentState="draft" />);
    expect(screen.getByText(/safe-new/i)).toBeVisible();
    expect(screen.getByText(/new payee/i)).toBeVisible();
    expect(screen.getByText(/500/)).toBeVisible();
  });

  it('does not render the removed connection/Pause reassurance clutter', () => {
    render(<PaymentPanel draft={draft} paymentState="draft" />);
    expect(screen.queryByText(/no enhanced pause from words alone|still checking the connection/i)).toBeNull();
  });

  it('lets the owner submit the draft', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PaymentPanel draft={draft} paymentState="draft" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /submit intent/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('offers a single Submit intent action and never claims an authorized payment', () => {
    render(<PaymentPanel draft={draft} paymentState="draft" />);
    expect(screen.getByRole('button', { name: /submit intent/i })).toBeEnabled();
    expect(screen.queryByText(/authorized payment|real hold/i)).toBeNull();
  });

  it('disables submit when there is no draft yet', () => {
    render(<PaymentPanel paymentState="draft" />);
    expect(screen.getByRole('button', { name: /submit intent/i })).toBeDisabled();
  });

  it('disables submit once the payment is no longer in draft', () => {
    render(<PaymentPanel draft={draft} paymentState="pending" />);
    expect(screen.getByRole('button', { name: /submit intent/i })).toBeDisabled();
  });

  it('offers the "I already paid" recovery link', async () => {
    const onAlreadyPaid = vi.fn();
    const user = userEvent.setup();
    render(<PaymentPanel draft={draft} paymentState="draft" onAlreadyPaid={onAlreadyPaid} />);

    await user.click(screen.getByRole('button', { name: /i already paid/i }));
    expect(onAlreadyPaid).toHaveBeenCalled();
  });

  it('immediately calls the authenticated recheck route once the payment becomes pending', async () => {
    const onRecheck = vi.fn().mockResolvedValue(undefined);
    render(<PaymentPanel draft={draft} paymentState="pending" segmentIds={['s1']} onRecheck={onRecheck} />);
    await waitFor(() => expect(onRecheck).toHaveBeenCalledTimes(1));
  });

  it('never calls recheck while still a draft (nothing to join yet)', async () => {
    const onRecheck = vi.fn().mockResolvedValue(undefined);
    render(<PaymentPanel draft={draft} paymentState="draft" segmentIds={['s1']} onRecheck={onRecheck} />);
    await act(async () => {});
    expect(onRecheck).not.toHaveBeenCalled();
  });

  it('calls recheck again when the pending draft changes', async () => {
    const onRecheck = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<PaymentPanel draft={draft} paymentState="pending" segmentIds={['s1']} onRecheck={onRecheck} />);
    await waitFor(() => expect(onRecheck).toHaveBeenCalledTimes(1));

    rerender(<PaymentPanel draft={{ ...draft, amountMinor: 90_000, version: 2 }} paymentState="pending" segmentIds={['s1']} onRecheck={onRecheck} />);
    await waitFor(() => expect(onRecheck).toHaveBeenCalledTimes(2));
  });

  it('calls recheck again when a new decisive segment arrives while pending', async () => {
    const onRecheck = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<PaymentPanel draft={draft} paymentState="pending" segmentIds={['s1']} onRecheck={onRecheck} />);
    await waitFor(() => expect(onRecheck).toHaveBeenCalledTimes(1));

    rerender(<PaymentPanel draft={draft} paymentState="pending" segmentIds={['s1', 's2']} onRecheck={onRecheck} />);
    await waitFor(() => expect(onRecheck).toHaveBeenCalledTimes(2));
  });

  it('shows a rechecking status while the recheck call is in flight, mirroring frame 03\'s non-fabricating fallback', async () => {
    let resolveRecheck: () => void = () => {};
    const onRecheck = vi.fn().mockReturnValue(new Promise<void>((resolve) => (resolveRecheck = resolve)));
    render(<PaymentPanel draft={draft} paymentState="pending" segmentIds={['s1']} onRecheck={onRecheck} />);

    await waitFor(() => expect(screen.getByText(/rechecking your updated transfer/i)).toBeVisible());
    expect(screen.getByText(/still pending/i)).toBeVisible();

    await act(async () => {
      resolveRecheck();
    });
  });

  it('shows a degraded "AI check unavailable" status on recheck failure, while manual controls stay available', async () => {
    const onRecheck = vi.fn().mockRejectedValue(new Error('GEMINI_TIMEOUT'));
    const onAlreadyPaid = vi.fn();
    render(<PaymentPanel draft={draft} paymentState="pending" segmentIds={['s1']} onRecheck={onRecheck} onAlreadyPaid={onAlreadyPaid} />);

    await waitFor(() => expect(screen.getByText(/safety check unavailable.*choose an action/i)).toBeVisible());
    expect(screen.getByRole('button', { name: /i already paid/i })).toBeEnabled();
  });

  it('never shows a scam probability or mental-state label', () => {
    render(<PaymentPanel draft={draft} paymentState="pending" />);
    expect(screen.queryByText(/scam probability|risk score|likely (a )?scam|mental state/i)).toBeNull();
  });
});
