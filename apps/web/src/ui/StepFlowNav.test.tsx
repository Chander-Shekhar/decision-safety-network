import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepFlowNav } from './StepFlowNav';
import type { StepStatus } from '../journey';

const steps: StepStatus[] = [
  { step: 'Plan', available: true },
  { step: 'Session', available: true },
  { step: 'Review', available: false, reason: 'Start a controlled session first.' },
  { step: 'Decide', available: false, reason: 'Facts must be extracted first.' },
  { step: 'Verify', available: false },
  { step: 'Ally', available: false },
];

describe('StepFlowNav', () => {
  it('shows the position and moves back a step', async () => {
    const onSelect = vi.fn();
    render(<StepFlowNav steps={steps} current="Session" onSelect={onSelect} />);
    expect(screen.getByText('Step 2 of 6')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /back to plan/i }));
    expect(onSelect).toHaveBeenCalledWith('Plan');
  });

  it('disables Next until the next step is unlocked, and surfaces the reason', async () => {
    const onSelect = vi.fn();
    render(<StepFlowNav steps={steps} current="Session" onSelect={onSelect} />);
    const next = screen.getByRole('button', { name: /next: review/i });
    expect(next).toBeDisabled();
    expect(screen.getByText(/start a controlled session first/i)).toBeVisible();
    await userEvent.click(next);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers no Back on the first step and no Next on the last', () => {
    const { rerender } = render(<StepFlowNav steps={steps} current="Plan" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next: session/i })).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(1); // no Back on step 1

    rerender(<StepFlowNav steps={steps} current="Ally" onSelect={vi.fn()} />);
    expect(screen.getByText('Step 6 of 6')).toBeVisible();
    expect(screen.getByRole('button', { name: /back to verify/i })).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(1); // no Next on the last step
  });
});
