import { Card } from './ui';

/**
 * The single consolidated honesty disclosure (decision 0010). This replaces the
 * scattered "simulated / prototype / synthetic" caveats that used to sit on
 * every screen; individual actions carry only a light `illustrative` tag that
 * points back here.
 */
export function AboutScreen(): React.JSX.Element {
  return (
    <section aria-label="About this demo">
      <Card title="About this demo">
        <p>
          Second Voice helps someone under pressure on a call slow down and make one safer decision — and,
          if money has already moved, build the case to recover it.
        </p>
        <p className="font-semibold">What is real, and what is illustrative</p>
        <ul className="flex list-disc flex-col gap-space-2 pl-space-5 text-text">
          <li>The live decision flow, fact extraction, verification logic, ally sharing, and evidence packet are real and working.</li>
          <li>
            Some integrations are illustrative rather than live: the bank connection and account freeze, caller-ID
            lookup, and the 1930 / cybercrime report channel. Where an action is illustrative, it is tagged at the
            point of use.
          </li>
          <li>No real bank, authority, or person is contacted, and nothing moves real money.</li>
          <li>All names, numbers, and accounts shown are sample data, not real people or records.</li>
        </ul>
        <p className="text-sm text-text-muted">
          This is a forward-looking demo: it shows the full intended experience so the value is clear end to end.
        </p>
      </Card>
    </section>
  );
}
