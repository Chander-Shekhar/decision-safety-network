# Founder demo vision — the story we sell at the Cup

**Status:** Founder-stated, 2026-10-11. Captured verbatim-in-intent (condensed, not expanded).
This is founder source input for reconciling the locked PRD. It is **not** a competing spec or
status file; where it conflicts with `Decision_Safety_Network_PRD_Draft.md`, the PRD is changed
only on explicit founder authorization. Core premise throughout: **the user is already under heavy
stress — be present and help, never add alarm.**

## The story, in order

1. **Home + first-run setup (mobile app).** User lands on home. If setup isn't done, prompt it:
   - **Which calls to listen to:** all calls / only unsafe numbers / decide at pickup per call.
   - **Ally:** who they are + what case info to share with them.
   - **Bank account integration:** so we can inform the bank immediately if something bad happens.

2. **Incoming call → pre-pickup screening.** Integrate Truecaller (or similar) to verify caller
   identity; if unverified/spam, tell the user right away "not a verified caller." Also check our
   own database of confirmed-fraudulent numbers and warn. If nothing fraudulent, stay silent and
   let the call through.

3. **Live call → transcription + manipulation detection.** User picks up and talks. We transcribe
   live. System detects social-engineering / manipulation / fraud intent. Non-alarmingly: tell the
   user to slow down and confirm the claims — there's no real rush; doing this five minutes later
   changes nothing.

4. **Clear summary + AI claim verification.** AI verifies what the caller claims:
   - Claimed identity (e.g. "I'm from HDFC Bank") — does the calling number map to that bank? Is
     there internet evidence the number belongs to the bank? Does the bank's usual customer-care
     number follow a known pattern that this doesn't match?
   - Claimed procedure (e.g. "move your money to this safe account") — is that a normal, legitimate
     procedure? (No.)
   - Explicitly call out anything **not verifiable**, **improper**, or an **irreversible action** —
     still non-alarming.

5. **Clear next steps.**
   - **Ally:** one button connects the ally; all gathered case evidence is shared with them directly;
     ally is reached (e.g. via WhatsApp) with a quick summary and contacts the person.
   - **"Already paid":** if the fraud already happened (our system failed, or a back channel we
     weren't watching), the user taps this and we move to the next phase.

6. **Recovery / incident phase.** Build the case; gather all evidence into a readily shareable,
   extractable packet to feed 1930 / the cybersecurity cell. Offer to **freeze the configured
   accounts**. Once the user confirms fraud and the case is shared with the cyber cell, save the
   caller as fraudulent in our database — so future recipients of a similar call are warned before
   they pick up.

## Backlog (not core demo)

- **Public dashboard:** manipulation attempts made, amount saved, cases shared with the agency.
- **Derived threat intelligence:** by area and attack type, what's happening live.
- **Proactive education:** notify/message users that certain attacks are frequent in their area, so
  people get real data-backed warnings instead of word-of-mouth.

## Reconciliation rulings (founder, 2026-10-11)

Resolving each PRD gap raised on 2026-10-11:

1. **Live call capture + full transcription — IN, as a labeled prototype capability.** It's a
   prototype; we must show the capability to show impact. Clearly mark it as a prototype capture
   path (not an App-Store-distributable claim). Overrides the current controlled-transcript-only
   scope and the three call-capture non-goals.
2. **Fraud-number list — IN, no public accusation.** Populate the list only from cases the
   user confirmed fraudulent **or** that were reported to the cyber cell. Used to warn
   future recipients of a matching number before they pick up. Not public, no criminal attribution.
3. **Account freeze — guided, not real, affected account only.** No full bank integration claim;
   Demo Bank for the Cup. Instead of a one-click freeze, **guide** the user: show the bank helpline
   number plus a prepared summary of exactly what to say so the bank can freeze the *affected*
   account.
4. **1930 / cyber-cell report — user-submitted, pre-filled.** No unattended submission. Give a
   one-click path that **pre-fills the official form**; the user reviews and submits it themselves,
   with guidance.
5. **External caller-ID (Truecaller or similar) — IN.** New scope; add it.
6. **AI claim verification against the open internet / real bank numbers — IN.** Important; add it.
   Treated as labeled, untrusted supporting evidence — never as an authoritative route.
7. **Ally via WhatsApp + ally may contact the caller — IN.** New scope; add both. Ally still cannot
   control funds or certify the caller.
8. **Dashboard — IN as backlog.** The core is a persistent record of every saved/handled case;
   metrics (incl. amount saved) and a dashboard with intelligence/analysis are built on top of that
   record. Post-Cup. Impact claims stay bounded to recorded evidence.
