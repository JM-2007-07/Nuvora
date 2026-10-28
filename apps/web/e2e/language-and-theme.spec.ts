import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/** The homepage headline per locale, read from the message files so copy edits don't break the test. */
const headline = (locale: 'tg' | 'ru' | 'en'): string =>
  JSON.parse(readFileSync(join(__dirname, '..', 'messages', `${locale}.json`), 'utf8')).Home.headline;

/** Collects every console error/warning and uncaught page error. */
function trackConsoleProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

async function chooseFromMenu(page: Page, trigger: string, item: string) {
  await page.getByRole('button', { name: trigger }).click();
  await page.getByRole('menuitemradio', { name: item }).click();
}

// Regression coverage for FR-I18N-01/02, FR-THEME-01, and the G1 clean-console fix
// (next-themes inline script re-rendered on client-side language switches).
test('language and theme switching work and keep the console clean', async ({ page }) => {
  const problems = trackConsoleProblems(page);
  const html = page.locator('html');
  const heading = page.getByRole('heading', { level: 1 });

  // First visit: Russian is the default, whatever the browser language.
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru$/);
  await expect(html).toHaveAttribute('lang', 'ru');
  await expect(heading).toHaveText(headline('ru'));

  await chooseFromMenu(page, 'Оформление', 'Тёмная');
  await expect(html).toHaveClass(/\bdark\b/);

  await chooseFromMenu(page, 'Язык', 'Тоҷикӣ');
  await expect(page).toHaveURL(/\/tg$/);
  await expect(html).toHaveAttribute('lang', 'tg');
  await expect(heading).toHaveText(headline('tg'));
  await expect(html).toHaveClass(/\bdark\b/); // theme survives the language switch

  await chooseFromMenu(page, 'Забон', 'English');
  await expect(page).toHaveURL(/\/en$/);
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(heading).toHaveText(headline('en'));
  await expect(html).toHaveClass(/\bdark\b/);

  await chooseFromMenu(page, 'Appearance', 'Light');
  await expect(html).not.toHaveClass(/\bdark\b/);

  // The language choice is remembered for the next visit to "/".
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
  await expect(html).toHaveAttribute('lang', 'en');

  expect(problems, 'console errors or warnings').toEqual([]);
});

// FR-I18N-01: locale URLs open directly, and "/" ignores the browser language.
test('direct locale URLs open their language; "/" defaults to Russian for a new visitor', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' }); // a browser that prefers English
  const page = await context.newPage();
  const problems = trackConsoleProblems(page);
  const html = page.locator('html');
  const heading = page.getByRole('heading', { level: 1 });

  for (const locale of ['tg', 'en'] as const) {
    await page.goto(`/${locale}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    await expect(html).toHaveAttribute('lang', locale);
    await expect(heading).toHaveText(headline(locale));
  }

  // Opening a locale URL directly doesn't save a choice: "/" still goes to the default.
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru$/);
  await expect(html).toHaveAttribute('lang', 'ru');

  expect(problems, 'console errors or warnings').toEqual([]);
  await context.close();
});
