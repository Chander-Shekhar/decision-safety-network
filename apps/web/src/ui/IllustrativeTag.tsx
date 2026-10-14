/**
 * A light, point-of-use indicator that an action is illustrative — the single
 * replacement (decision 0010) for the old scattered "simulated / prototype"
 * labels. Used only where an action could otherwise be mistaken for a
 * real-world effect (payment, bank, authority/report, caller-ID). The
 * consolidated explanation lives on the "About this demo" screen.
 */
export function IllustrativeTag({ label = 'Illustrative' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-space-1 text-xs font-medium text-text-muted" title="Illustrative — not a real-world action. See About this demo.">
      <span aria-hidden="true">·</span>
      {label}
    </span>
  );
}
