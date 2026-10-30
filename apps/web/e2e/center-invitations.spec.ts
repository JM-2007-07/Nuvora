import { expect, test } from '@playwright/test';

/**
 * Center invitations and permissions (handoff CStaff, CInvite, CSettings) on the real
 * API and database. Writes one invitation and one teacher account per run with unique
 * e-mails (test data; `pnpm db:seed:demo` removes the demo center's invitations, not
 * accounts). The permission test switches a permission off and back on.
 */
test('admin invites a teacher; the teacher signs up from the link and accepts', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const run = Date.now().toString(36);
  const email = `invited-${run}@demo.tj`;

  // Center admin: Staff → Invite teacher → link.
  await page.goto('/en/center/staff');
  await page.getByRole('button', { name: /Farhod Jalilov/ }).click();
  await page.getByRole('button', { name: 'Invite teacher' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('E2E Invitee');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Subject').fill('Python');
  await dialog.getByLabel('Invitation language').selectOption('en');
  await dialog.getByRole('button', { name: 'Create invitation' }).click();
  await expect(dialog.getByRole('heading', { name: 'Invitation ready' })).toBeVisible();
  const link = (await dialog.innerText()).match(/https?:\/\/\S+\/en\/invite\/[A-Za-z0-9_-]{43}/)?.[0];
  expect(link).toBeTruthy();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: email })).toContainText('Invitation pending');

  // The invited teacher, in another browser: open the link → create an account → back → accept.
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await teacher.goto(link!);
  await expect(teacher.getByRole('heading', { name: 'You’re invited to teach at Faroz Demo Center' })).toBeVisible();
  await expect(teacher.getByText('E2E Invitee')).toBeVisible();
  await teacher.getByRole('link', { name: 'Create teacher account' }).click();
  await teacher.getByLabel('Your name').fill('E2E Invitee');
  await teacher.getByLabel('Email').fill(email);
  await teacher.getByLabel('Password', { exact: true }).fill('longenough1');
  await teacher.getByRole('button', { name: /Continue|Create account/ }).first().click();
  await teacher.getByRole('button', { name: 'Confirm (demo)' }).click();
  await expect(teacher).toHaveURL(/\/en\/invite\//);
  await expect(teacher.getByText(`Signed in as E2E Invitee · ${email}`)).toBeVisible();
  await teacher.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(teacher.getByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
  await teacherContext.close();

  // The admin sees the teacher as active staff.
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: email })).toContainText('Active');
  expect(errors).toEqual([]);
});

test('a permission switched off by the admin is refused by the server for the coordinator', async ({ page, browser }) => {
  await page.goto('/en/center/settings');
  await page.getByRole('button', { name: /Farhod Jalilov/ }).click();
  const staffSwitch = page.getByRole('switch', { name: /Coordinators can see staff/ });
  await expect(staffSwitch).toBeChecked();
  await staffSwitch.uncheck();
  await page.getByRole('button', { name: 'Save permissions' }).click();
  await expect(page.getByText(/^Saved \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();

  const coordinatorContext = await browser.newContext();
  const coordinator = await coordinatorContext.newPage();
  await coordinator.goto('/en/center/staff');
  await coordinator.getByRole('button', { name: /Komila Rasulova/ }).click();
  await expect(coordinator.getByRole('heading', { name: 'You don’t have access to this page' })).toBeVisible();
  expect((await coordinator.request.get('/api/v1/center/staff')).status()).toBe(403);

  // Put it back for the demo.
  await staffSwitch.check();
  await page.getByRole('button', { name: 'Save permissions' }).click();
  await expect(page.getByRole('button', { name: 'Save permissions' })).toBeDisabled();
  expect((await coordinator.request.get('/api/v1/center/staff')).status()).toBe(200);
  await coordinatorContext.close();
});
