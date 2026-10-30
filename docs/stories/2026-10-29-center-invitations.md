# 2026-10-29: Center teacher invitations and editable permissions

Status: **implemented and verified** (real database, browser on a production build, Playwright). Group creation wizard, coordinator invitations, deactivation: **not built**.
Gate: G4 (Faroz phase F5)   Design: handoff CStaff, CInvite, CSettings (§4, §5 flow 3, §7)   Decisions: D-23

## Context

The handoff's center flow includes "staff → invite teacher → invitation page → settings (permissions)". The center workspace had a read-only staff directory and fixed coordinator permissions in code (`PERMISSION_DEFAULTS`); the staff page even said inviting was "not available in this demo".

## Decisions (owner, in the chat, 2026-10-29)

- **Scope:** teacher invitations end to end and editable coordinator permissions now; the group wizard later.
- **Migration** `20261029180000_staff_invitations_permissions` (additive: `staff_invitations`, `center_permissions`). SQL shown before applying; applied with approval; SHA-256 pinned.
- **Security:** the link token is 32 random bytes; only its SHA-256 is stored and the link is shown once. Accepting needs a signed-in teacher account **with the invited email**. Links expire after 7 days; resend issues a new link and the old one stops working. The public page shows no email.
- Teacher invitations only (there is no coordinator account type). Accepting records the account; the teacher keeps their own organization and groups.
- The demo center is referenced by key (`demo-center`) because it is defined in code; center admin accounts use `org:<organizationId>`.

## Changes

- **Shared** `packages/shared/src/invitation-api.ts` (request, invitation, link, public view, token, permissions + defaults); `CenterStaff` gains `invitations` and `canInvite`; `CenterSettings` becomes editable with `updatedAt`.
- **API** `apps/api/src/invitations/`: rules (status, token, center key), `InvitationsService`, `PermissionsService` (read on every center request), controllers `center/invitations` (admin) and `invitations/:token` (public; accept needs a teacher account). Center controller and service use them; `PERMISSION_DEFAULTS` removed from `staff/demo-org.ts`.
- **Demo reset:** `db:seed:demo` deletes the demo center's invitations and permissions row.
- **Web:** Staff page rebuilt (`features/center/staff-settings.tsx`: invite dialog with the link, tabs, search, resend, revoke), editable permissions with confirmation for topic-label sharing, public page `/[locale]/invite/[token]` (`features/center/invite-page.tsx`; noindex, no referrer), sign-up and sign-in accept a safe `?next=/invite/<token>` and `?email=`. Messages in `Center.staff`, `Center.settings`, `Invite` (ru/tg AI drafts); two untrue texts replaced.

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | pass |
| `pnpm test` | api 169 unit (6 new + migration pin) + 91 e2e (7 new), web i18n parity 3 |
| `pnpm db:migrate` / `db:status` | applied; up to date |
| `pnpm db:seed:demo` | ran; demo center invitations cleared, permissions reset |
| Live API (real DB) | invite → public view without email → teacher sign-up with that email → accept → second accept 409; staff shows "accepted · Bahrom Saidov"; active teachers 3 → 4. Komila `/center/staff` 200 → 403 after the admin switched it off → 200 after switching back; Komila's own PUT 403 |
| Browser (prod build) | Staff with invite dialog (validation, link in the invitation's language), pending row with copy/resend/revoke; invitation page in ru (desktop) and tg at 390 px (no horizontal scroll); settings switches |
| Playwright (Edge, prod build, 1 worker) | 14 passed (2 new: invite → sign up from the link → accept; permission off → coordinator refused → back on) |

Not run: light theme on the new pages, a full keyboard pass, native-speaker review of the new ru/tg texts, API `pnpm build` and `seed:check` (content unchanged).

## Known limitations and follow-ups

- Running `db:seed:demo` (which runs `nest build`) stopped another chat's API watcher on :4000; this session then started its own `api` preview.
- Each check run creates teacher accounts with `*@demo.tj` e-mails; `db:seed:demo` removes invitations, not accounts.
- `teachCreate` and `teachShare` are stored and shown but not used by the teacher workspace yet (labelled in the UI).
- Not built: group creation wizard, coordinator invitations, deactivating staff, changing roles, assigning an accepted teacher to demo groups.
