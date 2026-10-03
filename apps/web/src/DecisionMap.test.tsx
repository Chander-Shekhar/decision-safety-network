import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionMap } from './DecisionMap';
import type { Fact } from '../../../packages/contracts/src/facts';

const claimedPayee: Fact = {
  field: 'payee',
  value: 'safe-new',
  origin: 'model',
  sourceSegmentIds: ['s1'],
  uncertainty: 'medium',
};

const unknownDeadline: Fact = {
  field: 'deadline',
  value: 'unknown',
  origin: 'model',
  sourceSegmentIds: [],
  uncertainty: 'high',
};

describe('DecisionMap', () => {
  it('shows the live status distinctly from degraded', () => {
    const { rerender } = render(<DecisionMap status="live" facts={[]} />);
    expect(screen.getByText(/live processing$/i)).toBeVisible();
    expect(screen.queryByText(/degraded/i)).toBeNull();

    rerender(<DecisionMap status="degraded" facts={[]} />);
    expect(screen.getByText(/degraded/i)).toBeVisible();
  });

  it('frames a model-extracted fact as a caller claim, not independently verified', () => {
    render(<DecisionMap facts={[claimedPayee]} />);
    expect(screen.getByText(/caller claimed/i)).toBeVisible();
    expect(screen.getByText(/not independently verified/i)).toBeVisible();
    expect(screen.getByText('safe-new')).toBeVisible();
  });

  it('shows an explicit Unknown label for a field with no model candidate, and no view-source or confirm control', () => {
    render(<DecisionMap facts={[unknownDeadline]} />);
    expect(screen.getByText('Unknown')).toBeVisible();
    expect(screen.queryByRole('button', { name: /view source/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm/i })).toBeNull();
  });

  it('offers a source excerpt link when a citation exists and source is retained', async () => {
    const onViewSource = vi.fn();
    const user = userEvent.setup();
    render(<DecisionMap facts={[claimedPayee]} sourceRetained onViewSource={onViewSource} />);

    const button = screen.getByRole('button', { name: /view source/i });
    await user.click(button);
    expect(onViewSource).toHaveBeenCalledWith('payee', ['s1']);
  });

  it('shows "Source not retained" instead of a source link once source has expired', () => {
    render(<DecisionMap facts={[claimedPayee]} sourceRetained={false} />);
    expect(screen.getByText(/source not retained/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /view source/i })).toBeNull();
  });

  it('lets the owner confirm a model-extracted fact', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<DecisionMap facts={[claimedPayee]} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: /^confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith('payee');
  });

  it('lets the owner correct a fact to a new value', async () => {
    const onCorrect = vi.fn();
    const user = userEvent.setup();
    render(<DecisionMap facts={[claimedPayee]} onCorrect={onCorrect} />);

    await user.type(screen.getByLabelText(/correct payee/i), 'Known safe payee');
    await user.click(screen.getByRole('button', { name: /^correct$/i }));
    expect(onCorrect).toHaveBeenCalledWith('payee', 'Known safe payee');
  });

  it('labels a user-confirmed fact distinctly from a caller claim or correction', () => {
    const confirmed: Fact = { ...claimedPayee, origin: 'user-confirmed' };
    render(<DecisionMap facts={[confirmed]} />);
    expect(screen.getByText(/user confirmed/i)).toBeVisible();
    expect(screen.queryByText(/caller claimed/i)).toBeNull();
    // Confirming is not re-confirmable through the same control.
    expect(screen.queryByRole('button', { name: /^confirm/i })).toBeNull();
  });

  it('labels a user-corrected fact distinctly, with no source link since it is not transcript-linked', () => {
    const corrected: Fact = { field: 'payee', value: 'Known safe payee', origin: 'user-corrected', sourceSegmentIds: [], uncertainty: 'low' };
    render(<DecisionMap facts={[corrected]} />);
    expect(screen.getByText(/user corrected/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /view source/i })).toBeNull();
  });

  it('never shows a scam probability or mental-state label', () => {
    render(<DecisionMap facts={[claimedPayee, unknownDeadline]} />);
    expect(screen.queryByText(/scam probability|risk score|likely (a )?scam|mental state/i)).toBeNull();
  });
});
