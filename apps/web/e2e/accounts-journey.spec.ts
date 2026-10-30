import { expect, test } from '@playwright/test';

/**
 * Faroz accounts (owner-approved migration 2026-10-28) on the real API and database:
 * a teacher signs up with the demo checkout, creates a group, and a learner signs up and
 * joins it with the code; the teacher then sees the member. Writes two accounts and one
 * group with unique e-mails per run (test data; not removed by db:seed:demo).
 */
test('teacher signs up, creates a group; learner signs up and joins with the code', async ({ page, browser }) => {
  const run = Date.now().toString(36);

  // Teacher: signup with the demo plan step → teacher workspace.
  await page.goto('/en/signup?role=teacher');
  await page.getByLabel('Your name').fill('E2E Teacher');
  await page.getByLabel('Email').fill(`teacher-${run}@demo.tj`);
  await page.getByLabel('Password', { exact: true }).fill('longenough1');
  await page.getByRole('button', { name: /Continue|Create account/ }).first().click();
  await expect(page.getByText('Concept pricing, demo checkout. Nothing is charged.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm (demo)' }).click();
  await expect(page).toHaveURL(/\/en\/teach/);

  // Create a group and read its join code.
  await page.goto('/en/teach/classes');
  await page.getByRole('button', { name: 'Create group' }).first().click();
  await page.getByLabel('Group name').fill(`E2E group ${run}`);
  await page.getByLabel('Seats').fill('10');
  await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByText('Group created')).toBeVisible();
  const code = (await page.getByRole('dialog').innerText()).match(/[A-Z0-9]{2,4}-[A-Z0-9]{4}/)?.[0];
  expect(code).toBeTruthy();

  // Learner in another browser: signup → app → join with the code.
  const learnerContext = await browser.newContext();
  const learner = await learnerContext.newPage();
  await learner.goto('/en/signup?role=learner');
  await learner.getByLabel('Your name').fill('E2E Learner');
  await learner.getByLabel('Email').fill(`learner-${run}@demo.tj`);
  await learner.getByLabel('Password', { exact: true }).fill('longenough1');
  await learner.getByRole('button', { name: 'Create account' }).click();
  await expect(learner).toHaveURL(/\/en\/app/);
  await learner.getByLabel('Group code').fill(code!);
  await learner.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(learner.getByText('You joined the group.')).toBeVisible();
  await expect(learner.getByText(`E2E group ${run}`)).toBeVisible();
  await learnerContext.close();

  // The teacher sees the new member (server: own groups only).
  await page.goto('/en/teach/classes');
  await expect(page.getByText(`E2E group ${run}`).first()).toBeVisible();
  await page.getByRole('link', { name: 'Open class' }).first().click(); // newest group first
  await expect(page.getByText('E2E Learner')).toBeVisible();
});

test('sign-in errors: wrong password is refused without saying whether the e-mail exists', async ({ page }) => {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill('nobody-here@demo.tj');
  await page.getByLabel('Password', { exact: true }).fill('wrongpass1');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(page.getByText('Wrong email or password.')).toBeVisible();
});
