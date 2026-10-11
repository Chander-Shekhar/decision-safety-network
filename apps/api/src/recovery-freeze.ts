// DSN-027 guided account protection. GUIDANCE ONLY: this module builds a
// helpline + a case-filled script. It performs, requests, and simulates NO
// freeze, makes no outbound call, and writes nothing.
//
// The helpline number is a fixed curated literal tied to the fictional Demo
// Bank registry. No phone number, callback, or route is ever read from the
// transcript, a caller, or a request body (PRD 7.3/8.2; mirrors
// demo-bank-registry.ts).

import type { GuidedFreeze, PaidPayment, RecoveryKnown } from '../../../packages/contracts/src/recovery.js';
import { DEMO_BANK_REGISTRY } from './demo-bank-registry.js';

/** Fictional, non-routable demo helpline. Not a real bank number. */
const DEMO_BANK_HELPLINE_NUMBER = '1800 000 0000';

export const DEMO_BANK_HELPLINE = {
  institution: 'Demo Bank',
  number: DEMO_BANK_HELPLINE_NUMBER,
  source: 'demo-bank-registry',
  registryVersion: DEMO_BANK_REGISTRY.version,
  simulated: true,
} as const;

function formatRupees(amountMinor: number): string {
  return `Rs ${(amountMinor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface FreezeScriptInput {
  known: RecoveryKnown;
  paidPayment: PaidPayment | null;
  proposed: { payee: string; amountMinor: number } | null;
}

/** Strips control characters and caps length so owner/model text cannot reshape the script. */
function plain(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200);
}

/**
 * Fills the script from the case: the owner-reported paid payment wins, then
 * the proposal, then confirmed facts, and anything missing is said honestly
 * as not known yet.
 */
export function buildGuidedFreeze(input: FreezeScriptInput): GuidedFreeze {
  const { known, paidPayment, proposed } = input;
  const payee = paidPayment?.paidPayee ?? proposed?.payee ?? known.facts.payee;
  const amountMinor = paidPayment?.paidAmountMinor ?? proposed?.amountMinor;
  const lines = [
    'I am calling about a payment I think was a scam.',
    amountMinor !== undefined
      ? `I paid ${formatRupees(amountMinor)}${payee ? ` to ${plain(payee)}` : ''}.`
      : payee
        ? `I paid ${plain(payee)}, but I do not have the exact amount yet.`
        : 'I do not have the payee or amount details in front of me yet.',
  ];
  if (paidPayment?.transactionTime) lines.push(`It happened around ${plain(paidPayment.transactionTime)}.`);
  if (paidPayment?.referenceId) lines.push(`The reference ID is ${plain(paidPayment.referenceId)}.`);
  if (known.facts.centralClaim) lines.push(`The caller claimed: ${plain(known.facts.centralClaim)}.`);
  lines.push(
    'Please put a hold on this one account, review recent activity on it, and block further transfers from it.',
    'Please give me a complaint reference number and tell me what else you need from me.',
  );
  return {
    guided: true,
    realFreeze: false,
    scope: 'affected-account-only',
    helpline: { ...DEMO_BANK_HELPLINE },
    script: lines.join('\n'),
  };
}
