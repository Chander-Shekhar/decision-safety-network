import type { Plan } from '../../../packages/contracts/src/plan';
import { Badge, Button, Card } from './ui';

export interface HomeScreenProps {
  /** First launch: nothing configured yet. Shows a welcome + a path into Settings. */
  firstRun?: boolean;
  /** Configured plan summary. Omitted on first run. */
  plan?: Pick<Plan, 'callListening' | 'bankAccounts' | 'processingConsent'>;
  allyStatus: 'none' | 'invited' | 'ready';
  /** The "ready" ally is the pre-added sample, not a real paired helper. */
  allyIsSample?: boolean;
  onStartSession: () => void;
  /** Opens Settings (first-run setup and later edits both live there). */
  onOpenSettings: () => void;
  /** Opens the pre-pickup screening screen (DSN-024). */
  onIncomingCall?: () => void;
}

const LISTENING_LABEL: Record<Plan['callListening'], string> = {
  'all-calls': 'Listening on all calls',
  'unverified-only': 'Listening on unverified numbers only',
  'per-call': 'You decide per call at pickup',
};

const ALLY_LABEL: Record<HomeScreenProps['allyStatus'], string> = {
  none: 'No ally paired yet',
  invited: 'Ally nominated, awaiting acceptance',
  ready: 'Ally ready',
};

/** The landing screen: a welcome on first run, otherwise what is on and one dominant way forward. */
export function HomeScreen({ firstRun, plan, allyStatus, allyIsSample, onStartSession, onOpenSettings, onIncomingCall }: HomeScreenProps): React.JSX.Element {
  if (firstRun || !plan) {
    return (
      <section aria-label="Home">
        <Card
          title="Welcome to Decision Safety Network"
          footer={
            <Button size="lg" onClick={onOpenSettings}>
              Go to Settings to set up
            </Button>
          }
        >
          <p>
            This looks like your first time here. A quick setup — when to listen on calls, who your Safety Ally is, and
            which accounts to protect — gets you ready in under a minute.
          </p>
          <p className="text-text-muted">
            Everything lives in <strong>Settings</strong>, reachable any time from the menu.
          </p>
        </Card>
      </section>
    );
  }
  return (
    <section aria-label="Home">
      <Card
        title="You're protected"
        footer={
          <div className="flex flex-wrap items-center gap-space-3">
            <Button size="lg" onClick={onStartSession}>
              Start a protected session
            </Button>
            {onIncomingCall && (
              <Button variant="secondary" onClick={onIncomingCall}>
                Try an incoming call
              </Button>
            )}
            <Button variant="ghost" onClick={onOpenSettings}>
              Edit settings
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-space-3">
          <li className="flex flex-col">
            <span className="text-sm text-text-muted">Call listening</span>
            <span className="font-semibold">{LISTENING_LABEL[plan.callListening]}</span>
            {!plan.processingConsent && (
              <span className="text-sm text-text-muted">Transcript processing is off until you allow it in your Safety Plan.</span>
            )}
          </li>
          <li className="flex flex-col">
            <span className="text-sm text-text-muted">Safety Ally</span>
            <span className="font-semibold">
              {ALLY_LABEL[allyStatus]}
              {allyStatus === 'ready' && allyIsSample && ' (sample)'}
            </span>
          </li>
          <li className="flex flex-col gap-space-1">
            <span className="text-sm text-text-muted">Accounts registered for guided protection</span>
            <span className="flex flex-wrap gap-space-2">
              {plan.bankAccounts.map((account) => (
                <Badge key={account.id} tone="info">
                  {account.label} &middot; {account.last4}
                </Badge>
              ))}
            </span>
          </li>
        </ul>
      </Card>
    </section>
  );
}
