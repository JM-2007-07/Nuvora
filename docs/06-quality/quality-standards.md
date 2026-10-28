# Quality standards

Status: **Approved** (G0 baseline, owner, 2026-10-25). This is the authoritative document for testing, accessibility, performance, security, and quality gates. Workflow commands are in [AGENTS.md](../../AGENTS.md). Which checks a given change needs, and how to report them, is in [VERIFICATION.md](../engineering/VERIFICATION.md).

## Test strategy

Testing effort goes where a bug would break the demo or mislead a learner.

| Level | What | Tool (D-11) | MVP expectation |
| --- | --- | --- | --- |
| Unit | Scoring, mastery classification, recommendation ordering (including the [demo storyline example](../01-architecture/adr/0004-rule-based-mastery-and-recommendations.md)), locale fallback, seed integrity checks | Vitest (`apps/api`) | **Required.** Table-driven tests with fixtures, including edge cases (no answers, all wrong, all right, topic with a weak prerequisite, missing translation) |
| API integration | `POST /quizzes/:slug/attempts`, `/me/progress`, and `POST /session` against the `nuvora_test` database: correct scoring, no answer leakage, learner isolation (one guest can't read another's data), `401` without a session | Vitest + Supertest (NestJS 12 default) | **Required** for attempt, progress, and session endpoints. Optional elsewhere |
| i18n | Every message key exists in tg, ru, en. Tajik dates and percentages render the same on server and client (D-19) | `node --test` in `apps/web` | **Required** |
| Contract | Shared Zod schemas parse real API responses | Shared schemas used in the web client | Enforced at runtime in development |
| UI / E2E | Journey J2 in one locale | Manual demo script. Playwright smoke if time allows | Manual script run on Fri Oct 30 in all 3 locales × 2 themes |

The manual demo script (to be written by Thursday) is a numbered checklist of J2 steps with expected results. Two different people run it before the presentation.

## Accessibility

Target: **WCAG 2.2 level AA** for everything in the demo path.

- Semantic HTML first: real `<button>`, `<a>`, headings in order, and `<main>`/`<nav>` landmarks. shadcn/ui (Radix) primitives provide the focus and ARIA behaviour. Don't override it.
- **Keyboard:** every action works without a mouse. Quiz options are a radio group (arrow keys + Space/Enter). Map nodes are focusable links. Focus is always visible (`--nv-focus-ring`).
- **Contrast:** text ≥ 4.5:1 (≥ 3:1 for large text and UI boundaries). The token pairings in `assets/brand/tokens.css` are pre-checked. Teal and Cool Gray are **not** text colours on light backgrounds.
- **Not colour alone:** quiz correctness and mastery status always pair colour with an icon and a text label.
- **Language:** `<html lang>` matches the active locale. Content blocks that fell back to another language get their own `lang` attribute.
- **Motion:** honour `prefers-reduced-motion` (Motion's `useReducedMotion`). Nothing flashes, and no animation is required to understand content.
- **Images:** logos and meaningful images have alt text. Decorative ones have `alt=""`.
- Check: keyboard-only pass + browser accessibility audit (Lighthouse/axe in DevTools) on each MVP page before the feature freeze.

## Performance

The demo runs on a laptop, but learners use phones, so the targets are modest and checkable.

- Lighthouse (mobile) on lesson and quiz pages: **Performance ≥ 85, Accessibility ≥ 95** on a production build.
- Content pages are server-rendered (see [architecture](../01-architecture/architecture.md#data-fetching)). A lesson page shouldn't need client JS to read.
- Load fonts with `next/font` (self-hosted at build time, `display: swap`), only the weights used: Inter with subsets `latin`, `cyrillic`, `cyrillic-ext` (needed for Tajik), and Poppins 400 `latin` for the tagline only. Self-hosting also means the demo doesn't need internet access for fonts.
- Motion: import only what's used. Animate `transform`/`opacity` only.
- No heavy client libraries on the demo path without a decision entry (the map uses plain SVG, D-09).
- API: demo-path endpoints respond in < 300 ms locally. Avoid N+1 queries (use Prisma `include`/`select`).

## Security

- **Secrets:** only in git-ignored `.env`. A `.env.example` lists names with placeholders. No secrets in code, docs, seed files, or screenshots. Rotate anything that leaks, even briefly.
- **Input validation:** Zod on every request, env var, and seed file. Reject unknown fields.
- **Authorization:** every `/me/*` handler derives the learner from the session, never from client input (FR-AUTH-02). Integration tests cover cross-learner access.
- **Integrity:** quiz correctness is never sent before submission. Scoring is server-side only (FR-QUIZ-02, 06).
- **Sessions/cookies:** `httpOnly`, `SameSite=Lax`, `Secure` outside localhost, signed with `SESSION_SECRET` (a long random value in `.env`, never committed). There are no passwords in the MVP (D-03). Demo profiles are open to anyone using the app, so **the MVP must not be deployed publicly** ([ADR-0006](../01-architecture/adr/0006-demo-profiles-and-guest-mode.md)).
- **Local database:** the app connects as a dedicated `nuvora` role with access only to `nuvora_dev` and `nuvora_test`, never as `postgres`. Checked 2026-10-25: the local PostgreSQL service listens on **all network interfaces** (`0.0.0.0:5432`). Before presenting on shared or venue Wi-Fi, either set `listen_addresses = 'localhost'` or make sure the Windows firewall blocks port 5432 from the network. That is the owner's change to make; AI agents don't edit system configuration.
- **Content rendering:** Markdown is rendered without raw HTML (D-12). External links use `rel="noopener noreferrer"`.
- **Database:** only through Prisma (parameterized). No string-built SQL.
- **Errors:** no stack traces or internal messages in responses ([api-conventions.md](../03-api/api-conventions.md#errors)).
- **Dependencies:** install only from the official npm registry. Review new packages (maintenance, downloads, licence) before adding them. Run `pnpm audit` (or `npm audit`) before the feature freeze.
- **Privacy:** collect only what the feature needs. Demo profiles contain no real personal data.

## Quality gates

A PR can merge only when all of these hold:

| # | Gate | How it's checked |
| --- | --- | --- |
| Q1 | Lint, typecheck, tests, build pass | Root scripts ([AGENTS.md](../../AGENTS.md#commands)) |
| Q2 | Logic changes have unit tests | Review |
| Q3 | No missing i18n keys in tg/ru/en | i18n key test |
| Q4 | Works in light + dark, 360 px+, keyboard | Author's manual check (PR template) |
| Q5 | No secrets, no unjustified dependencies | Review + PR template |
| Q6 | Docs updated if behaviour/decisions changed | Review + PR template |

**Release gate (Fri Oct 30):** Q1–Q6 on `main`, **Tajik copy review** (a Tajik-speaking teammate has reviewed every Tajik UI string and all core demo content, and no content file still marks `tg` as `needs-review`), demo reset run, manual demo script passed by two people in all locales and both themes **with the network disconnected** (the demo is local, D-10), Lighthouse targets met on lesson and quiz pages, backup video recorded.

There is no CI service yet. Gates run locally. Adding GitHub Actions to run Q1 automatically is a good post-G1 improvement, but it's not required for the MVP.
