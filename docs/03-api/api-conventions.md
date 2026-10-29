# API conventions

Status: conventions **Approved** (G0 baseline, owner, 2026-10-25). The resource outline at the end is a **draft for planning only**. It isn't a contract. The contract is the set of Zod schemas in `packages/shared`, written feature by feature after the data model is approved at G2.

## General

- REST over HTTPS, JSON bodies, `camelCase` field names.
- Base path: `/api/v1`. Breaking changes need a new version or a coordinated change in the same PR (both apps live in one repo).
- Resource paths are plural nouns (`/subjects`, `/quizzes/:quizId/attempts`). Use slugs for content addressed by URL and ids for learner data. Content slugs are unique per entity type, so a slug alone identifies a topic, lesson, or quiz ([data-model.md](../04-data/data-model.md#conventions)).
- The current learner is `/me` (e.g. `/me/progress`). Never put a user id in a path that the client controls.
- Timestamps are ISO 8601 UTC strings. Percentages are integers 0–100.

## Requests

- Every body, param, and query is validated with the shared Zod schema in a validation pipe. Unknown fields are rejected.
- Locale: the web app sends `Accept-Language: tg | ru | en`. If the header is missing or unsupported, the API uses `ru` (D-06). The API responds with `Content-Language`. Localized fields are already resolved to strings for that locale, using the [fallback order](../01-architecture/architecture.md#content-fallback-strategy).
- Fields that fell back to another locale are listed in a `fallbackFields` array on the containing object, so the UI can label them (FR-I18N-03). For core demo content this array is always empty.
- Learner identity: the signed `httpOnly` session cookie set by `POST /session` ([ADR-0006](../01-architecture/adr/0006-demo-profiles-and-guest-mode.md)). Clients never send a learner id.

## Responses

- Success returns the resource directly: `200` (read), `201` (created). Collections return `{ "items": [...] }`, so pagination can be added later without breaking clients. The MVP collections are small, so there's no pagination.
- Never return answer correctness, internal ids that aren't needed, or other learners' data.

## Errors

All errors use one shape:

```json
{
  "error": {
    "code": "QUIZ_NOT_FOUND",
    "message": "Quiz not found",
    "details": [{ "path": "answers.2.optionId", "code": "invalid_string" }],
    "requestId": "c0a8…"
  }
}
```

Principles:

- `code` is a stable `UPPER_SNAKE_CASE` identifier. **The web app translates codes into tg/ru/en messages.** `message` is English, for developers and logs only, and is never shown to learners.
- `details` appears only for validation errors (`400`) and lists the Zod issues by path.
- `requestId` is also logged server-side so a demo bug can be traced.
- A global exception filter maps errors. Unexpected errors return `500` with code `INTERNAL_ERROR` and no stack trace or internal message.

| HTTP | When | Example codes |
| --- | --- | --- |
| 400 | Validation failed | `VALIDATION_FAILED` |
| 401 | No valid session on a `/me/*` or attempt endpoint (the web app then starts guest mode) | `UNAUTHENTICATED` |
| 403 | Identified but not allowed | `FORBIDDEN` |
| 404 | Resource doesn't exist (or isn't visible to this learner) | `SUBJECT_NOT_FOUND`, `QUIZ_NOT_FOUND` |
| 409 | Conflicts with current state | `ATTEMPT_ALREADY_SUBMITTED` |
| 422 | Valid shape, invalid meaning | `OPTION_NOT_IN_QUESTION`, `QUIZ_INCOMPLETE` |
| 500 | Bug | `INTERNAL_ERROR` |

## Security conventions

- CORS allows only `WEB_ORIGIN`, with credentials, so the session cookie is sent. Cookies are signed, `httpOnly`, `SameSite=Lax`, and `Secure` outside localhost.
- State-changing endpoints accept only `application/json` bodies. Together with `SameSite=Lax` and strict CORS, this is the MVP's CSRF protection (adequate for a local demo, and to be revisited with real accounts).
- State-changing requests are `POST`/`PUT`/`DELETE` only. A `GET` never changes data.
- Scoring happens only on the server from stored correct answers. Client-sent correctness is ignored.

## Implemented: read-only Content API (G3.2)

The contract is the Zod schemas in [`packages/shared/src/content-api.ts`](../../packages/shared/src/content-api.ts). All responses are localized per `Accept-Language` (default `ru`), set `Content-Language` and `Vary: Accept-Language`, and include `fallbackFields` on every object. Unpublished subjects, and everything under them, answer `404`. A malformed slug answers `400 VALIDATION_FAILED`.

| Method & path | Response | Not found |
| --- | --- | --- |
| `GET /subjects` | `SubjectListResponse`: `{ items: SubjectSummary[] }` | — |
| `GET /subjects/:subjectSlug` | `SubjectDetail`: subject + ordered topics with prerequisite slugs | `SUBJECT_NOT_FOUND` |
| `GET /topics/:topicSlug` | `TopicDetail`: subject ref, prerequisites, lessons, resources, quiz summary or `null` | `TOPIC_NOT_FOUND` |
| `GET /lessons/:lessonSlug` | `LessonDetail`: Markdown body + topic ref | `LESSON_NOT_FOUND` |
| `GET /quizzes/:quizSlug` | `PublicQuiz`: questions and options with key and text only. **No correctness, no explanations** (FR-QUIZ-06) | `QUIZ_NOT_FOUND` |

## Implemented: learning-loop API (G4)

The contract is the Zod schemas in [`packages/shared/src/learning-api.ts`](../../packages/shared/src/learning-api.ts). The learner always comes from the signed `nv_session` cookie (httpOnly, `SameSite=Lax`, 30 days, [ADR-0006](../01-architecture/adr/0006-demo-profiles-and-guest-mode.md)), never from the request body or URL (FR-AUTH-02). Routes marked 🔒 answer `401 UNAUTHENTICATED` without a valid session. Localized responses follow the same `Accept-Language` rules as the Content API.

| Method & path | Response | Errors |
| --- | --- | --- |
| `GET /demo-profiles` | `{ items: DemoProfile[] }` | — |
| `GET /session` | `SessionState`: `{ learner: Learner \| null }`. Always `200`, so pages without a learner log no errors | — |
| `POST /session` | Body `{ "profile": "<demoSlug>" }` or `{ "guest": true }`. Sets the cookie, returns `Learner` | `404 DEMO_PROFILE_NOT_FOUND`, `400 VALIDATION_FAILED` |
| `DELETE /session` | `204`, clears the cookie | — |
| `GET /me` 🔒 | `Learner` | `401` |
| `POST /quizzes/:quizSlug/attempts` 🔒 | `201 AttemptResult`: score, per-question correctness and explanations, per-topic breakdown with updated mastery, up to 3 recommendations. Scored on the server in one transaction | `404 QUIZ_NOT_FOUND`, `422 QUIZ_INCOMPLETE` / `UNKNOWN_QUESTION` / `DUPLICATE_ANSWER` / `OPTION_NOT_IN_QUESTION` |
| `GET /me/progress?subject=` 🔒 | `Progress`: mastery and lesson completion per topic, each topic's first lesson and topic quiz, **before/after** per topic (the topic in the first CHECKPOINT attempt vs the latest later attempt, computed from stored answers), the subject's CHECKPOINT quizzes with the latest attempt, attempt history (kind, correct/total), current recommendations | `404 SUBJECT_NOT_FOUND` |
| `GET /me/attempts/:attemptId` 🔒 | `AttemptResult` of one of the current learner's own attempts, rebuilt from the stored answers (the same builder as `POST …/attempts`). Another learner's id answers `404` like an unknown id | `400 VALIDATION_FAILED` (not a cuid), `404 ATTEMPT_NOT_FOUND` |
| `PUT /me/lessons/:lessonSlug/completion` 🔒 | `LessonCompletion`, idempotent | `404 LESSON_NOT_FOUND` |

**Staff (teacher) endpoints** (Faroz, 2026-10-28). Demo staff are defined in code (`apps/api/src/staff/demo-org.ts`, no migration). The role comes only from the signed httpOnly cookie `fz_staff` (`staff:<slug>` signed with the session key; a learner cookie never passes). `StaffGuard` + `@Roles` enforce access on the server: no or invalid cookie → `401 UNAUTHENTICATED`, wrong role → `403 FORBIDDEN`. Contracts: `packages/shared/src/staff-api.ts`.

| Method & path | Response | Errors |
| --- | --- | --- |
| `GET /staff-profiles` | `{ items: Staff[] }` (demo staff for the chooser) | — |
| `GET /staff/session` | `{ staff: Staff \| null }`, always `200` | — |
| `POST /staff/session` | Body `{ "staff": "<slug>" }`; sets `fz_staff`, returns `Staff` | `404 STAFF_NOT_FOUND`, `400 VALIDATION_FAILED` |
| `DELETE /staff/session` | `204`, clears the cookie | — |
| `GET /teach/overview` 🧑‍🏫 | `TeacherOverview`: the teacher's own groups; `recorded: false` marks handoff reference figures (no stored attempts) | `401`, `403` |
| `GET /teach/groups/:code` 🧑‍🏫 | `GroupAnalytics` from stored attempts: topic totals, per-question correctness and option counts, students × topics, retest before/after | `403` (not your group), `404 GROUP_NOT_FOUND`, `404 GROUP_HAS_NO_RECORDS`, `400` |
| `GET /teach/groups/:code/students/:slug` 🧑‍🏫 | `StudentAnswers`: the student's attempts answer by answer (option texts) | `403`, `404 STUDENT_NOT_FOUND` |
| `GET /teach/assessments` 🧑‍🏫 | `AssessmentList`: the teacher's own assessments (`stored`), the group's diagnostic and retest computed from stored attempts (`recorded`), design figures for groups without stored answers (`reference`, read-only); the "suggested from your gaps" draft and the retest question most students missed; the groups the teacher can assign to | `401`, `403` |
| `POST /teach/assessments` 🧑‍🏫 | Body `AssessmentDraft` (may be incomplete); `201 Assessment` | `403` (not your group), `400 VALIDATION_FAILED` |
| `GET` / `PUT /teach/assessments/:id` 🧑‍🏫 | `Assessment` (with correct options: owner only). `PUT` saves a draft, or edits a scheduled one before it opens (it must stay publishable) | `404 ASSESSMENT_NOT_FOUND` (missing or someone else's), `409 ASSESSMENT_LOCKED` (live or closed), `422 PUBLISH_CHECKS_FAILED` |
| `POST /teach/assessments/:id/publish` 🧑‍🏫 | Runs `assessmentChecks()` (shared with the builder) on the server; `200 Assessment` scheduled or live | `422 PUBLISH_CHECKS_FAILED` (`details`: failing checks), `409 ALREADY_PUBLISHED` |
| `POST /teach/assessments/:id/unschedule` 🧑‍🏫 | Back to a draft, only before it opens | `409 NOT_SCHEDULED` |
| `POST /teach/assessments/:id/duplicate` 🧑‍🏫 | New draft from a stored assessment or from a recorded row (`rec-<group>-diagnostic\|retest`); `201 Assessment` | `404`, `403` |
| `DELETE /teach/assessments/:id` 🧑‍🏫 | `204`; drafts only | `409 NOT_A_DRAFT` |
| `GET /teach/bank?group=&topic=` 🧑‍🏫 | `{ items: BankQuestion[] }`: seeded diagnostic and topic-quiz questions as builder questions (code split out), with how the group answered them | `403`, `400` |
| `GET /center/overview` 🏢 | `CenterOverview`: org totals and every group as aggregates (`CenterGroup`: totals, participation, topic %, flags, `recorded`/`synthetic`) | `401`, `403` (teacher) |
| `GET /center/groups/:code` 🏢 | `CenterGroupDetail`: group totals + participation (name, took the diagnostic yes/no). Never scores, answers, retest or practice membership | `403`, `404 GROUP_NOT_FOUND`, `400` |
| `GET /center/staff` 🏢 | `CenterStaff`: the demo directory, the center's stored `invitations` (status derived: pending, accepted, declined, expired, revoked) and `canInvite` (admin only). Coordinator needs `coordStaff` | `401`, `403` |
| `POST /center/invitations` 🏢 admin | Body `InviteRequest` (name, email, subject, locale; teacher role only); `201 InvitationLink`: the invitation and the link token, shown once (only its SHA-256 is stored). Expires in 7 days. No email is sent | `403`, `400`, `409 INVITATION_EXISTS` (open invitation for that email) |
| `POST /center/invitations/:id/resend` 🏢 admin | New token (the old link stops working), new 7-day expiry; `200 InvitationLink` | `404 INVITATION_NOT_FOUND` (missing or another center's), `409 INVITATION_ACCEPTED` / `INVITATION_REVOKED` |
| `POST /center/invitations/:id/revoke` 🏢 admin | Pending or expired only; `200 Invitation` | `404`, `409` |
| `GET /invitations/:token` | Public: `PublicInvitation` (center, invitee name, role, subject, inviter, expiry, status). Never the email | `404 INVITATION_NOT_FOUND`, `400` |
| `POST /invitations/:token/decline` | Public, pending only; `200 PublicInvitation` | `404`, `409 INVITATION_<STATUS>` |
| `POST /invitations/:token/accept` 🧑‍🏫 account | A signed-in **teacher account** whose email matches; conditional update (no double accept); `200 PublicInvitation` | `401`, `403 ACCOUNT_REQUIRED` / `EMAIL_MISMATCH`, `409 INVITATION_<STATUS>` / `INVITATION_CHANGED` |
| `GET /center/group-wizard` 🏢 | `GroupWizardOptions`: subjects, the center's teachers (`available: false` for reference teachers), unassigned students, taken codes. Coordinator needs `coordGroups` | `401`, `403` |
| `POST /center/groups` 🏢 | Body `CreateCenterGroupRequest` (code `B-18`, subject, schedule, start date, capacity 4–40, languages, teacher key or null, student ids ≤ capacity); one transaction; `201 StudyGroupView` with a join code. The teacher sees it in `/teach/my-groups` | `403`, `400`, `409 CODE_TAKEN` / `CENTER_NOT_READY`, `422 TEACHER_NOT_IN_CENTER` / `STUDENT_NOT_AVAILABLE` / `SUBJECT_NOT_FOUND` |
| `GET /center/settings` 🏢 admin | `CenterSettings`: permissions from `center_permissions` (handoff defaults when no row), `editable`, `updatedAt` | `403` for coordinator and teacher |
| `PUT /center/settings/permissions` 🏢 admin | Body `CenterPermissions`; read by every center handler on the next request | `403`, `400` |

Not implemented from the outline below: `GET /subjects/:subjectSlug/map` (the topic graph is served by `GET /subjects/:subjectSlug` and `GET /me/progress`) and `GET /me/recommendations` (recommendations are part of the attempt result and of `/me/progress`).

## Implemented: communications API (Faroz)

Chat, voice messages and calls (D-24). The contract is [`packages/shared/src/comms-api.ts`](../../packages/shared/src/comms-api.ts), shared by the web app, the API and the planned React Native app.

**Auth and access**
- On the web, the session cookie authenticates (`nv_session` for a learner, `fz_staff` for a teacher).
- On mobile, `Authorization: Bearer <signed session value>` for REST, or `auth.token` for the socket.
- Teachers reach the learners of their groups; learners reach their teachers. Group chats follow the group roster.
- Centers (admins, coordinators) get `403 COMMS_NOT_AVAILABLE`.
- Someone outside a conversation gets `404`, as if it did not exist.

| Method & path | Response | Errors |
| --- | --- | --- |
| `GET /comms` | `CommsOverview`: me, contacts (with online state), conversations (groups always, direct ones once used; newest first, unread counts, active call), WebRTC ICE servers | `401`, `403 COMMS_NOT_AVAILABLE` |
| `POST /comms/direct` | Body `{ participantKey }` → `{ id }`. Opens or creates the direct conversation | `404 CONVERSATION_NOT_FOUND` (not a contact) |
| `GET /comms/conversations/:id/messages?before=&limit=` | `MessagesPage`: oldest first, `hasMore` for older pages | `404` |
| `POST /comms/conversations/:id/messages` | Body `{ text }` (1–4000 characters) → `201 Message`, also pushed live | `400`, `404` |
| `POST /comms/conversations/:id/voice` | multipart: `audio` (webm/ogg/mp4/aac, ≤ 2 MB) and `durationMs` (0.3 s – 3 min) → `201 Message` | `400 VOICE_*`, `404` |
| `GET /comms/messages/:id/voice` | The audio bytes (members only) | `404` |
| `POST /comms/conversations/:id/read` | `204`; my unread count drops to 0 on all my devices | `404` |

**Live connection:** Socket.IO namespace `/comms`, path `/realtime`, on the API port. The browser connects to the API directly, because Next rewrites do not carry WebSockets. CORS allows the web origin and local ports.

Server → client events:
- `message:new`
- `conversation:read`
- `typing`
- `presence`
- `call:incoming`, `call:updated`, `call:ended`, `call:dismissed`
- `call:peer-joined`, `call:peer-left`
- `call:signal`, `call:media`

Client → server events take acknowledgements `{ ok, ... }`:
- `typing`
- `call:start` (it returns the running call if there is one), `call:join`, `call:decline`, `call:leave`
- `call:signal`: SDP and ICE, relayed only between peers of the same call.
- `call:media`: mic, camera and screen flags.

**Calls**
- Calls are peer to peer (WebRTC mesh).
- Whoever joins sends the offer to each peer already in the call.
- Each connection carries one audio and one video transceiver, so the camera and screen sharing are switched with `replaceTrack`.
- An unanswered call stops ringing after 45 s and is logged as missed.
- A direct call ends when either side leaves; a group call ends when the last person leaves.
- Optional STUN/TURN for calls across networks: `COMMS_ICE_SERVERS` (JSON) in the API environment.

**React Native**
- The same REST and socket contract: `socket.io-client` and `react-native-webrtc` (the same `RTCPeerConnection` API).
- Authenticate with the token.
- Set `COMMS_ICE_SERVERS` (TURN), because phones are rarely on the same network.

## Draft resource outline (not a contract)

Listed to plan the work and check that the data model supports the journeys. Exact shapes are defined in `packages/shared` per feature.

| Method & path | Purpose | Requirement |
| --- | --- | --- |
| `GET /subjects` | List published subjects | FR-CAT-01 |
| `GET /subjects/:subjectSlug` | Subject with ordered topics (+ learner status if identified) | FR-CAT-02 |
| `GET /subjects/:subjectSlug/map` | Topics, positions, prerequisite edges, learner status | FR-MAP-01..02 |
| `GET /topics/:topicSlug` | Topic with lessons, prerequisites, resources, quiz reference | FR-CAT-03, FR-RES-01 |
| `GET /lessons/:lessonSlug` | Lesson content | FR-LES-01 |
| `PUT /me/lessons/:lessonSlug/completion` | Mark lesson complete (idempotent) | FR-LES-02 |
| `GET /quizzes/:quizSlug` | Quiz with questions and options, **without correctness** | FR-QUIZ-01, 06 |
| `POST /quizzes/:quizSlug/attempts` | Submit answers → score, per-question explanations, per-topic breakdown, recommendations | FR-QUIZ-02..05, FR-ADAPT-01..03 |
| `GET /me/attempts/:attemptId` | Re-open a past result | FR-QUIZ-03 |
| `GET /me/progress` | Mastery per topic, completed lessons, attempt history | FR-PROG-01..02, FR-JOUR-01 |
| `GET /me/recommendations?subject=` | Current recommendations | FR-ADAPT-02 |
| `GET /demo-profiles` | List demo learners (slug, display name, short description) | FR-AUTH-01 |
| `POST /session` | Body `{ "profile": "<demoSlug>" }` or `{ "guest": true }`. Sets the session cookie and returns the learner | FR-AUTH-01 |
| `GET /me` | Current learner (`kind`, `displayName`), or `401` | FR-AUTH-03 |
| `DELETE /session` | Leave: clears the cookie | FR-AUTH-03 |
