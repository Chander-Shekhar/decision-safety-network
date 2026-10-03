import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceScreen } from './EvidenceScreen';

// Local display fixtures - this screen's props are its own presentational
// shape, never an import of apps/api's internal retention/evidence types
// (mirrors VerifyPanel.tsx/PaymentPanel.tsx's own locally-mirrored props).
const singleConfirmedFactTimeline = [
  { kind: 'confirmed-fact' as const, label: 'claim', value: 'source not retained' },
];

const mixedTimeline = [
  { kind: 'selected-excerpt' as const, label: 'Caller excerpt', value: 'Pay the new account now' },
  { kind: 'correction' as const, label: 'payee', value: 'corrected-safe-payee', correctedFrom: 'Pay the new account now' },
];

describe('EvidenceScreen (literal plan Task 11 snippet)', () => {
  it('shows the retained provenance label, the not-submitted-or-accepted framing, and a disabled export button when export is not allowed', () => {
    render(
      <EvidenceScreen
        timeline={singleConfirmedFactTimeline}
        exportAllowed={false}
        retentionMode="facts-24h"
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText(/source not retained/i)).toBeVisible();
    expect(screen.getByText(/not submitted or accepted/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /download evidence/i })).toBeDisabled();
  });
});

describe('EvidenceScreen export trigger', () => {
  it('calls onExport when enabled and clicked', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();
    render(<EvidenceScreen timeline={singleConfirmedFactTimeline} exportAllowed retentionMode="facts-24h" onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /download evidence/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('never calls onExport while the button is disabled', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();
    render(<EvidenceScreen timeline={singleConfirmedFactTimeline} exportAllowed={false} retentionMode="facts-24h" onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: /download evidence/i }));
    expect(onExport).not.toHaveBeenCalled();
  });
});

describe('EvidenceScreen retention-mode presentation', () => {
  it('warns there is no re-entry recovery path once delete-on-close has run', () => {
    render(<EvidenceScreen timeline={[]} exportAllowed={false} retentionMode="delete-on-close" />);
    expect(screen.getByText(/no re-entry recovery/i)).toBeVisible();
  });

  it('shows distinct labels for each of the three retention modes', () => {
    const { rerender } = render(<EvidenceScreen timeline={[]} exportAllowed={false} retentionMode="delete-on-close" />);
    const deleteLabel = screen.getByText(/delete on close/i).textContent;

    rerender(<EvidenceScreen timeline={[]} exportAllowed={false} retentionMode="facts-24h" />);
    const factsLabel = screen.getByText(/24 hour/i).textContent;

    rerender(<EvidenceScreen timeline={[]} exportAllowed={false} retentionMode="selected-7d" />);
    const selectedLabel = screen.getByText(/7 day|selected excerpt/i).textContent;

    expect(new Set([deleteLabel, factsLabel, selectedLabel]).size).toBe(3);
  });

  it('does not show the delete-on-close recovery warning under facts-24h or selected-7d', () => {
    render(<EvidenceScreen timeline={[]} exportAllowed={false} retentionMode="facts-24h" />);
    expect(screen.queryByText(/no re-entry recovery/i)).toBeNull();
  });
});

describe('EvidenceScreen timeline rendering', () => {
  it('renders multiple timeline entries in order, including a correction-preserving pair', () => {
    render(<EvidenceScreen timeline={mixedTimeline} exportAllowed={false} retentionMode="selected-7d" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toMatch(/Pay the new account now/);
    expect(items[1]?.textContent).toMatch(/corrected-safe-payee/);
    expect(items[1]?.textContent).toMatch(/Pay the new account now/);
  });
});

describe('EvidenceScreen safety constraints', () => {
  it('never shows a scam-probability or mental-state label', () => {
    render(<EvidenceScreen timeline={mixedTimeline} exportAllowed retentionMode="selected-7d" />);
    expect(screen.queryByText(/probability/i)).toBeNull();
    expect(screen.queryByText(/mental state/i)).toBeNull();
    expect(screen.queryByText(/vulnerable/i)).toBeNull();
  });

  it('persistently labels the surface Simulated', () => {
    render(<EvidenceScreen timeline={mixedTimeline} exportAllowed retentionMode="selected-7d" />);
    expect(screen.getAllByText(/simulated/i).length).toBeGreaterThanOrEqual(1);
  });
});
