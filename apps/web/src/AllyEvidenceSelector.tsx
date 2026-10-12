import type { SessionSegmentView } from './SessionScreen';
import { Button, Callout, Card } from './ui';

/**
 * Max excerpts the ally-share preview accepts in one selection. Mirrors the
 * server cap (`apps/api/src/ally.ts` MAX_SELECTED_EVIDENCE / `ally-routes.ts`
 * SelectionSchema `.max(10)`); kept in sync by hand since the contract package
 * does not export it. Over this, the preview endpoint rejects the body, so we
 * gate the button here rather than let the owner dead-end on a 400.
 */
export const MAX_ALLY_EVIDENCE = 10;

export interface AllyEvidenceSelectorProps {
  /** The current transcript segments the owner can choose from. */
  segments: SessionSegmentView[];
  /** Ids currently selected for sharing (default: all segments). */
  selectedIds: string[];
  /** Flip a single segment in/out of the selection. */
  onToggle: (id: string) => void;
  /** Promote the selected segments and open the owner-only preview. */
  onPreview: () => void;
}

const CHOICE_CLASS = 'flex items-start gap-space-2 text-text';

/**
 * Owner-side evidence picker for the Ally step. The owner chooses which
 * transcript excerpts the ally may see; only the selected excerpts (plus the
 * allowlisted case summary) are ever shared — never the full transcript. All
 * segments start selected; preview is disabled when nothing is selected
 * (the preview API rejects an empty selection). Presentational only — App owns
 * the selection state, the promote calls, and the preview request.
 */
export function AllyEvidenceSelector({ segments, selectedIds, onToggle, onPreview }: AllyEvidenceSelectorProps): React.JSX.Element {
  const selected = new Set(selectedIds);
  const overCap = selected.size > MAX_ALLY_EVIDENCE;
  return (
    <Card title="Choose what your ally sees">
      {segments.length === 0 ? (
        <p className="text-sm text-text-muted">
          There are no transcript excerpts to share yet. Add the call transcript on the Session step first.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            Pick the transcript excerpts to include. Only the selected excerpts (plus the case summary) are shared — never the full transcript.
          </p>
          <ul className="flex flex-col gap-space-2" aria-label="Transcript excerpts to share">
            {segments.map((segment) => (
              <li key={segment.id}>
                <label className={CHOICE_CLASS}>
                  <input type="checkbox" checked={selected.has(segment.id)} onChange={() => onToggle(segment.id)} />
                  <span>
                    <span className="font-medium">{segment.speaker}: </span>
                    {segment.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {overCap && (
        <Callout kind="caution" role="alert">
          Choose at most {MAX_ALLY_EVIDENCE} excerpts to share ({selected.size} selected). Deselect {selected.size - MAX_ALLY_EVIDENCE} to preview.
        </Callout>
      )}
      <div>
        <Button disabled={selected.size === 0 || overCap} onClick={onPreview}>
          Preview what my ally would see
        </Button>
      </div>
    </Card>
  );
}
