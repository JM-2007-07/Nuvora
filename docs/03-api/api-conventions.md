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
| `GET /me/progress?subject=` 🔒 | `Progress`: mastery and lesson completion per topic, attempt history, current recommendations | `404 SUBJECT_NOT_FOUND` |
| `PUT /me/lessons/:lessonSlug/completion` 🔒 | `LessonCompletion`, idempotent | `404 LESSON_NOT_FOUND` |

Not implemented from the outline below: `GET /subjects/:subjectSlug/map` (the topic graph is served by `GET /subjects/:subjectSlug` and `GET /me/progress`), `GET /me/attempts/:attemptId`, and `GET /me/recommendations` (recommendations are part of the attempt result and of `/me/progress`).

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
