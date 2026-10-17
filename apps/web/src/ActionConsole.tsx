import { Button } from './ui';

export interface ActionConsoleProps {
  /** Display name of the owner's Safety Ally, used in the "Ask … for help" path. Defaults to a generic label. */
  allyName?: string;
  /**
   * The officially-sourced, callable contact for the organisation the caller
   * claims to be (DSN-038). When `phoneNumber` is present a single click-to-call
   * button is shown so the owner can reach the real organisation directly; when
   * absent (or the whole prop is absent) the call action is hidden entirely -
   * we never surface a caller-supplied number.
   */
  officialContact?: { organisation: string | null; phoneNumber: string | null } | null;
  /** Opens the DSN-011 ally-sharing preview (no grant side effect here). */
  onAskAlly?: () => void;
  /** The money already went out: move to the recovery / incident phase to build the case. */
  onAlreadyPaid?: () => void;
}

/** One of the help paths: a short title + reassurance + a single large action. */
function ActionPath({
  title,
  body,
  cta,
  variant,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  variant: 'primary' | 'secondary';
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-space-3 rounded-lg border border-border bg-surface-raised p-space-4 shadow-sm">
      <div className="flex flex-col gap-space-1">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-sm text-text-muted">{body}</p>
      </div>
      <Button variant={variant} size="lg" onClick={() => onClick?.()}>
        {cta}
      </Button>
    </div>
  );
}

/**
 * The explainable human action hub (PRD C6/C9; wireframes 03/03b/05, founder
 * demo vision step 5). After the call-driven "slow down & verify" warning on
 * the Review step, this offers the ways forward without deciding alone - ask
 * the ally, call the real organisation, or (if the money already went out)
 * move to building the recovery case. There is no transfer to draft here: DSN
 * never asks the stressed owner to re-enter the caller's demand. Every control
 * is a plain callback; this component never talks to Firestore or the model.
 */
export function ActionConsole({
  allyName = 'your Safety Ally',
  officialContact,
  onAskAlly,
  onAlreadyPaid,
}: ActionConsoleProps): React.JSX.Element {
  return (
    <section aria-label="Action console" className="flex flex-col gap-space-4">
      {/* The ways to get help without deciding alone. */}
      <ActionPath
        title={`Ask ${allyName} for help`}
        body="Share this call with your Safety Ally. They'll reach out so you don't have to handle it alone — take a breather."
        cta="Ask my ally"
        variant="primary"
        onClick={onAskAlly}
      />

      {/* The real action: call the organisation the caller claims to be, on a number
          we sourced (never the caller's). Shown only when a number was found. */}
      {officialContact?.phoneNumber && (
        <a
          href={`tel:${officialContact.phoneNumber}`}
          className="inline-flex w-full items-center justify-center gap-space-2 rounded-md border border-transparent bg-primary px-space-5 py-space-3 text-base font-semibold text-primary-contrast shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
        >
          {officialContact.organisation ? `Call ${officialContact.organisation}` : 'Call the organisation directly'}
        </a>
      )}

      {/* If the money already left, don't dwell on the decision - move straight to recovery. */}
      {onAlreadyPaid && (
        <ActionPath
          title="Already sent the money?"
          body="If the payment already went through, we'll move straight to building your case — ready to share with your bank and the 1930 cyber-cell."
          cta="I already paid"
          variant="secondary"
          onClick={onAlreadyPaid}
        />
      )}
    </section>
  );
}
