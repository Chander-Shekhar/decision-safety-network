import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanScreen } from './PlanScreen';

describe('PlanScreen · owner view', () => {
  it('exposes explicit form controls for threshold and all four separate consents', () => {
    render(<PlanScreen role="owner" allyStatus="none" onSavePlan={vi.fn()} />);
    expect(screen.getByLabelText('Large new-payee threshold')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /allow processing/i })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /allow ally sharing/i })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /allow evidence export/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /delete case content at close/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /confirmed facts.*24 hours/i })).toBeVisible();
    expect(screen.getByRole('radio', { name: /selected excerpts.*7 days/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Safety Plan' })).toBeVisible();
  });

  it('plainly discloses the 24-hour confirmed-facts default and defaults the retention radio to it', () => {
    render(<PlanScreen role="owner" allyStatus="none" onSavePlan={vi.fn()} />);
    expect(screen.getByText(/24.hour/i)).toBeVisible();
    expect(screen.getByText(/confirmed facts/i)).toBeVisible();
    expect(screen.getByText(/default/i)).toBeVisible();
    expect(screen.getByRole('radio', { name: /confirmed facts.*24 hours/i })).toBeChecked();
  });

  it('warns that delete-on-close sacrifices later no-reentry recovery', () => {
    render(<PlanScreen role="owner" allyStatus="none" onSavePlan={vi.fn()} />);
    expect(screen.getByText(/no.?re-?entry recovery/i)).toBeVisible();
  });

  it('shows the fictional Demo Bank route and warns never to use a caller-supplied number', () => {
    render(<PlanScreen role="owner" allyStatus="none" onSavePlan={vi.fn()} />);
    expect(screen.getByText(/demo bank/i)).toBeVisible();
    expect(screen.getByText(/never use a number provided by the caller/i)).toBeVisible();
  });

  it('does not show "nominated" as "ready" until the ally has accepted', () => {
    render(<PlanScreen role="owner" allyStatus="invited" onSavePlan={vi.fn()} />);
    expect(screen.getByText(/nominated/i)).toBeVisible();
    expect(screen.queryByText(/ready/i)).toBeNull();
  });

  it('shows readiness only once the nominated ally has accepted', () => {
    render(<PlanScreen role="owner" allyStatus="ready" onSavePlan={vi.fn()} />);
    expect(screen.getByText(/ready/i)).toBeVisible();
  });

  it('submits the four consents, threshold (converted to minor units), retention mode, and bank id on Save', async () => {
    const onSavePlan = vi.fn();
    const user = userEvent.setup();
    render(<PlanScreen role="owner" allyStatus="none" onSavePlan={onSavePlan} />);

    await user.clear(screen.getByLabelText('Large new-payee threshold'));
    await user.type(screen.getByLabelText('Large new-payee threshold'), '10000');
    await user.click(screen.getByRole('checkbox', { name: /allow processing/i }));
    await user.click(screen.getByRole('checkbox', { name: /allow ally sharing/i }));
    await user.click(screen.getByRole('checkbox', { name: /allow evidence export/i }));
    await user.click(screen.getByRole('button', { name: 'Save Safety Plan' }));

    expect(onSavePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        thresholdMinor: 1_000_000,
        bankId: 'demo-bank',
        processingConsent: true,
        allySharingConsent: true,
        exportConsent: true,
        retentionMode: 'facts-24h',
      }),
    );
  });

  it('includes an entered ally pairing code when saving', async () => {
    const onSavePlan = vi.fn();
    const user = userEvent.setup();
    render(<PlanScreen role="owner" allyStatus="none" onSavePlan={onSavePlan} />);

    await user.type(screen.getByLabelText('Ally pairing code'), 'abc12345');
    await user.click(screen.getByRole('button', { name: 'Save Safety Plan' }));

    expect(onSavePlan).toHaveBeenCalledWith(expect.objectContaining({ allyPairingCode: 'abc12345' }));
  });
});

describe('PlanScreen · ally view', () => {
  it('lets the ally request a pairing code and shows it with a stable test id', async () => {
    const onRequestPairingCode = vi.fn();
    const user = userEvent.setup();
    render(<PlanScreen role="ally" pairingCode="abc12345" onRequestPairingCode={onRequestPairingCode} />);

    await user.click(screen.getByRole('button', { name: 'Get pairing code' }));
    expect(onRequestPairingCode).toHaveBeenCalled();
    expect(screen.getByTestId('pairing-code')).toHaveTextContent('abc12345');
  });

  it('lets the ally accept an invitation', async () => {
    const onAcceptInvitation = vi.fn();
    const user = userEvent.setup();
    render(<PlanScreen role="ally" onAcceptInvitation={onAcceptInvitation} />);

    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));
    expect(onAcceptInvitation).toHaveBeenCalled();
  });
});
