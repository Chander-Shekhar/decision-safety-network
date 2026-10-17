# 0016: Owner ally-share preview promotes the selected excerpts

- **Status:** Accepted
- **Date:** 2026-10-12
- **Owners:** Orchestrator (DSN-033)
- **Related task:** DSN-033
- **PRD references:** Part I — Safety Ally / ally reach; the ally packet is an owner-approved allowlist (claim, proposed action, amount, verification gap, selected excerpts), never the raw transcript.
- **Supersedes:** None
- **Superseded by:** None

## Context

The owner-side "Preview what my ally would see" step calls `POST cases/:id/ally-share-preview`, which (`apps/api/src/ally.ts` `previewAllyPacket` → `buildAllowlistedPacket` → `readSelectedEvidence`) resolves each selected id against the case's `evidence` subcollection and throws `UNKNOWN_EVIDENCE` for any id not yet promoted. The web client never promoted transcript segments, so the preview was unreachable (always 400). DSN-033 had to wire the client to promote the owner's selected segments before previewing. The question this records: *when* should promotion happen — on preview, or deferred to the Share grant.

The API has no "preview from un-promoted segments" mode and a batched promote endpoint is out of scope for the demo, so promotion must happen client-side via the existing idempotent `POST cases/:id/evidence/:segmentId/promote` route. The only real choice is its timing.

## Decision

The preview handler promotes exactly the owner-selected segments (idempotent, per segment) immediately before requesting the preview, and the Share grant binds to the previewed `selectedEvidenceIds` / `caseVersion` / `packetHash` snapshot. Selection is capped client-side at `MAX_ALLY_EVIDENCE = 10` (mirroring the server `SelectionSchema.max(10)` / `MAX_SELECTED_EVIDENCE`): the Preview button is disabled with a caution callout over the cap, and the handler guards the cap before promoting so an over-cap request never persists evidence it knows the endpoint will reject.

## Consequences

- Positive: the preview works end to end with no API change; the Share path keeps its existing version+hash re-validation (`createAllyGrant` → `STALE_PREVIEW`), so a selection change after preview cannot silently grant a stale packet.
- Positive: the raw transcript is still never shared — only the allowlisted packet plus the owner-chosen excerpts.
- Limitation (retention coupling): because promotion happens on **preview**, excerpts the owner previews but never shares — or deselects and re-previews — are persisted into the `evidence` subcollection and retained under the `selected-7d` policy for 7 days, despite no grant ever existing. This is the owner's own case data, authorized by the owner, and `readSelectedEvidence` only ever returns ids explicitly requested per grant, so a lingering promoted doc is never silently disclosed. It nonetheless slightly contradicts the "preview creates nothing" framing in `ally.ts`'s doc comment. Accepted for the demo; revisit only if a preview-without-persistence API mode becomes warranted.

## Alternatives considered

### Promote on Share (grant) instead of on preview

Would keep "preview creates nothing" literally true. Rejected: the preview endpoint itself resolves the packet from promoted evidence, so without promotion the preview cannot render at all. Deferring promotion to Share would require a new API mode (build the packet from un-promoted segments) — an API change explicitly excluded from DSN-033.

### Batch promote endpoint

A single `POST .../evidence/promote` accepting many ids. Rejected as out of scope: per-segment idempotent promote is adequate for the demo's small segment counts, and adding an endpoint is an API change.

## Addendum (2026-10-15, DSN-038): auto-generate the summary; don't make a stressed owner triage excerpts

Founder feedback: asking a person mid-scam to hand-pick which transcript excerpts to share is the wrong moment for that work — "a summary should have been generated and shown in preview." The promotion/preview/grant mechanics above are unchanged; only the owner-facing interaction changed:

- Landing on the Ally step (including via the Action console's "Ask my ally") now **auto-generates** the preview: a sensible default selection (all current excerpts, capped at `MAX_ALLY_EVIDENCE`) is promoted and summarised automatically, and the resulting allowlisted packet (claim, proposed action, amount, verification gap, selected excerpts) renders **inline** — not behind a checkbox step the owner must complete first.
- The owner still consents deliberately by pressing **Share** (PRD C8 / "full transcript private unless the user deliberately shares it" is preserved — the preview shows exactly what will be sent, and nothing is granted until Share binds to the previewed version+hash).
- The excerpt picker (`AllyEvidenceSelector`) is retained but demoted to an optional "Adjust which excerpts your ally sees" disclosure that re-runs the same generation. The ≤10 cap and server re-validation are unchanged.
- The inline rendering also removes the modal preview for this flow, which fixed a freeze: the `ui/Dialog` content had no height bound, so a tall packet overflowed off-screen while Radix locked body scroll, leaving the whole app unresponsive. `ui/Dialog` additionally gained `max-h-[85vh] overflow-y-auto` as a defensive fix for any future modal.

## Verification

- `apps/web/e2e/journey.spec.ts` attack journey drives Ask my ally → preview and asserts the allowlisted packet renders (claim under "Caller claimed", "Verification gap") and that the full transcript is not included — green across desktop + mobile-440.
- `apps/web/src/AllyEvidenceSelector.test.tsx` covers default-all-selected, toggle, empty-state, disabled-when-empty, over-cap disabled + warning, and enabled exactly at the cap.
- Server behavior unchanged (`apps/api/test/ally.test.ts`); no API or contract edit in this task.

## Addendum (2026-10-17, DSN-038): the packet carries an AI summary, not transcript excerpts

Founder feedback testing the live two-session flow: sending verbatim transcript excerpts to the ally is unnecessary (and hit the ≤10-selection error); the ally only needs the gist and can reach the owner for detail. This **supersedes** the "promote + selected evidence" model above for the packet contents (the promotion/preview/grant *lifecycle* — owner-only preview, deliberate Share, version+hash binding, re-validation on every read, revoke-purges-snapshot — is unchanged).

- **Contract:** `AllyPacketContent.selectedEvidence[]` is replaced by `summary: string`; `AllyPacketEvidence` and `AllyGrant.selectedEvidenceIds` are removed; `ALLY_PACKET_KEYS` swaps `selectedEvidence`→`summary`; `plan.ts` `ALLY_SHARE_FIELDS`/defaults swap likewise (summary is shared by default). No transcript or recording is ever in the packet.
- **Summary source:** composed server-side in `buildAllowlistedPacket` from the already AI-extracted facts (claimed identity, central claim, requested action, amount, observed tactics) — deterministic, so the packet hash stays stable until the underlying facts change. No second model round-trip; the fake-Gemini path produces a summary too.
- **Preview/grant:** `ally-share-preview` takes no body; `ally-grant` drops `selectedEvidenceIds`; the ≤10 selection cap, `normalizeSelection`, `UNKNOWN_EVIDENCE`/`INVALID_SELECTION` errors, and the `AllyEvidenceSelector` picker + its "Adjust which excerpts" disclosure are all deleted.
- **Delivery (the real fix for "Share did nothing"):** every browser session is a fresh anonymous user, so Share only reaches a *paired* ally (pairing-code handshake). Share now surfaces a clear message when no ally is paired, and a "Shared ✓" cue on success. New `GET /api/v1/ally/cases` lists the unrevoked, unexpired cases shared with the signed-in ally (collection-group query on `allyGrants` by `allyUid`, lightweight claim+expiry from the snapshot); the ally window polls it and auto-discovers shared cases instead of typing a case id. The full packet read still rechecks every predicate on open.
- **Privacy:** PRD C8 preserved — the preview shows exactly what Share sends; nothing is granted until Share binds to the previewed version+hash; the ally still gets only the allowlisted packet (now claim, proposed action, amount, verification gap, summary) and never the transcript, recording, or any other case field.
