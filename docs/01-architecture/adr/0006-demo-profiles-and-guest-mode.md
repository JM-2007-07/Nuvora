# ADR-0006: Demo profiles and guest mode instead of accounts

- Status: **Approved** (decision D-03, owner, 2026-10-25)
- Date: 2026-10-25

## Context

Progress, attempts, and recommendations must belong to a learner (FR-AUTH-01). Real accounts (registration, passwords, reset, rate limiting) would take about two of the five available days, and they aren't needed to demonstrate the learning loop.

## Decision

There are two ways to be a learner in the MVP, and no passwords:

1. **Demo profiles.** Two or three fictional learners are seeded with realistic history (completed lessons, quiz attempts, mastery), so the progress page and Knowledge Map look meaningful right away. Anyone can pick one from a "Choose a demo learner" screen.
2. **Guest mode.** "Continue as guest" creates a new, empty learner. Starting a quiz or marking a lesson complete without a session **automatically starts guest mode**, so a learner is never blocked by a sign-in wall.

**Session mechanism:**

- The API issues a **signed, `httpOnly` cookie** containing the learner id, signed with `SESSION_SECRET`. There's no server-side session table in the MVP.
- Every `/me/*` endpoint resolves the learner from the cookie only. A request without a valid cookie gets `401 UNAUTHENTICATED`.
- "Switch learner" replaces the cookie. "Leave" clears it.
- Content endpoints (catalog, lessons, quizzes without answers) need no session.

**Demo hygiene:**

- `db:seed` resets demo profiles to their scripted history and deletes guest learners. Run it before every rehearsal and before the presentation.
- Demo history is created by running seeded answers through the **real scoring and mastery code**, so it can never contradict the rules in ADR-0004.
- The UI always shows a small "Demo" badge with the current learner's name. Demo profiles contain no real personal data.

## Consequences

- About half a day of work, with no password storage to secure.
- Anyone with access to the running app can open any demo profile. That's acceptable for a local presentation (D-10) and **not acceptable for a public deployment**. Real accounts are required before any public launch.
- Guest progress is tied to one browser cookie. Clearing cookies loses it.
- Later migration path: add `Account` (email, password hash) and a `REGISTERED` user kind. The `identity` module's guard keeps the same interface ("who is the current learner?"), so feature modules don't change.
