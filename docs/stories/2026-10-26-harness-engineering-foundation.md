# 2026-10-26: Harness engineering foundation

Status: **verified** for docs and tooling (links, frontmatter, JSON, lint/typecheck still green). The four subagents are discovered (see Update). **Not verified:** that they run on their configured models, and that the new permission rules prompt as intended.
Gate: G4 (process work, no product change)   Decisions: D-22 proposed

## Context

G4 started with most of the learning loop implemented but uncommitted, and the instructions had drifted: the roadmap, MVP scope, and quality standards still called the feature freeze "G3" (G3 is the approved seed loader and Content API), the README said "Next: G2, no product features", the design system said "no UI implemented", and the architecture listed routes that don't exist. There was no written workflow for planning, delegation, review, or change records, no project subagents or permission rules, and the owner's homepage vision existed only in a chat brief.

## Decisions

- **Few documents, one owner per topic.** Three engineering documents instead of the seven suggested in the brief: `HARNESS.md` (workflow, task sizing, delegation, dependencies, safety, recovery), `VERIFICATION.md` (which checks a change needs, browser checks, report format), `VISUAL_EXPERIENCE.md` (visual contract, imagery and asset rules, motion/3D plan). Quality gates stay in `quality-standards.md`, ADRs stay in `docs/01-architecture/adr/`; no duplicates were created.
- **G4 split into G4-A … G4-E** in the roadmap with acceptance criteria and real status; feature freeze is a milestone, not a gate.
- **Homepage stack recorded as Proposed D-22**, not approved: SVG + CSS core (exists), Motion for React (approved in D-01, not installed), Canvas 2D for particles if needed, React Three Fiber only after a prototype and measurement, no GSAP. Nothing installed.
- **Agents are opt-in.** Four project subagents with explicit models and read-only tools for reviewers; spawned only when the user asks or approves a plan that names them, because each one costs extra usage.
- **Guardrails through project settings**: deny file-tool access to real `.env` files and destructive Prisma commands; ask before database-writing scripts, `psql`, package installs, commits, and pushes.
- **External plugins evaluated, none installed.** Anthropic `frontend-design` and Deque Axe Accessibility offered to the owner; Playwright MCP and large audit bundles rejected as duplicates.

## Changes

- Instructions: `AGENTS.md` (product summary, current phase, command table with database impact, conventions incl. clear code, API, i18n, quiz integrity, design; gates G0–G4), `CLAUDE.md` (concise Claude Code rules, skills, agents), `README.md` (status, layout, checks).
- New docs: `docs/engineering/HARNESS.md`, `docs/engineering/VERIFICATION.md`, `docs/engineering/VISUAL_EXPERIENCE.md`, `docs/stories/README.md`, this story.
- Updated docs: `docs/README.md` (map), `docs/05-planning/roadmap.md` (gate status, G4-A…E, DoD link), `docs/01-architecture/decisions.md` (Proposed D-22), `docs/01-architecture/architecture.md` (real route list), `docs/02-design/design-system.md` (link to the visual contract, Motion not installed), `docs/00-product/mvp-scope.md` and `docs/06-quality/quality-standards.md` (feature freeze instead of "G3").
- Skills: `verify` (rewritten: change detection), `add-lesson-content` (read-only dry run allowed, prerequisite order note), new `visual-qa`, `design-review`, `new-story`.
- Agents: `.claude/agents/architect.md` (opus, read-only), `implementer.md` (sonnet), `quality-reviewer.md` (sonnet, read-only), `visual-reviewer.md` (sonnet, read-only + built-in browser tools).
- Settings: `.claude/settings.json` (permissions only).
- No application source, schema, migration, dependency, lockfile, or database change.

## Verification

| Check | Command / method | Result |
| --- | --- | --- |
| Links and anchors in all changed Markdown | Node script over every changed doc, skill, and agent file (relative paths + heading anchors) | Pass after fixing one stale anchor (`AGENTS.md#verification` in the roadmap) |
| Settings JSON | `node -e "require('./.claude/settings.json')"` | Pass (19 deny, 17 ask rules) |
| Formatting | `pnpm exec prettier --check .claude/settings.json .claude/launch.json` | Pass |
| Frontmatter | Read `name`/`model`/`tools` of every skill and agent | Pass |
| Skill discovery | Session skill list | Pass: `verify`, `add-lesson-content`, `visual-qa`, `design-review`, `new-story` all listed |
| Agent discovery | Spawned `architect` in this session | **Fail as expected**: "agent type not found"; agents load at session start. Re-check in a new session |
| Repository health | `pnpm lint`, `pnpm typecheck`, `pnpm db:validate` | Pass |
| Not run | `pnpm test`, `pnpm build` | Not needed for a docs/tooling change; both passed earlier today on the same application code |

Visual contract content checked by reading: knowledge core, connected nodes on real prerequisite data, restrained violet/teal light, purposeful motion and staged entrance, mobile composition, reduced motion, no-WebGL fallback, imagery licensing and integration, performance measurement, dependency plan.

## Implications

- Security: `.env` reads are now denied for the file tools; shell access to env files is still only a written rule.
- Design: the existing homepage (`page.tsx`, `knowledge-core.tsx`) uses hard-coded hex colours, which breaks the token rule; recorded as a G4-B gap, not changed here.
- Process: G4 status is now tracked per sub-milestone, so the gate report can say exactly what is verified.

## Known limitations and follow-ups

- Confirm the four agents run on their configured models (`opus`, `sonnet`) the first time one is used.
- Confirm in a new session that the `ask`/`deny` rules prompt as intended (for example `pnpm db:seed:dry-run` runs freely, `pnpm db:seed` asks).
- Owner decisions: D-22 (homepage libraries), installing Motion, and the two offered plugins.
- G4 work in the tree is still uncommitted on `feat/g0-g1-baseline`.
- No live visual-reference research was done; the reference board is the first G4-B task.

## Update 2026-10-26

- The four project subagents (`architect`, `implementer`, `quality-reviewer`, `visual-reviewer`) appeared in this session's agent list later the same day, so they are discoverable. None has been run yet.
- `.claude/launch.json` gained a `web-prod` entry (`next start`, :3001, `autoPort`) for browser checks while another session's `next dev` holds `apps/web`. It was started and the homepage loaded with API calls returning 200 and no console messages. `VERIFICATION.md` and the `visual-qa` skill name it.
- The Playwright smoke test passes again (`pnpm --filter @nuvora/web test:e2e`: 1 passed), as reported by a separate session that changed only `apps/web/e2e/language-and-theme.spec.ts`. The test still expected the old G1 status-page heading; it now reads the homepage headline from the message files. Diff reviewed here; the test was not re-run here.
