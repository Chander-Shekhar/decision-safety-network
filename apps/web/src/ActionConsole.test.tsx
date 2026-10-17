import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionConsole } from './ActionConsole';

describe('ActionConsole (DSN-038)', () => {
  it('offers the ally help path and never asks the owner to draft a transfer', () => {
    render(<ActionConsole allyName="Asha" onAskAlly={vi.fn()} onAlreadyPaid={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /ask asha for help/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /ask my ally/i })).toBeVisible();
    // The old payment-draft machinery is gone entirely.
    expect(screen.queryByRole('button', { name: /pause transfer|cancel transfer|continue the transfer|confirm continue/i })).toBeNull();
    expect(screen.queryByText(/transfer waiting on your decision/i)).toBeNull();
  });

  it('routes "Ask my ally" to its callback', async () => {
    const onAskAlly = vi.fn();
    render(<ActionConsole onAskAlly={onAskAlly} />);
    await userEvent.click(screen.getByRole('button', { name: /ask my ally/i }));
    expect(onAskAlly).toHaveBeenCalledTimes(1);
  });

  it('shows the "already paid" path and routes it to recovery', async () => {
    const onAlreadyPaid = vi.fn();
    render(<ActionConsole onAlreadyPaid={onAlreadyPaid} />);
    expect(screen.getByRole('heading', { name: /already sent the money/i })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /i already paid/i }));
    expect(onAlreadyPaid).toHaveBeenCalledTimes(1);
  });

  it('hides the "already paid" path when no handler is wired', () => {
    render(<ActionConsole onAskAlly={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /i already paid/i })).toBeNull();
  });

  it('shows a click-to-call to the real organisation only when a sourced number exists', () => {
    const { rerender } = render(
      <ActionConsole officialContact={{ organisation: 'Demo Bank', phoneNumber: '1800111222' }} />,
    );
    const call = screen.getByRole('link', { name: /call demo bank/i });
    expect(call).toHaveAttribute('href', 'tel:1800111222');

    rerender(<ActionConsole officialContact={{ organisation: 'Demo Bank', phoneNumber: null }} />);
    expect(screen.queryByRole('link', { name: /call/i })).toBeNull();
  });
});
