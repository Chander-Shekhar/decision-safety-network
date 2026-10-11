import type { Plan } from '../../../packages/contracts/src/plan';
import { Badge, Button, Card } from './ui';

export interface HomeScreenProps {
  plan: Pick<Plan, 'callListening' | 'bankAccounts' | 'processingConsent'>;
  allyStatus: 'none' | 'invited' | 'ready';
  onStartSession: () => void;
  onEditPlan: () => void;
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

/** The configured landing: what is on, and one dominant way forward. */
export function HomeScreen({ plan, allyStatus, onStartSession, onEditPlan }: HomeScreenProps): React.JSX.Element {
  return (
    <section aria-label="Home">
      <Card
        title="You're protected"
        footer={
          <div className="flex flex-wrap items-center gap-space-3">
            <Button size="lg" onClick={onStartSession}>
              Start a protected session
            </Button>
            <Button variant="ghost" onClick={onEditPlan}>
              Edit Safety Plan
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
            <span className="font-semibold">{ALLY_LABEL[allyStatus]}</span>
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
