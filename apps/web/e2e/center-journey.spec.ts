import { expect, test } from '@playwright/test';

/**
 * Faroz center flow (handoff §5, flow 3, read-only parts) and the privacy and permission
 * rules of §7, on the real API and the B-12 records. Read-only.
 */
test('center admin: dashboard → groups → B-12 (totals and participation only) → settings', async ({ page }) => {
  await page.goto('/en/center');
  await page.getByRole('button', { name: /Farhod Jalilov/ }).click();

  await expect(page.getByRole('heading', { name: 'Faroz Demo Center' })).toBeVisible();
  await expect(page.getByText('Groups needing attention')).toBeVisible();

  await page.getByRole('link', { name: 'Groups', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();
  const b12 = page.getByRole('main').getByRole('link').filter({ hasText: 'B-12' }).first();
  await expect(b12).toContainText('68%');
  await expect(b12).toContainText('26');

  await b12.click();
  await expect(page.getByRole('heading', { name: /B-12/ })).toBeVisible();
  await expect(page.getByText('Amina Rahimova')).toBeVisible(); // participation: name only
  await expect(page.getByText('13/20')).toHaveCount(0); // never an individual score

  // The API response itself has no individual scores, answers or retest membership.
  const body = await (await page.request.get('/api/v1/center/groups/B-12')).text();
  expect(body).not.toMatch(/"score"|"retest"|"answers"|"isCorrect"|"topics":\{/);

  await page.getByRole('link', { name: 'Settings' }).first().click();
  await expect(page.getByRole('heading', { name: 'Organization settings' })).toBeVisible();
});

test('coordinator: settings refused by the server; teacher: whole center refused', async ({ page }) => {
  await page.goto('/en/center/settings');
  await page.getByRole('button', { name: /Komila Rasulova/ }).click();
  await expect(page.getByRole('heading', { name: 'You don’t have access to this page' })).toBeVisible();
  expect((await page.request.get('/api/v1/center/settings')).status()).toBe(403);
  expect((await page.request.get('/api/v1/center/overview')).status()).toBe(200);

  await page.getByRole('button', { name: 'Switch staff member' }).first().click();
  await page.getByRole('button', { name: /Dilshod Karimov/ }).click();
  await page.goto('/en/center');
  await expect(page.getByRole('heading', { name: 'You don’t have access to this page' })).toBeVisible();
  expect((await page.request.get('/api/v1/center/overview')).status()).toBe(403);
});
