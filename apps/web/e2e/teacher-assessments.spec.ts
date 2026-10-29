import { expect, type Page, test } from '@playwright/test';

/**
 * Teacher assessments (handoff TAssessments + TBuilder) on the real API, after
 * `pnpm db:seed:demo` (which recreates Dilshod's "Functions — return vs console.log"
 * draft). Each test puts the data back: the published draft is unscheduled again and
 * the new draft is deleted.
 */
const DRAFT = 'Functions — return vs console.log';

async function signInAsDilshod(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: /Dilshod Karimov/ }).click();
}

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('assessments list → continue the Functions draft → publish → unschedule', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await signInAsDilshod(page, '/en/teach/assessments');

  await expect(page.getByRole('heading', { name: 'Assessments', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: `Finish “${DRAFT}” for B-12` })).toBeVisible();
  await expect(page.getByText('Functions is at 58% in the diagnostic. Your draft has 5 questions.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '8 of 13 missed it again' })).toBeVisible();
  // Rows computed from stored answers.
  const table = page.locator('table');
  await expect(table.getByRole('row').filter({ hasText: 'JavaScript diagnostic' })).toContainText('24/26');
  await expect(table.getByRole('row').filter({ hasText: 'Arrays: retest' })).toContainText('13/15');

  await page.getByRole('link', { name: /Continue draft/ }).click();
  await expect(page.getByRole('heading', { name: DRAFT, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Questions · 5' })).toBeVisible();
  await expect(page.getByText('Functions · 9 of 24 right in B-12 · 06.10')).toBeVisible();

  await page.getByRole('button', { name: /5\. Publish/ }).click();
  await expect(page.getByText('Every question has a correct answer')).toBeVisible();
  await expect(page.getByText(/1 question has no Русский version/)).toBeVisible();
  await page.getByRole('button', { name: 'Publish…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scheduled' })).toBeVisible();

  await page.getByRole('link', { name: 'Back to assessments' }).click();
  const row = page.locator('table').getByRole('row').filter({ hasText: DRAFT });
  await expect(row).toContainText('Scheduled');
  await row.getByRole('button', { name: 'Unschedule' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unschedule' }).click();
  await expect(row).toContainText('Draft');
  expect(errors).toEqual([]);
});

test('a new draft: title, a question from the bank, saved, then deleted', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  const title = `E2E check ${Date.now()}`;
  await signInAsDilshod(page, '/en/teach/assessments/new');

  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('combobox', { name: 'Topic' }).selectOption({ label: 'Functions' });
  await page.getByRole('button', { name: /Next: Questions/ }).click();
  await expect(page).toHaveURL(/\/en\/teach\/assessments\/(?!new)[a-z0-9]+$/);

  await page.getByRole('button', { name: 'Add from bank' }).click();
  const bank = page.getByRole('dialog');
  await bank.getByText('What does total(2, 3) return?').click();
  await bank.getByRole('button', { name: 'Add 1 question' }).click();
  await expect(page.getByText('Functions · 9 of 24 right in B-12 · 06.10')).toBeVisible();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/^Saved · /)).toBeVisible();

  // Publishing is refused until there are 3 questions (checked on the server too).
  await page.getByRole('button', { name: /5\. Publish/ }).click();
  await expect(page.getByText('Add at least 3 questions (now 1)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fix the items to publish' })).toBeDisabled();

  await page.getByRole('link', { name: 'Assessments' }).first().click();
  const row = page.locator('table').getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});
