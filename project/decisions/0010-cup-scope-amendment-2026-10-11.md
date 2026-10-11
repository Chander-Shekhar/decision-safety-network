# 0010: Cup scope amendment — demonstrated capability over defensive minimalism

- **Status:** Accepted
- **Date:** 2026-10-11
- **Owners:** Founder (Chander Shekhar); recorded by orchestrator
- **Related task:** DSN-022
- **PRD references:** Part I — Decisions 15–20; Fixed scope; What is live/controlled/simulated; C2, C7, C8, C10, C11, C13; Stretch S7, S10; Explicit Cup non-goals; Responsibility boundary; Trust/safety gates; Prototype components
- **Supersedes:** None (amends the locked PRD under explicit founder authorization)
- **Superseded by:** None

## Context

The locked PRD scoped the Cup build defensively — controlled transcript only, no call capture, no caller-ID, no identifier list, preview-only reporting, caveats on every surface — to survive the feasibility/trust judging dimensions. On 2026-10-11 the founder judged this under-sells the product's capability and impact in the demo, and that the honest framing can be preserved while demonstrating the real experience. The founder narrative is captured in `docs/founder-demo-vision.md`. The PRD is locked, so these changes require explicit founder authorization, which was given.

## Decision

Amend Part I with founder decisions 15–20 and the matched edits across scope, feature, non-goal, boundary, gate, and component sections:

1. **Call capture** demonstrated as a labeled prototype path (OEM/accessibility/dialer-integrated on a controlled device); controlled transcript retained as a reproducible evaluation fallback.
2. **Private confirmed-fraud list** (C13), populated only on user confirmation or authority report; warns future recipients before pickup; never public, never criminal attribution.
3. **Guided account protection** — helpline + what-to-say script for the affected account; never a real freeze.
4. **User-submitted, pre-filled** 1930/NCRP report; never unattended submission.
5. **Third-party caller-ID + grounded open-web claim verification** as labeled, untrusted supporting evidence; never the official route, never self-certifying.
6. **Safety Ally** reachable via WhatsApp and able to contact the caller on the user's behalf; still cannot control funds or certify the caller.
7. **Case record + metrics/intelligence dashboard** (stretch S10), with impact claims bounded to recorded evidence.

Load-bearing honesty is explicitly preserved: no real freeze, no unattended submission, no public blacklist, labeled untrusted evidence, and clearly labeled prototype capture.

## Consequences

- **Positive:** the demo shows the full lived experience (screening → live call → verification → ally/recovery → report) rather than a minimized slice; stronger Problem-Alignment/Impact and Innovation narrative.
- **Cost / follow-up:** new implementation surface (DSN-023..029); the Trust/simulation gate now depends on *one consolidated* honest disclosure plus two load-bearing screen-local labels rather than pervasive caveats — the UI must get this right (DSN-022). The "ally contacts the caller" and "live call capture" additions widen the security/consent and feasibility review surface.
- Call capture is **not** store-distributable on stock iOS/Android; it must be labeled a prototype path or judges may read it as an overclaim.

## Alternatives considered

### Keep the locked defensive scope

Rejected by the founder: it is honest but under-represents the product and reads as a warning card plus caveats, which is the exact "looks like a detector" risk the PRD itself warns against.

## Verification

- `Decision_Safety_Network_PRD_Draft.md` reflects decisions 15–20 and all matched edits (applied 2026-10-11).
- Each downstream task (DSN-023..029) carries acceptance checks that preserve the load-bearing honesty constraints above.
- DSN-022 verifies the consolidated-disclosure UI against the PRD Trust/simulation gate and the wireframe "Provenance is not truth" and equal-weight-recovery rules.
