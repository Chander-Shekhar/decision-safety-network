import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllyEvidenceSelector, MAX_ALLY_EVIDENCE } from './AllyEvidenceSelector';
import type { SessionSegmentView } from './SessionScreen';

const segments: SessionSegmentView[] = [
  { id: 's1', order: 0, speaker: 'Caller', text: 'This is the Demo Bank fraud team.' },
  { id: 's2', order: 1, speaker: 'You', text: 'How much?' },
];

/** `count` synthetic segments, used to exceed the server selection cap. */
function manySegments(count: number): SessionSegmentView[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    order: i,
    speaker: i % 2 === 0 ? 'Caller' : 'You',
    text: `line ${i}`,
  }));
}

describe('AllyEvidenceSelector', () => {
  it('lists each segment (speaker + text) with all excerpts selected by default', () => {
    render(
      <AllyEvidenceSelector segments={segments} selectedIds={['s1', 's2']} onToggle={vi.fn()} onPreview={vi.fn()} />,
    );
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => (b as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole('checkbox', { name: /Demo Bank fraud team/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /How much\?/i })).toBeChecked();
  });

  it('reflects a de-selected id as unchecked', () => {
    render(<AllyEvidenceSelector segments={segments} selectedIds={['s2']} onToggle={vi.fn()} onPreview={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Demo Bank fraud team/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /How much\?/i })).toBeChecked();
  });

  it('calls onToggle with the segment id when an excerpt is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <AllyEvidenceSelector segments={segments} selectedIds={['s1', 's2']} onToggle={onToggle} onPreview={vi.fn()} />,
    );
    await user.click(screen.getByRole('checkbox', { name: /Demo Bank fraud team/i }));
    expect(onToggle).toHaveBeenCalledWith('s1');
  });

  it('triggers onPreview when the preview button is clicked with a non-empty selection', async () => {
    const onPreview = vi.fn();
    const user = userEvent.setup();
    render(
      <AllyEvidenceSelector segments={segments} selectedIds={['s1', 's2']} onToggle={vi.fn()} onPreview={onPreview} />,
    );
    const preview = screen.getByRole('button', { name: /preview what my ally would see/i });
    expect(preview).toBeEnabled();
    await user.click(preview);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('disables preview when nothing is selected (the preview API rejects an empty selection)', () => {
    render(<AllyEvidenceSelector segments={segments} selectedIds={[]} onToggle={vi.fn()} onPreview={vi.fn()} />);
    expect(screen.getByRole('button', { name: /preview what my ally would see/i })).toBeDisabled();
  });

  it('shows an empty-state (and no checkboxes, disabled preview) when there are no segments', () => {
    render(<AllyEvidenceSelector segments={[]} selectedIds={[]} onToggle={vi.fn()} onPreview={vi.fn()} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/no transcript excerpts to share yet/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /preview what my ally would see/i })).toBeDisabled();
  });

  it('disables preview and warns when more than the server cap is selected', () => {
    const segs = manySegments(MAX_ALLY_EVIDENCE + 1);
    render(
      <AllyEvidenceSelector segments={segs} selectedIds={segs.map((s) => s.id)} onToggle={vi.fn()} onPreview={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /preview what my ally would see/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      new RegExp(`at most ${MAX_ALLY_EVIDENCE} excerpts`, 'i'),
    );
  });

  it('enables preview at exactly the cap (no off-by-one)', () => {
    const segs = manySegments(MAX_ALLY_EVIDENCE);
    render(
      <AllyEvidenceSelector segments={segs} selectedIds={segs.map((s) => s.id)} onToggle={vi.fn()} onPreview={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /preview what my ally would see/i })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
