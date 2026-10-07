import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyPanel } from './VerifyPanel';

// A local fixture mirroring the real `apps/api/src/demo-bank-registry.ts`
// `DEMO_BANK_REGISTRY` field-for-field, not an import of it - this panel's
// props are its own locally-defined display shape (mirrors
// `PaymentPanel.tsx`'s own `PaymentPanelDraft`/`ActionConsole.tsx`'s
// `ActionConsoleCaseState`: a presentational component never imports a
// server-side feature module's internal types across the apps/api | apps/web
// boundary).
const registry = {
  id: 'demo-bank',
  version: 'cup-1',
  fictional: true as const,
  routeLabel: 'Demo Bank verification (simulated)',
  source: 'local fictional registry',
  reviewedAt: '2026-10-02',
};

const result = {
  bankId: 'demo-bank',
  registryVersion: 'cup-1',
  method: 'versioned-demo-registry',
  checkedAt: '2026-10-03T12:00:00.000Z',
  outboundFraudCall: false,
  protectedTransferRequested: false,
  simulated: true as const,
};

describe('VerifyPanel', () => {
  it('shows the versioned fictional registry provenance before any result, never a real-bank claim', () => {
    render(<VerifyPanel registry={registry} />);
    expect(screen.getByText(/fictional demo bank/i)).toBeVisible();
    expect(screen.getByText(/cup-1/i)).toBeVisible();
    expect(screen.getByText(/caller-provided phone numbers are never used/i)).toBeVisible();
  });

  it('persistently labels the surface Simulated before a result exists', () => {
    render(<VerifyPanel registry={registry} />);
    expect(screen.getAllByText(/simulated/i).length).toBeGreaterThanOrEqual(1);
  });

  it('offers only the registry route - no free-text contact field of any kind', () => {
    render(<VerifyPanel registry={registry} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText(/phone|number|callback|url/i)).toBeNull();
  });

  it('lets the owner trigger verification against the registry', async () => {
    const onVerify = vi.fn();
    const user = userEvent.setup();
    render(<VerifyPanel registry={registry} onVerify={onVerify} />);

    await user.click(screen.getByRole('button', { name: /verify with demo bank/i }));
    expect(onVerify).toHaveBeenCalled();
  });

  it('disables the verify trigger when the phase gate blocks verification (no silent click)', () => {
    render(<VerifyPanel registry={registry} disabled />);
    expect(screen.getByRole('button', { name: /verify with demo bank/i })).toBeDisabled();
  });

  it('fires no verification when disabled, so the blocked Observe phase never reaches the POST path', async () => {
    const onVerify = vi.fn();
    const user = userEvent.setup();
    render(<VerifyPanel registry={registry} disabled onVerify={onVerify} />);

    await user.click(screen.getByRole('button', { name: /verify with demo bank/i }));
    expect(onVerify).not.toHaveBeenCalled();
  });

  it('hides the verify trigger once a result is already recorded (one-shot workflow)', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.queryByRole('button', { name: /verify with demo bank/i })).toBeNull();
  });

  it('shows the completed result with provenance and persistent Simulated labeling at least twice', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.getAllByText(/Simulated/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/no outbound fraud call/i)).toBeVisible();
    expect(screen.queryByText('9999999999')).toBeNull();
  });

  it('shows the claim-not-supported outcome and registry provenance on the completed result', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.getByText(/claim not supported/i)).toBeVisible();
    expect(screen.getByText(/versioned-demo-registry/i)).toBeVisible();
    expect(screen.getAllByText(/cup-1/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows that no protected-account transfer was requested in the simulation', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.getByText(/no protected-account transfer/i)).toBeVisible();
  });

  it('offers Cancel for the simulated transfer once a result is recorded', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<VerifyPanel registry={registry} result={result} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('never renders a Defer control, since there is no backend action to back it', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.queryByRole('button', { name: /defer/i })).toBeNull();
  });

  it('frames Cancel as ending the simulated transfer, cancelled not just hidden', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.getByText(/cancelled, not just hidden/i)).toBeVisible();
  });

  it('never renders a caller-supplied contact value, since there is no such prop at all', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.queryByText(/9999999999|\+1-?800|callback number/i)).toBeNull();
  });

  it('never shows a scam probability or mental-state label', () => {
    render(<VerifyPanel registry={registry} result={result} />);
    expect(screen.queryByText(/scam probability|risk score|likely (a )?scam|mental state/i)).toBeNull();
  });
});
