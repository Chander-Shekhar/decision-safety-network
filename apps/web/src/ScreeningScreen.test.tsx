import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ScreeningVerdict } from '../../../packages/contracts/src/screening';
import { ConfirmFraudPanel, IncomingCallScreen } from './ScreeningScreen';

function verdict(over: Partial<ScreeningVerdict>): ScreeningVerdict {
  return {
    level: 'none',
    warn: false,
    maskedNumber: '+91 ••••• ••210',
    headline: null,
    detail: null,
    previouslyReported: false,
    signal: { category: 'no-signal' },
    listening: 'ask',
    trust: 'untrusted',
    simulated: true,
    officialRoute: null,
    certifiesCaller: false,
    ...over,
  };
}

describe('IncomingCallScreen', () => {
  it('shows an unverified-caller warning before pickup', async () => {
    const onScreen = vi.fn().mockResolvedValue(
      verdict({ level: 'unverified', warn: true, headline: 'Unverified caller', detail: "We can't confirm who this is." }),
    );
    render(<IncomingCallScreen onScreen={onScreen} onAnswer={vi.fn()} onDecline={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /unfamiliar number/i }));
    expect(onScreen).toHaveBeenCalledWith('+91 99999 00002');
    expect(await screen.findByRole('alert')).toHaveTextContent(/unverified caller/i);
    expect(screen.getByRole('button', { name: /answer with protection/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /let it ring/i })).toBeVisible();
  });

  it('shows the previously-reported warning', async () => {
    const onScreen = vi.fn().mockResolvedValue(
      verdict({ level: 'previously-reported', warn: true, previouslyReported: true, headline: 'Previously reported by you', detail: 'You do not have to answer.' }),
    );
    render(<IncomingCallScreen onScreen={onScreen} onAnswer={vi.fn()} onDecline={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/caller's number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /check this call/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/previously reported by you/i);
  });

  it('shows no warning for a clean number', async () => {
    const onScreen = vi.fn().mockResolvedValue(verdict({}));
    const onAnswer = vi.fn();
    render(<IncomingCallScreen onScreen={onScreen} onAnswer={onAnswer} onDecline={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /ordinary number/i }));
    expect(await screen.findByRole('button', { name: /^answer$/i })).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/unverified|previously reported|simulated/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^answer$/i }));
    expect(onAnswer).toHaveBeenCalledWith('+91 98765 43210', expect.objectContaining({ warn: false }));
  });

  it('never labels a caller as safe, verified, or official', async () => {
    const onScreen = vi.fn().mockResolvedValue(verdict({ level: 'unverified', warn: true, headline: 'Unverified caller', detail: 'x' }));
    render(<IncomingCallScreen onScreen={onScreen} onAnswer={vi.fn()} onDecline={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /flagged by others/i }));
    await screen.findByRole('alert');
    expect(screen.queryByText(/\bverified caller|\bofficial|\bsafe caller|trusted/i)).toBeNull();
  });

  it('offers a retry and changes nothing when screening fails', async () => {
    const onScreen = vi.fn().mockRejectedValue(new Error('x'));
    render(<IncomingCallScreen onScreen={onScreen} onAnswer={vi.fn()} onDecline={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /ordinary number/i }));
    expect(await screen.findByText(/couldn't check that number/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /check this call/i })).toBeEnabled();
  });
});

describe('ConfirmFraudPanel', () => {
  it('adds to the private list only on explicit confirmation', async () => {
    const onConfirm = vi.fn().mockResolvedValue('+91 ••••• ••210');
    render(<ConfirmFraudPanel initialNumber="9876543210" onConfirm={onConfirm} />);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /confirm as fraud/i }));
    expect(onConfirm).toHaveBeenCalledWith('9876543210');
    expect(await screen.findByText(/on your private list/i)).toBeVisible();
  });

  it('reports failures without changing anything', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('x'));
    render(<ConfirmFraudPanel initialNumber="9876543210" onConfirm={onConfirm} />);
    expect(screen.getByText(/add the caller to the scammer list/i)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /confirm as fraud/i }));
    expect(await screen.findByText(/nothing was changed/i)).toBeVisible();
  });
});
