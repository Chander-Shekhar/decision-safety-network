// Live end-to-end journeys (DSN-032) reconciled against the REAL rendered shell.
//
// The historical version of this file was source-only (`test.skip`) and
// referenced controls that no longer exist (`Play attack scenario`,
// `safe-new`/`safe-known` option values, several `data-testid`s). The app is
// state/tab based (StepRail nav; URLs are cosmetic `pushState`), facts now come
// from a pasted transcript processed by the deterministic fake Gemini
// (`apps/api/test/fake-gemini.ts`), and the payee picker is a native <select>.
//
// These journeys run against the local, no-cloud stack booted by
// `playwright.config.ts` (Firebase emulator + fake-Gemini API dev-server on
// :8787 + Vite on :5173). No real Gemini, no cloud, synthetic data only.
//
// How the enhanced Pause is produced deterministically here:
//  - fake Gemini `extract` recognises "demo bank fraud team" / "account
//    compromised" / "safe-new" / "50,000" in the pasted transcript;
//  - `observedTactics` seeds as an "Unknown" fact row, which the owner CORRECTS
//    to a tactic -> `cues` becomes true;
//  - a ₹50,000 transfer to a new payee ("safe-new") exceeds the default
//    ₹5,000 threshold -> `largeNewPayee`;
//  - fake Gemini `relate` joins the draft to the transcript (the beneficiary id
//    "safe-new" and "50,000" both appear) -> `matchingRelation`;
//  - submit only pends; PaymentPanel auto-rechecks -> the join advances to Pause.
//
// DSN-038 UI-polish update: the single "Decision" step was split into three
// sequential steps — Review (Decision Map + optional checks), Decide (the
// ActionConsole), Pay (draft/submit transfer) — and the call is now brought in
// on the Session step (not Decision). Navigation uses the StepRail (exact
// button names) plus a Back/Next footer. These three UI journeys are marked
// `test.fixme` below: the structure here has been reconciled to the new flow
// but NOT executed against the live stack (the emulator+Vite+API boot was out
// of scope for the change). Re-enable and validate them in the deferred e2e
// pass; the most likely point needing a tweak is the Pay->Decide hop, where the
// post-submit auto-recheck must settle to `Pause` before the Decide console is
// read. The api-auth-guard test below is unaffected and stays active.
import { expect, test, type Page } from '@playwright/test';

const ATTACK_TRANSCRIPT = [
  'Caller: This is the Demo Bank fraud team.',
  'Caller: Your account is compromised and we must act now.',
  'Caller: Move everything to the safe account safe-new immediately.',
  'You: How much?',
  'Caller: Transfer 50,000 right now or you lose it all.',
].join('\n');

/** Open the app (auto owner sign-in) and complete first-run setup from the consolidated Settings. */
async function createConfiguredOwner(page: Page): Promise<void> {
  await page.goto('/');
  // A fresh owner lands on a first-run Home that points into Settings for setup.
  await page.getByRole('button', { name: /Go to Settings to set up/i }).click();
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();

  // Choose a listening mode. Processing and ally sharing are on by default; saving completes setup.
  await page.getByRole('radio', { name: /All calls/ }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();

  // Lands on Home as a configured owner.
  await expect(page.getByRole('heading', { name: "You're protected" })).toBeVisible();
}

/** From Home, open a controlled session. The call is now brought in on the Session step. */
async function startSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start a protected session' }).click();
  await page.getByRole('button', { name: 'Start controlled session' }).click();
  await expect(page.getByText(/^Case /)).toBeVisible();
}

/** Add the call transcript on the Session step (the paste input lives there now, not Decision). */
async function addCall(page: Page, transcript: string): Promise<void> {
  await page.getByLabel('Paste the call').fill(transcript);
  await page.getByRole('button', { name: 'Add transcript' }).click();
}

/** Jump to a journey step via its StepRail button (exact: the Back/Next footer labels are prefixed). */
async function goToStep(page: Page, step: 'Review' | 'Decide' | 'Pay' | 'Verify' | 'Ally'): Promise<void> {
  await page.getByRole('button', { name: step, exact: true }).click();
}

/** The <li> fact row in the Decision Map whose heading matches `label`. */
function factRow(page: Page, label: string) {
  return page.locator('li', { has: page.getByRole('heading', { level: 3, name: label, exact: true }) });
}

test.describe('attack journey', () => {
  // DSN-038: reconciled to the Session/Review/Decide/Pay split; not yet run live (see file header).
  test.fixme('a joined, source-grounded attack produces an explicit, simulated enhanced Pause', async ({ page }) => {
    await createConfiguredOwner(page);
    await startSession(page);

    // Enter the call transcript on the Session step (paste path, DSN-030).
    await addCall(page, ATTACK_TRANSCRIPT);

    // Review step holds the Decision Map. The fake Gemini extracts the claim, labeled as a caller claim (not truth).
    await goToStep(page, 'Review');
    await expect(page.getByRole('heading', { name: 'Decision Map' })).toBeVisible();
    await expect(factRow(page, 'Claimed identity').getByText('Demo Bank fraud team')).toBeVisible();
    await expect(factRow(page, 'Central claim').getByText('Account compromised')).toBeVisible();

    // Correct the seeded "Unknown" Observed tactics fact -> turns on the `cues` signal.
    const tactics = factRow(page, 'Observed tactics');
    await tactics.getByLabel('Correct observed tactics').fill('urgency-pressure');
    await tactics.getByRole('button', { name: 'Correct', exact: true }).click();
    await expect(tactics.getByText('urgency-pressure')).toBeVisible();

    // Confirm a fact so the Evidence step is reachable and provenance reads "User confirmed".
    // Wait for the provenance flip before drafting: `confirmFact` bumps the shared case
    // version, and `payment/draft` rejects a stale expectedVersion with VERSION_CONFLICT.
    // A bare click() returns on dispatch, not after the refresh — so synchronize here.
    await factRow(page, 'Claimed identity').getByRole('button', { name: 'Confirm claimed identity' }).click();
    await expect(factRow(page, 'Claimed identity').getByText('User confirmed')).toBeVisible();

    // Pay step holds the transfer form. Draft a large transfer to the new payee the caller
    // named. ("Amount" is exact: the Decision Map also renders a "Correct amount" fact field.)
    await goToStep(page, 'Pay');
    await page.getByLabel('Beneficiary').selectOption('__new__');
    await page.getByLabel('New payee account').fill('safe-new');
    await page.getByLabel('Amount', { exact: true }).fill('50000');
    await page.getByRole('button', { name: 'Save transfer draft' }).click();
    await expect(page.getByText('safe-new · new payee')).toBeVisible();

    // Submit intent; the panel auto-rechecks and the join advances to the enhanced Pause.
    await page.getByRole('button', { name: 'Submit intent' }).click();

    // Decide step holds the Action console. The "Before you enter an OTP" framing shows for
    // ANY open payment, so it is NOT the discriminator. The enhanced (joined) Pause is
    // `phase === 'Pause'`, which is the ONLY state that gates Continue behind an explicit
    // acknowledgment (ActionConsole.tsx:67,123) — that ack checkbox + "Confirm Continue" is the proof.
    await goToStep(page, 'Decide');
    const actionConsole = page.getByRole('region', { name: 'Action console' });
    await expect(actionConsole.getByRole('checkbox', { name: /request remains unverified/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(actionConsole.getByRole('button', { name: 'Confirm Continue' })).toBeVisible();

    // A joined, pre-verification Pause shows exactly its three grounded reasons (PRD C6,
    // MAX_REASONS=3): the manipulation cue, the still-unverified claim, and the large new
    // payee. Pinning the count catches a silently dropped reason, not just an extra one.
    const reasons = actionConsole.locator('section[aria-label="Why slow down"] li');
    await expect(reasons).toHaveCount(3);
    await expect(reasons.filter({ hasText: /pressure tactic was observed/i }).first()).toBeVisible();
    await expect(reasons.filter({ hasText: /has not been independently verified/i }).first()).toBeVisible();
    await expect(reasons.filter({ hasText: /new, above-threshold transfer/i }).first()).toBeVisible();

    // The Pause offers the protective routes and never auto-acts.
    await expect(actionConsole.getByRole('button', { name: 'Pause transfer' })).toBeVisible();
    await expect(actionConsole.getByRole('button', { name: 'Verify officially' })).toBeVisible();

    // The caller's words are consistently framed as a CLAIM to be checked, never as an
    // instruction to act: the Decision Map renders them under "Claimed identity" /
    // "Central claim" (asserted above), and the Pause OFFERS the ally route rather than
    // acting on the caller's demand.
    //
    // Owner-side ally reach (DSN-033/DSN-038): the Pause offers "Ask my ally", which opens the
    // Ally step and AUTO-GENERATES the summary inline (no stress-time excerpt triage; the picker
    // is now optional behind "Adjust which excerpts your ally sees"). The owner reviews EXACTLY
    // the allowlisted packet the ally would receive — the caller's words appear under a "Caller
    // claimed" label and a "Verification gap", never as an instruction. The raw transcript is
    // never shared.
    await actionConsole.getByRole('button', { name: 'Ask my ally' }).click();
    const allyPreview = page.getByRole('region', { name: 'Ask my ally preview' });
    await expect(allyPreview.getByText('Caller claimed')).toBeVisible();
    await expect(allyPreview.getByText('Account compromised')).toBeVisible();
    await expect(allyPreview.getByText('Verification gap')).toBeVisible();
    await expect(allyPreview.getByText(/full transcript and other evidence are not included/i)).toBeVisible();

    // Official verification is a SEALED, simulated route sourced from the Demo Bank
    // registry (never caller data); it reports the claim is not supported.
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await page.getByRole('button', { name: 'Load verification registry' }).click();
    await page.getByRole('button', { name: 'Verify with Demo Bank' }).click();
    await expect(page.getByRole('heading', { name: 'Claim not supported' })).toBeVisible();
  });
});

test.describe('legitimate control', () => {
  // DSN-038: reconciled to the split; not yet run live. Note for the live pass: Pay/Decide are
  // gated on extracted facts (journey.ts), so a no-transcript draft may need a benign call added
  // on Session first to unlock those steps — validate and adjust when re-enabling.
  test.fixme('a small transfer with no tactics and no join never shows the enhanced Pause', async ({ page }) => {
    await createConfiguredOwner(page);
    await startSession(page);

    // No manipulation cue, no joined transcript, below the large-payee threshold.
    await goToStep(page, 'Pay');
    await page.getByLabel('Beneficiary').selectOption('__new__');
    await page.getByLabel('New payee account').fill('monthly-rent');
    await page.getByLabel('Amount', { exact: true }).fill('1000');
    await page.getByRole('button', { name: 'Save transfer draft' }).click();
    await expect(page.getByText('monthly-rent · new payee')).toBeVisible();

    await page.getByRole('button', { name: 'Submit intent' }).click();

    // The OTP framing still appears for an open payment, but a NON-joined case offers
    // a plain "Continue the transfer" — it is never gated behind the acknowledgment
    // the enhanced Pause requires, and it carries no reinforced bank-policy reason.
    await goToStep(page, 'Decide');
    const actionConsole = page.getByRole('region', { name: 'Action console' });
    await expect(actionConsole.getByRole('button', { name: 'Continue the transfer' })).toBeVisible({ timeout: 20_000 });
    await expect(actionConsole.getByRole('checkbox', { name: /request remains unverified/i })).toHaveCount(0);
    await expect(actionConsole.getByRole('button', { name: 'Confirm Continue' })).toHaveCount(0);
    await expect(page.getByText(/runs against your bank/i)).toHaveCount(0);
  });
});

test.describe('near-neighbor check control', () => {
  // DSN-038: reconciled to the split; not yet run live (see file header).
  test.fixme('a cued-but-unjoined case reaches Check, not the acknowledgment-gated Pause', async ({ page }) => {
    await createConfiguredOwner(page);
    await startSession(page);

    // Same manipulation cue as the attack (transcript + corrected tactics -> `cues`),
    // but a SMALL transfer that never joins (below threshold, amount absent from the
    // transcript) -> phase Check, the nearest neighbour of Pause. If `ackGated` ever
    // loosened to include Check, this would trip; the far Observe control would not.
    await addCall(page, ATTACK_TRANSCRIPT);
    await goToStep(page, 'Review');
    const tactics = factRow(page, 'Observed tactics');
    await tactics.getByLabel('Correct observed tactics').fill('urgency-pressure');
    await tactics.getByRole('button', { name: 'Correct', exact: true }).click();
    await expect(tactics.getByText('urgency-pressure')).toBeVisible();

    await goToStep(page, 'Pay');
    await page.getByLabel('Beneficiary').selectOption('__new__');
    await page.getByLabel('New payee account').fill('safe-new');
    await page.getByLabel('Amount', { exact: true }).fill('1000');
    await page.getByRole('button', { name: 'Save transfer draft' }).click();
    await expect(page.getByText('safe-new · new payee')).toBeVisible();

    await page.getByRole('button', { name: 'Submit intent' }).click();

    await goToStep(page, 'Decide');
    const actionConsole = page.getByRole('region', { name: 'Action console' });
    await expect(actionConsole.getByRole('button', { name: 'Continue the transfer' })).toBeVisible({ timeout: 20_000 });
    await expect(actionConsole.getByRole('checkbox', { name: /request remains unverified/i })).toHaveCount(0);
    await expect(actionConsole.getByRole('button', { name: 'Confirm Continue' })).toHaveCount(0);
  });
});

test.describe('api auth guard', () => {
  test('the API rejects unauthenticated case and ally reads through the proxied origin', async ({ request }) => {
    expect((await request.get('/api/v1/cases/some-case')).status()).toBe(401);
    expect((await request.get('/api/v1/ally/cases/not-shared-with-me')).status()).toBe(401);
  });
});
