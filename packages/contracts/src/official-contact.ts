// Officially-sourced, callable contact for the organisation a caller claims to
// represent (DSN-038, Decide step). This is DELIBERATELY different from
// `web-verification.ts`: that produces labelled, UNTRUSTED supporting evidence
// and never an actionable route; this produces the one thing the owner can act
// on - a phone number they can call to reach the organisation DIRECTLY and
// verify the call independently, instead of trusting a number the caller gave.
//
// Sourcing (founder-authorised, decision 0021 - a scoped override of PRD C7's
// "web verification is never an authoritative route"):
//  - `demo-registry`  : the fictional Demo Bank's curated, hardcoded number.
//  - `web-search`      : an open LLM web search for a real organisation's own
//                        official public contact number.
//
// `phoneNumber` is null when no official number was found; the UI shows the
// call action ONLY when it is non-null (never a caller-supplied number).

export interface OfficialContact {
  /** The organisation name, for the call button's label; null when unknown. */
  organisation: string | null;
  /** A dialable number (digits, optional leading `+`), or null when none was found. */
  phoneNumber: string | null;
  /** How the number was sourced. */
  source: 'demo-registry' | 'web-search';
}
