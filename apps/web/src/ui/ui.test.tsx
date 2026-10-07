import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Badge, Callout, StepRail } from './index';

describe('Button', () => {
  it('renders label and fires onClick; disabled blocks it', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<Button onClick={onClick} disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('Badge', () => {
  it('renders Simulated text', () => {
    render(<Badge tone="simulated">Simulated</Badge>);
    expect(screen.getByText('Simulated')).toBeInTheDocument();
  });
});

describe('Callout', () => {
  it('renders error text with alert role', () => {
    render(<Callout kind="error" role="alert">Request failed</Callout>);
    expect(screen.getByRole('alert')).toHaveTextContent('Request failed');
  });
});

describe('StepRail', () => {
  it('disables a locked step and selects an available one', async () => {
    const onSelect = vi.fn();
    render(<StepRail current="Plan" onSelect={onSelect}
      steps={[{ step: 'Plan', available: true }, { step: 'Session', available: false, reason: 'Save plan first.' }]} />);
    expect(screen.getByRole('button', { name: /Session/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Plan/ }));
    expect(onSelect).toHaveBeenCalledWith('Plan');
  });
});
