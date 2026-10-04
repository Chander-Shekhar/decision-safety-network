// SKIPPED (every test is test.skip): pending the deferred shell wiring and the
// Playwright/Vite/firebase-client sub-gates. It is the documented TARGET journey,
// not a passing or red spec; it references controls the shell does not yet render
// (e.g. 'Play legitimate scenario') and cannot run as written. It REQUIRES dependencies that are not installed:
//   - @playwright/test (plus browser binaries and a playwright.config.ts)
//   - a Vite dev server serving apps/web (build/dev scripts + vite.config.ts)
//   - the `firebase` client SDK in apps/web (real synthetic sign-in; main.tsx
//     currently ships a FIREBASE_CLIENT_NOT_WIRED placeholder)
// The founder deferred those dependency decisions. Authored as source only so
// the red journey is reviewable; it is excluded from the web tsconfig.
import { expect, test } from '@playwright/test';

test.skip('attack journey uses one case and an explicit simulated decision', async ({ browser }) => {
  const userPage = await (await browser.newContext()).newPage();
  const allyPage = await (await browser.newContext()).newPage();
  await userPage.goto('/');
  await allyPage.goto('/');
  await userPage.getByRole('button', { name: 'Create synthetic user' }).click();
  await allyPage.getByRole('button', { name: 'Create synthetic ally' }).click();
  await allyPage.getByRole('button', { name: 'Get pairing code' }).click();
  const code = await allyPage.getByTestId('pairing-code').textContent();
  await userPage.getByLabel('Large new-payee threshold').fill('10000');
  await userPage.getByRole('checkbox', { name: /allow processing/i }).check();
  await userPage.getByRole('checkbox', { name: /allow ally sharing/i }).check();
  await userPage.getByRole('checkbox', { name: /allow evidence export/i }).check();
  await userPage.getByLabel('Ally pairing code').fill(code!);
  await userPage.getByRole('button', { name: 'Save Safety Plan' }).click();
  await allyPage.getByRole('button', { name: 'Accept invitation' }).click();
  await userPage.getByRole('button', { name: 'Session' }).click();
  await userPage.getByRole('button', { name: 'Start controlled session' }).click();
  const caseId = userPage.url().match(/cases\/([^/]+)/)![1];
  await userPage.getByRole('button', { name: 'Decision' }).click();
  await userPage.getByRole('button', { name: 'Play attack scenario' }).click();
  await userPage.getByRole('button', { name: 'Confirm caller claim' }).click();
  await userPage.getByRole('button', { name: 'Confirm payee' }).click();
  await userPage.getByRole('button', { name: 'Confirm amount' }).click();
  await userPage.getByLabel('Beneficiary').selectOption('safe-new');
  await userPage.getByLabel('Amount').fill('50000');
  await userPage.getByRole('button', { name: 'Submit simulated transfer' }).click();
  await expect(userPage.getByText(/before you enter an OTP/i).first()).toBeVisible();
  await userPage.getByRole('button', { name: 'Verify Officially' }).click();
  await userPage.getByRole('button', { name: 'Run Demo Bank verification' }).click();
  await userPage.getByRole('button', { name: 'Ask My Ally' }).click();
  await expect(userPage.getByText(/exact packet.*Alex will see/i)).toBeVisible();
  await expect(userPage.getByText(/Transfer ₹50,000 to safe-new/i)).toBeVisible();
  await expect(allyPage.getByText(/Account compromised/i)).not.toBeVisible();
  await userPage.getByRole('button', { name: 'Share this case with Alex' }).click();
  await allyPage.reload();
  await allyPage.getByRole('button', { name: 'Recommend pause' }).click();
  await userPage.getByRole('button', { name: 'Cancel simulated transfer' }).click();
  await userPage.reload();
  await expect(userPage.getByText(/claim rejected.*transfer cancelled/i)).toBeVisible();
  await userPage.getByRole('button', { name: /I already paid/i }).click();
  await expect(userPage).toHaveURL(new RegExp(`/cases/${caseId}/recover`));
  await expect(userPage.getByText(/Demo Bank.*ready/i)).toBeVisible();
  await expect(userPage.getByText(/1930.*ready/i)).toBeVisible();
  await expect(userPage.getByTestId('reused-claim')).toContainText('Caller claimed: Account compromised');
  await expect(userPage.getByTestId('proposed-payee')).toContainText('safe-new');
  await expect(userPage.getByTestId('proposed-amount')).toContainText('50,000');
  await expect(userPage.getByTestId('paid-payee')).toContainText('Unknown');
  await expect(userPage.getByTestId('paid-amount')).toContainText('Unknown');
  await userPage.getByRole('button', { name: 'Yes, they match' }).click();
  await expect(userPage.getByTestId('paid-payee')).toContainText('safe-new');
  await expect(userPage.getByTestId('paid-amount')).toContainText('50,000');
  const downloadPromise = userPage.waitForEvent('download');
  await userPage.getByRole('button', { name: /download evidence/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const entries = await readZipEntries((await download.path())!);
  expect(entries.get('brief.html')).toContain('Account compromised');
  expect(entries.get('brief.html')).toContain('Caller claimed');
  expect(entries.get('brief.html')).toContain('safe-new');
  expect(entries.get('brief.html')).toContain('50,000');
  expect(entries.get('provenance.json')).toContain('user-confirmed');
  expect(entries.get('provenance.json')).toContain('user-reported');
  await expect(userPage.getByText(/Simulated/i).first()).toBeVisible();
});

test.skip('legitimate high-pressure control never sees the enhanced Pause', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Create synthetic user' }).click();
  await page.getByRole('button', { name: 'Session' }).click();
  await page.getByRole('button', { name: 'Start controlled session' }).click();
  await page.getByRole('button', { name: 'Decision' }).click();
  await page.getByRole('button', { name: 'Play legitimate scenario' }).click();
  await page.getByLabel('Beneficiary').selectOption('safe-known');
  await page.getByLabel('Amount').fill('2000');
  await page.getByRole('button', { name: 'Submit simulated transfer' }).click();
  await expect(page.getByText(/before you enter an OTP/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Pause$/ })).toHaveCount(0);
});

test.skip('API rejects an unauthenticated request and an ally reading another case', async ({ request, browser }) => {
  expect((await request.get('/api/v1/cases/some-case')).status()).toBe(401);
  const allyPage = await (await browser.newContext()).newPage();
  await allyPage.goto('/');
  await allyPage.getByRole('button', { name: 'Create synthetic ally' }).click();
  const status = await allyPage.evaluate(async () => (await fetch('/api/v1/ally/cases/not-shared-with-me')).status);
  expect([401, 403]).toContain(status);
});

/** Reads a ZIP (stored or deflated entries) using the ZIP library already pinned for Task 11. */
async function readZipEntries(path: string): Promise<Map<string, string>> {
  const { default: unzipper } = (await import('unzipper' as string)) as { default: any };
  const directory = await unzipper.Open.file(path);
  const entries = new Map<string, string>();
  for (const file of directory.files) {
    entries.set(file.path, (await file.buffer()).toString('utf8'));
  }
  return entries;
}
