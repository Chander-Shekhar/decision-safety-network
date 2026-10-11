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
    expect(screen.getByText(/draft for your review.*not submitted/i)).toBeVisible();
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

  it('drops the per-panel Simulated badge but keeps the not-submitted label', () => {
    render(<EvidenceScreen timeline={mixedTimeline} exportAllowed retentionMode="selected-7d" />);
    expect(screen.queryByText(/simulated/i)).toBeNull();
    expect(screen.getByText(/not submitted/i)).toBeVisible();
  });
});

const reportDraft = {
  label: 'Draft for your review — not submitted',
  sourceDate: '2026-10-02',
  fields: [
    { ncrpField: "Caller's claimed identity", value: 'Bank fraud desk', blank: false, provenanceLabel: 'source not retained' },
    { ncrpField: 'Complainant name', value: '', blank: true, provenanceLabel: '' },
  ],
  recoveryScamWarning: 'Beware of recovery scams: do not trust anyone offering to recover your money.',
  channelLabel: 'Simulated official 1930/NCRP channel',
};

describe('EvidenceScreen pre-filled report (DSN-028)', () => {
  it('shows a source-dated, not-submitted draft with confirmed values, blanks marked, provenance, and the recovery-scam warning', () => {
    render(<EvidenceScreen timeline={[]} exportAllowed retentionMode="facts-24h" reportDraft={reportDraft} onOpenOfficialChannel={vi.fn()} />);

    expect(screen.getByText('Bank fraud desk')).toBeVisible();
    expect(screen.getByText(/source not retained/i)).toBeVisible();
    expect(screen.getByText(/2026-10-02/)).toBeVisible();
    expect(screen.getByText('(left blank)')).toBeVisible();
    expect(screen.getByRole('alert', { name: /recovery scam/i })).toBeVisible();
    expect(screen.getByText(/draft for your review.*not submitted/i)).toBeVisible();
    expect(screen.queryByText(/\b(filed|accepted)\b/i)).toBeNull();
  });

  it('does nothing until the user clicks, then hands off with the typed caller number; wording never claims filed/accepted', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<EvidenceScreen timeline={[]} exportAllowed retentionMode="facts-24h" reportDraft={reportDraft} onOpenOfficialChannel={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/caller.s number/i), '+91 98765 43210');
    await user.click(screen.getByRole('button', { name: /open official channel/i }));
    expect(onOpen).toHaveBeenCalledWith('+91 98765 43210');

    rerender(<EvidenceScreen timeline={[]} exportAllowed retentionMode="facts-24h" reportDraft={reportDraft} onOpenOfficialChannel={onOpen} handedOff />);
    expect(screen.getByText(/you opened the official channel/i)).toBeVisible();
    expect(screen.getByText(/has not filed/i)).toBeVisible();
    expect(screen.queryByText(/draft for your review.*not submitted/i)).toBeNull();
    expect(screen.queryByText(/report (was|has been) (filed|submitted|accepted)/i)).toBeNull();
  });

  it('omits a blank caller number, offers download only on click, and disables handoff when not allowed', async () => {
    const onOpen = vi.fn();
    const onDownload = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<EvidenceScreen timeline={[]} exportAllowed retentionMode="facts-24h" reportDraft={reportDraft} onOpenOfficialChannel={onOpen} onDownloadReportDraft={onDownload} />);
    expect(onDownload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /download pre-filled form/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /open official channel/i }));
    expect(onOpen).toHaveBeenCalledWith(undefined);

    rerender(<EvidenceScreen timeline={[]} exportAllowed retentionMode="facts-24h" reportDraft={reportDraft} onOpenOfficialChannel={onOpen} handoffAllowed={false} />);
    expect(screen.getByRole('button', { name: /open official channel/i })).toBeDisabled();
  });
});
