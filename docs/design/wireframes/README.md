# Core MVP UI wireframes

**Status:** Draft for founder review · 2 October 2026. These are implementation guides, not approved brand designs or working product screens. The locked [PRD](../../../Decision_Safety_Network_PRD_Draft.md), Part I, remains authoritative if a sketch differs.

## Intent

Help a person under live pressure make one safer consequential decision, then reuse the same case if harm has already occurred. The main screen should answer three questions in order: **What action is pending? Why should I slow down? What can I do now?** It must not resemble a scam-score dashboard or a chatbot that leaves the user to work out the next step.

I considered a dense case dashboard, a chat-first assistant, and a focused case flow. The focused flow is the draft direction: a quiet live case while evidence develops, a deliberately prominent action view only when conversation and payment converge, then a completed verification/resolution or a first-hour recovery view. This reduces decision load and makes the product's cross-context value visible in the three-minute Cup demo. Desktop can show source context alongside the action; narrow screens stack it below the primary action without hiding correction or Continue.

## Storyboard

| Frame | User-visible moment | Core capability |
| --- | --- | --- |
| [01 · Prepared Safety Plan](01-plan.svg) | Policy, Demo Bank route, accepted ally, four independent choices, honest retention default | C1, C12 |
| [02 · Quiet live case + proposed payment](02-live-case.svg) | Controlled transcript, live processing, cited facts, correction, simulated new payee and amount; no enhanced Pause from words alone | C2–C4 |
| [03 · Decisive action and safe fallback](03-decision-states.svg) | Pending pre-OTP transfer, ≤3 cited reasons, explicit actions; Check/degraded variants retain manual controls | C5–C6, C12 |
| [03b · Human choice and case-specific sharing](03b-human-choice.svg) | Continue requires an unselected consequence acknowledgment; the owner previews exactly what an ally would receive before granting this case access | C5–C6, C8 |
| [04 · Independent verification + ally](04-verify-ally.svg) | Registry-derived Demo Bank result and separate minimal ally view; no caller-supplied route or ally fund control | C7–C8 |
| [05 · Completed prevention + legitimate control](05-resolution-control.svg) | Simulated claim rejected and transfer cancelled; comparison case gets ordinary confirmation, not enhanced Pause | C9, causal matrix |
| [06 · Same-case recovery + evidence](06-recovery-evidence.svg) | Reused confirmed facts, equal-priority Demo Bank/1930 actions, unknowns blank, reviewable handoff | C10–C12 |

The frames are deliberately *not* a separate implementation plan. Component ownership, data/API contracts, tests, and release gates remain in the Core MVP implementation plan. No screen introduces a new bank integration, real payment action, automated report, risk percentage, mental-state judgment, or stretch feature.

The recovery field preview uses the [current NCRP complainant checklist](https://www.cybercrime.gov.in/webform/Crime_AuthoLogin.aspx) as its source (reviewed 2 October 2026). The older financial-fraud [citizen instructions](https://cybercrime.gov.in/uploadmedia/instructions_citizenreportingcyberfrauds.pdf) support the 1930 route; a real implementation must recheck the live official source before claiming fields or deadlines are current.

## Reusable interaction rules

- **Visible boundary:** Keep `Controlled transcript` on session input and `Simulated` on payment, bank response, and local acknowledgements. The real 1930 number is source-dated and is **not** a simulated number; only the prototype's acknowledgement of a user action is simulated. Demo Bank is clearly fictional and has no real-bank branding.
- **Quiet until consequence:** Observe/Check show a compact verification suggestion and evolving facts. The enhanced action view is reserved for a valid current-draft conversation/payment match. A submitted transfer is pending until a person acts; no timeout or model outage completes it.
- **Action before analysis:** At Pause, use `Before you enter an OTP` copy, at most three cited reasons, a one-tap simulated Pause/Cancel, Verify Officially, Ask My Ally, and an honest Continue path with a separate, initially unselected consequence acknowledgment. In Check or degraded states, Continue is still a deliberate human action but uses ordinary confirmation or acknowledges uncertainty; it does not claim a risk finding. `I already paid` remains reachable from every relevant phase, including Resolve.
- **Provenance is not truth:** `Caller claimed`, `Source excerpt`, `User corrected`, `Unknown`, and `Source not retained` are different states. Confirming a transcript fact means the user confirms what was said or entered, not that the caller or claim is genuine. A Demo Bank registry result has its own method, time, version, and persistent simulation status.
- **Minimum sharing:** Before an ally sees a case, the owner previews the exact minimum packet and grants access to this case, separately from the earlier ally invitation. The ally view displays only claim, proposed action, amount, verification gap, and selected evidence. It does not default to the full transcript and cannot approve a transfer or certify the caller.
- **Recovery is a case transition:** Use the same case ID and only available user-confirmed facts. A proposed or cancelled payment is *not* proof of an actual payment: ask the user whether paid details match the proposal, permit one-tap confirmation or correction, and leave unknown transaction fields blank. Place the fictional simulated Demo Bank route and the real, source-linked 1930 route first with equal visual weight; then show missing fields, a recovery-scam warning, evidence timeline, and an export that says `field-aligned preview—not submitted or accepted`.
- **Failure remains actionable:** While inference is pending or unavailable, say so plainly and retain manual Pause, Verify, official contact, and recovery. Never manufacture a positive finding to fill the delay.

## Responsive and accessibility guidance

Use a responsive web layout. At wide widths, place the live transcript and sourced Decision Map next to the payment/action surface; do not make the pressured user scan a dashboard of metrics. At narrow widths, show the pending-decision status, no more than three short cited reasons, and the primary action in one uninterrupted reading path, with the other actions immediately below; source details can expand without hiding correction. On recovery, the Demo Bank and 1930 actions become equal-size stacked cards rather than one visually subordinate link. The mobile decision example is ~440 px wide; exact breakpoints, palette, typography, iconography, product name, and logo are still open.

All actionable controls need clear text labels, visible focus, keyboard operation, screen-reader names, adequate contrast, and large touch targets. No color alone carries a state. These SVGs do not themselves prove accessibility; the working UI must pass the PRD's keyboard, screen-reader, and 200% text-scaling checks.

## What to review

1. Is the action hierarchy right at the pre-OTP moment, especially the balance between Pause, Verify, Ally, and fair Continue with its explicit acknowledgment?
2. Does the live screen make the joined conversation/payment insight visible without implying that suspicious words alone block a transfer?
3. Does the recovery screen feel immediately usable under stress, distinguish proposed from actually paid details, and visibly reuse the same case rather than starting a new workflow?

Once reviewed, implement the approved hierarchy and copy in the existing frontend tasks. Treat spacing and illustrative neutral colors as provisional; do not copy an SVG as production markup.
