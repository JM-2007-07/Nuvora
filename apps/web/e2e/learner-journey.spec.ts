import { expect, type Page, test } from '@playwright/test';

/**
 * Faroz learner flow (handoff §5, flow 1) against the real API and database, as a GUEST
 * so the scripted demo learners stay intact (guests are removed by `pnpm db:seed:demo`):
 * dashboard → diagnostic → results by topic → Arrays gap → retest → progress before/after.
 * The answers are Amina Rahimova's from the handoff (B-12), so the numbers must match it.
 * Needs the API on :4000 with `pnpm db:seed` applied.
 */

// Option index per question (0 = first option), handoff demo-learner-teacher.json.
const AMINA_DIAGNOSTIC = '11112211001000010100';
// Arrays retest: correct options are 0,1,2,0,3; Amina missed question 4 (picks option 1).
const AMINA_RETEST = '01213';

async function answerAll(page: Page, choices: string) {
  for (const [i, choice] of [...choices].entries()) {
    await expect(page.getByText(new RegExp(`^Question ${i + 1} of ${choices.length}$`))).toBeVisible();
    await page.getByRole('radio').nth(Number(choice)).check();
    await page.getByRole('button', { name: i === choices.length - 1 ? 'Review' : 'Next', exact: true }).click(); // exact: the dev overlay has a "Next.js" button
  }
  await expect(page.getByRole('heading', { name: 'Ready to submit?' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit answers' }).click();
}

test('guest: diagnostic → results → Arrays retest → before/after from stored answers', async ({ page }) => {
  await page.goto('/en/app');
  await page.getByRole('button', { name: 'Continue as guest' }).click();

  // Fresh learner: the dashboard offers the diagnostic and nothing is scanned yet.
  await expect(page.getByRole('heading', { name: 'Hey there' })).toBeVisible();
  await expect(page.getByText('Locked until your first scan.')).toBeVisible();
  await page.getByRole('link', { name: 'Start scan' }).click();

  await page.getByRole('button', { name: 'Begin scan' }).click();
  await answerAll(page, AMINA_DIAGNOSTIC);

  // Results page reads the stored attempt back: 13/20, Arrays 1/4.
  await expect(page).toHaveURL(/\/en\/app\/results\/[a-z0-9]+$/);
  await expect(page.getByRole('img', { name: '13 of 20 correct' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arrays quest' })).toBeVisible();
  await expect(page.getByRole('img', { name: '1 of 4 correct' })).toBeVisible();

  // Arrays retest (new questions) → 4/5, and the before/after on the result.
  await page.getByRole('link', { name: 'Retest' }).click();
  await page.getByRole('button', { name: 'Begin quest' }).click();
  await answerAll(page, AMINA_RETEST);
  await expect(page.getByRole('img', { name: '4 of 5 correct' }).first()).toBeVisible(); // score ring (the topic row repeats it)
  await expect(page.getByRole('heading', { name: 'Arrays across attempts' })).toBeVisible();

  // Progress shows the persisted before/after after a reload (not client state).
  await page.goto('/en/app/progress');
  await expect(page.getByRole('img', { name: 'Arrays: 1/4 before, 4/5 after' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Arrays: 1/4 before, 4/5 after' })).toBeVisible();
});

test('another learner cannot read an attempt; without a session the API answers 401', async ({ page, browser }) => {
  await page.goto('/en/app');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await page.getByRole('link', { name: 'Start scan' }).click();
  await page.getByRole('button', { name: 'Begin scan' }).click();
  await answerAll(page, AMINA_DIAGNOSTIC);
  await expect(page).toHaveURL(/\/app\/results\/[a-z0-9]+$/);
  const attemptId = page.url().split('/').pop()!;

  const other = await browser.newContext();
  const anonymous = await other.request.get(`/api/v1/me/attempts/${attemptId}`);
  expect(anonymous.status()).toBe(401);

  await other.request.post('/api/v1/session', { data: { guest: true } });
  const stranger = await other.request.get(`/api/v1/me/attempts/${attemptId}`);
  expect(stranger.status()).toBe(404);

  const otherPage = await other.newPage();
  await otherPage.goto(`/en/app/results/${attemptId}`);
  await expect(otherPage.getByText('Result not found')).toBeVisible();
  await other.close();
});
