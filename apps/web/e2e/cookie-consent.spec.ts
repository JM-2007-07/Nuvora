import { expect, type BrowserContext, test } from '@playwright/test';

// Cookie consent (banner, settings dialog, footer button). Public pages only: no login, no database writes.
// English is used for the labels; the `faroz-consent` cookie holds URL-encoded JSON.

async function consentCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) => c.name === 'faroz-consent');
  return cookie ? (JSON.parse(decodeURIComponent(cookie.value)) as { version: number; decidedAt: string; categories: { analytics: boolean; marketing: boolean } }) : null;
}

const banner = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Cookie notice' });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('first visit shows the banner with three buttons and no cookie yet', async ({ page, context }) => {
  await page.goto('/en');
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole('button')).toHaveText(['Accept all', 'Reject optional', 'Customize']);
  expect(await consentCookie(context)).toBeNull();
});

test('Accept all persists across a reload', async ({ page, context }) => {
  await page.goto('/en');
  await banner(page).getByRole('button', { name: 'Accept all' }).click();
  await expect(banner(page)).toBeHidden();
  const saved = await consentCookie(context);
  expect(saved?.categories).toEqual({ analytics: true, marketing: true });
  expect(saved?.version).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner(page)).toBeHidden();
});

test('Reject optional persists with both categories off', async ({ page, context }) => {
  await page.goto('/en');
  await banner(page).getByRole('button', { name: 'Reject optional' }).click();
  await expect(banner(page)).toBeHidden();
  expect((await consentCookie(context))?.categories).toEqual({ analytics: false, marketing: false });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner(page)).toBeHidden();
});

test('Customize enables only analytics, and the footer reopens it to withdraw', async ({ page, context }) => {
  await page.goto('/en');
  await banner(page).getByRole('button', { name: 'Customize' }).click();

  const dialog = page.getByRole('dialog', { name: 'Cookie settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Always on')).toBeVisible();
  const analytics = dialog.getByRole('switch', { name: /Analytics/ });
  const marketing = dialog.getByRole('switch', { name: /Marketing/ });
  await expect(analytics).not.toBeChecked();
  await expect(marketing).not.toBeChecked();

  await analytics.check({ force: true });
  await dialog.getByRole('button', { name: 'Save choices' }).click();
  await expect(dialog).toBeHidden();
  await expect(banner(page)).toBeHidden();
  expect((await consentCookie(context))?.categories).toEqual({ analytics: true, marketing: false });

  // Withdrawal: reopen from the footer, turn analytics off, save.
  await page.getByRole('contentinfo').getByRole('button', { name: 'Cookie settings' }).click();
  await expect(dialog).toBeVisible();
  await expect(analytics).toBeChecked();
  await analytics.uncheck({ force: true });
  await dialog.getByRole('button', { name: 'Save choices' }).click();
  await expect(dialog).toBeHidden();
  expect((await consentCookie(context))?.categories).toEqual({ analytics: false, marketing: false });
});

test('the cookie policy page lists the storage keys and is linked from the footer', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Cookies' }).click();
  await expect(page).toHaveURL(/\/en\/cookies$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cookie policy' })).toBeVisible();
  for (const key of ['nv_session', 'fz_staff', 'NEXT_LOCALE', 'faroz-consent', 'faroz-theme']) {
    await expect(page.getByText(key, { exact: true })).toBeVisible();
  }
});

test('the banner never shows inside the quiz player', async ({ page }) => {
  await page.goto('/ru/app/quest/javascript-diagnostic');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/ru\/app\/quest\/javascript-diagnostic/);
  await expect(page.getByRole('region', { name: 'Уведомление о cookie' })).toHaveCount(0);
});
