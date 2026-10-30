import { expect, test } from '@playwright/test';

/**
 * Account security (2026-10-30): password reset pages, the login link, and the devices list
 * for a demo learner. Does not register accounts or change passwords.
 */
test('forgot password shows the neutral confirmation', async ({ page }) => {
  await page.goto('/en/forgot-password');
  await page.getByLabel('Email').fill('nobody-e2e@demo.tj');
  await page.getByRole('button', { name: 'Send link' }).click();
  await expect(page.getByText('If an account exists for this email, we’ve sent a link.')).toBeVisible();
});

test('an invalid reset link shows the invalid state after submitting', async ({ page }) => {
  await page.goto('/en/reset-password?token=fzp_invalidinvalidinvalidinvalid');
  await page.getByLabel('Password', { exact: true }).fill('longenough1');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByRole('heading', { name: 'This link doesn’t work' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();
});

test('login links to forgot password', async ({ page }) => {
  await page.goto('/en/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/en\/forgot-password/);
});

test('a demo learner sees devices but not change password', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:3001').origin;
  const started = await page.request.post('/api/v1/session', { data: { profile: 'amina-rahimova' }, headers: { Origin: origin } });
  expect(started.ok()).toBeTruthy();
  await page.goto('/en/app/settings');
  await expect(page.getByRole('heading', { name: 'Signed-in devices' })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();
  await expect(page.getByText('These settings are for accounts with an email and password.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change password' })).toHaveCount(0);
});
