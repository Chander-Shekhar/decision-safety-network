import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionMap, FactCorrectionPanel } from './DecisionMap';
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

  it('frames facts as unverified caller claims in the header, without a per-row pill', () => {
    render(<DecisionMap facts={[claimedPayee]} />);
    // The "unverified claims" framing lives once in the header, not as a pill on every row.
    expect(screen.getByText(/none of it is independently verified/i)).toBeInTheDocument();
    expect(screen.getByText('safe-new')).toBeVisible();
    expect(screen.queryByText(/caller claimed/i)).toBeNull();
  });

  it('is read-only: no per-fact confirm or correct control', () => {
    render(<DecisionMap facts={[claimedPayee]} />);
    expect(screen.queryByRole('button', { name: /^confirm/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^correct$/i })).toBeNull();
    expect(screen.queryByLabelText(/^correct /i)).toBeNull();
  });

  it('shows an explicit Unknown label for a field with no model candidate, and no view-source control', () => {
    render(<DecisionMap facts={[unknownDeadline]} />);
    expect(screen.getByText('Unknown')).toBeVisible();
    expect(screen.queryByRole('button', { name: /view source/i })).toBeNull();
  });

  it('exposes the backing transcript excerpt behind a corner View source popover', () => {
    const resolveSource = vi.fn().mockReturnValue([{ speaker: 'Caller', text: 'Move it to safe-new now.' }]);
    render(<DecisionMap facts={[claimedPayee]} sourceRetained resolveSource={resolveSource} />);

    expect(screen.getByRole('button', { name: /view source/i })).toBeInTheDocument();
    expect(resolveSource).toHaveBeenCalledWith(['s1']);
    // The excerpt is rendered in a role="tooltip" popover revealed on hover/focus.
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/move it to safe-new now/i)).toBeInTheDocument();
  });

  it('shows a plain fallback when the citation resolves to no excerpt', () => {
    render(<DecisionMap facts={[claimedPayee]} sourceRetained resolveSource={() => []} />);
    expect(screen.getByText(/source excerpt unavailable/i)).toBeInTheDocument();
  });

  it('drops the source link and quietly marks the source not retained once it has expired', () => {
    render(<DecisionMap facts={[claimedPayee]} sourceRetained={false} />);
    expect(screen.queryByRole('button', { name: /view source/i })).toBeNull();
    expect(screen.getByText(/source not retained/i)).toBeVisible();
  });

  it('shows a quiet uncertainty tag for medium/high uncertainty, none for low', () => {
    const { rerender } = render(<DecisionMap facts={[claimedPayee]} />);
    expect(screen.getByText(/unconfirmed/i)).toBeVisible();
    rerender(<DecisionMap facts={[{ ...claimedPayee, uncertainty: 'high' }]} />);
    expect(screen.getByText(/low confidence/i)).toBeVisible();
    rerender(<DecisionMap facts={[{ ...claimedPayee, uncertainty: 'low' }]} />);
    expect(screen.queryByText(/unconfirmed|low confidence/i)).toBeNull();
  });

  it('labels a confirmed fact as "you confirmed what was said", not an endorsement of the claim', () => {
    const confirmed: Fact = { ...claimedPayee, origin: 'user-confirmed' };
    render(<DecisionMap facts={[confirmed]} />);
    expect(screen.getByText(/you confirmed what was said/i)).toBeVisible();
    expect(screen.queryByText(/caller claimed/i)).toBeNull();
  });

  it('labels a user-corrected fact distinctly, with no source link since it is not transcript-linked', () => {
    const corrected: Fact = { field: 'payee', value: 'Known safe payee', origin: 'user-corrected', sourceSegmentIds: [], uncertainty: 'low' };
    render(<DecisionMap facts={[corrected]} />);
    expect(screen.getByText(/you corrected this/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /view source/i })).toBeNull();
  });

  it('never shows a scam probability or mental-state label', () => {
    render(<DecisionMap facts={[claimedPayee, unknownDeadline]} />);
    expect(screen.queryByText(/scam probability|risk score|likely (a )?scam|mental state/i)).toBeNull();
  });
});

describe('FactCorrectionPanel', () => {
  it('is collapsed behind one on-demand control, not a per-fact input wall', () => {
    render(<FactCorrectionPanel facts={[claimedPayee, unknownDeadline]} onApply={vi.fn()} />);
    expect(screen.getByRole('button', { name: /not right\? correct it/i })).toBeVisible();
    // The inputs live inside the collapsed disclosure, not shown until opened.
    expect(screen.queryByLabelText('Payee')).toBeNull();
  });

  it('applies several corrections at once, framed as what was said', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FactCorrectionPanel facts={[claimedPayee, { ...unknownDeadline }]} onApply={onApply} />);

    await user.click(screen.getByRole('button', { name: /not right\? correct it/i }));
    await user.type(screen.getByLabelText('Payee'), 'Known safe payee');
    await user.type(screen.getByLabelText('Deadline'), 'No deadline given');

    const apply = screen.getByRole('button', { name: /apply 2 corrections/i });
    expect(apply).toBeEnabled();
    await user.click(apply);

    expect(onApply).toHaveBeenCalledWith([
      { field: 'payee', value: 'Known safe payee' },
      { field: 'deadline', value: 'No deadline given' },
    ]);
  });

  it('ignores blank/whitespace-only inputs', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FactCorrectionPanel facts={[claimedPayee]} onApply={onApply} />);

    await user.click(screen.getByRole('button', { name: /not right\? correct it/i }));
    await user.type(screen.getByLabelText('Payee'), '   ');
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
  });
});
