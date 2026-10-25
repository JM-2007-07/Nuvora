import { expect, type Page, test } from '@playwright/test';

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

  // First visit: Tajik is the default, whatever the browser language.
  await page.goto('/');
  await expect(page).toHaveURL(/\/tg$/);
  await expect(html).toHaveAttribute('lang', 'tg');
  await expect(heading).toHaveText('Ҳолати система');

  await chooseFromMenu(page, 'Забон', 'Русский');
  await expect(page).toHaveURL(/\/ru$/);
  await expect(html).toHaveAttribute('lang', 'ru');
  await expect(heading).toHaveText('Состояние системы');

  await chooseFromMenu(page, 'Оформление', 'Тёмная');
  await expect(html).toHaveClass(/\bdark\b/);

  await chooseFromMenu(page, 'Язык', 'English');
  await expect(page).toHaveURL(/\/en$/);
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(heading).toHaveText('System status');
  await expect(html).toHaveClass(/\bdark\b/); // theme survives the language switch

  await chooseFromMenu(page, 'Appearance', 'Light');
  await expect(html).not.toHaveClass(/\bdark\b/);

  // The language choice is remembered for the next visit to "/".
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
  await expect(html).toHaveAttribute('lang', 'en');

  expect(problems, 'console errors or warnings').toEqual([]);
});
