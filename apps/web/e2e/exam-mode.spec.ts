import { expect, test } from '@playwright/test';

/**
 * Standard Exam Mode (2026-10-30), read-only against the dev database: the learner's "From your
 * teacher" section and the teacher's live page for an unknown assessment. Creates and publishes
 * nothing, so the full exam flow is not covered here.
 */
test('a demo learner sees the From your teacher section or its empty state', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:3001').origin;
  const started = await page.request.post('/api/v1/session', { data: { profile: 'amina-rahimova' }, headers: { Origin: origin } });
  expect(started.ok()).toBeTruthy();
  await page.goto('/en/app/quests');
  await expect(page.getByRole('heading', { name: 'From your teacher' })).toBeVisible();
  const empty = page.getByText('Nothing from your teacher yet');
  const cards = page.locator('#exam-list-title ~ ul > li');
  await expect(empty.or(cards.first())).toBeVisible();
});

test('a demo teacher opens assessments and a live page for an unknown id shows a not-found state', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:3001').origin;
  const started = await page.request.post('/api/v1/staff/session', { data: { staff: 'dilshod-karimov' }, headers: { Origin: origin } });
  expect(started.ok()).toBeTruthy();
  await page.goto('/en/teach/assessments');
  await expect(page.getByRole('heading', { name: 'Assessments', level: 1 })).toBeVisible();

  await page.goto('/en/teach/assessments/does-not-exist-e2e/live');
  await expect(page.getByRole('heading', { name: /Assessment not found/ }).or(page.getByRole('alert')).first()).toBeVisible();
  await expect(page.getByText('Application error')).toHaveCount(0);
});
