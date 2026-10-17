# 0023: Self-entered user profile (name + mobile); WhatsApp opens straight to the ally

- **Status:** Accepted
- **Date:** 2026-10-17
- **Owners:** Orchestrator / DSN-038
- **Related task:** DSN-038
- **PRD references:** Core MVP C8 (ally packet / ally reach), founder demo vision step 5 (ally reached via WhatsApp)
- **Supersedes:** The pre-seeded client-only "sample ally"
- **Superseded by:** None

## Context

A sample ally ("Priya Nair") was pre-added so setup read as ready, but it had no uid and could not be shared with or reached; it only misled. The WhatsApp link was generic (`wa.me/?text=`), so the owner had to pick the ally's contact by hand, and the ally always appeared as "your Safety Ally".

## Decision

- **Removed the sample ally.** A fresh owner has no ally (`allyStatus: 'none'`) until they pair a real one; the owner invitation poll now runs for every owner.
- **Self-entered profile, per user (owner or ally):** `profiles/<uid> = { displayName?, mobile? }`, `GET`/`PUT /api/v1/profile` (self only, validated). Owners edit "Your details" in Settings; allies edit the same form on their pairing screen.
- **Direct WhatsApp:** the owner's `ally-whatsapp-summary` route now builds `https://wa.me/<digits>?text=…` from the **ally's own** profile mobile (`toWhatsAppNumber`: digits only, 10-digit assumed +91, 7–15 digits, else null → generic link). Looked up live by `allyUid` at use-time, so edits apply without re-pairing. The ally's own copy of the summary stays generic. Nothing is sent server-side; a human still taps the link.
- **Names:** `GET owner/invitations` joins the ally's `displayName` as `allyName`, so the Decide hub, share preview, and Settings use the real name.

## Consequences

- A paired ally's name and number are visible to the owner who invited them (both self-entered, optional). No number is ever read from a caller.
- `profiles` holds user-provided PII (name/mobile): keep it out of logs and the packet; it is not part of the allowlisted ally packet.
- Existing generic-link behaviour is the fallback whenever an ally has not set a usable number.

## Verification

- `apps/web` `tsc` clean; `vitest` green (24 files / 207 tests): Settings profile save, no-sample states, ally-by-name.
- `apps/api` `tsc` clean; `profile.test.ts` (pure, 4/4) for number normalization. The emulator-backed `ally-reach.test.ts` gained a direct-to-ally link case but was **not run here** (no Firebase emulator) — run `npm run test:api`.
