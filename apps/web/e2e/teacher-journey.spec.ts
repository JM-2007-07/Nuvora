import { expect, test } from '@playwright/test';

/**
 * Faroz teacher flow (handoff §5, flow 2) on the real API and the B-12 records from
 * `pnpm db:seed:demo`, and the server-side denial for center staff. Read-only.
 */
test('teacher: dashboard → gap insights → one student answer by answer', async ({ page }) => {
  await page.goto('/en/teach');
  await page.getByRole('button', { name: /Dilshod Karimov/ }).click();

  await expect(page.getByRole('heading', { name: 'Hello, Dilshod' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arrays retest is in.' })).toBeVisible();
  await expect(page.getByText('19%', { exact: true })).toBeVisible();
  await expect(page.getByText('68%', { exact: true })).toBeVisible();
  await expect(page.getByText('B-12 · 7 students')).toBeVisible();

  await page.getByRole('link', { name: /Review the gap/ }).click();
  await expect(page.getByRole('heading', { name: 'Gap insights' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Arrays.*44%/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Q14 · how the class answered')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '[2, 4, 6]' })).toContainText('14/24');
  await expect(page.getByText('Under 60% on this topic · 15')).toBeVisible();

  await page.getByRole('link', { name: /Amina Rahimova 1\/4/ }).click();
  await expect(page.getByRole('heading', { name: 'Amina Rahimova' })).toBeVisible();
  await expect(page.getByText('13/20', { exact: true })).toBeVisible(); // diagnostic
  await expect(page.getByText('4/5', { exact: true })).toBeVisible(); // Arrays retest
});

test('center coordinator is refused by the server on the teacher workspace', async ({ page }) => {
  await page.goto('/en/teach');
  await page.getByRole('button', { name: /Komila Rasulova/ }).click();
  await expect(page.getByRole('heading', { name: 'You don’t have access to this page' })).toBeVisible();
  const response = await page.request.get('/api/v1/teach/groups/B-12');
  expect(response.status()).toBe(403);
  await page.getByRole('button', { name: 'Switch staff member' }).first().click();
  await expect(page.getByRole('heading', { name: 'Who is signing in?' })).toBeVisible();
});
