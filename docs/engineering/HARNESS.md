# Harness: how work is done in Nuvora

Status: **Adopted 2026-10-26** (process document, no product decision). This is the authoritative document for the agent and contributor workflow: task sizing, planning, delegation, review, stories, and handoff. Commands and approval gates stay in [AGENTS.md](../../AGENTS.md). Checks are in [VERIFICATION.md](VERIFICATION.md). Quality gates are in [quality-standards.md](../06-quality/quality-standards.md#quality-gates).

The harness exists so that any agent can pick up a task, find the right context in minutes, change only what the task needs, prove the result, and leave a trail the next person can follow.

## The workflow

```text
intake → context → plan → implement → verify → review → story → handoff
```

| Step | What happens | Output |
| --- | --- | --- |
| **Intake** | Restate the task in one or two sentences. Name the gate it belongs to ([AGENTS.md](../../AGENTS.md#approval-gates)) and the requirement IDs it claims ([requirements.md](../00-product/requirements.md)). If it falls outside the current gate, stop and ask | Task statement |
| **Context** | Read only what the task touches: the [docs map](../README.md), the authoritative doc for the area, and the files involved. Don't re-read the whole repository. Check `git status` first, because uncommitted work may be someone else's | Short list of docs and files |
| **Plan** | Only for tasks above "small" (below). Scope, acceptance criteria, files to touch, dependencies, risks, how it will be verified | A short checklist in the chat or the task list |
| **Implement** | Small vertical slices (data → API → UI for one feature). Clear, direct code over abstraction. Follow the conventions in [AGENTS.md](../../AGENTS.md#coding-conventions) | Code + tests + docs in the same change |
| **Verify** | Run the checks [VERIFICATION.md](VERIFICATION.md) selects for the change (the `verify` skill). UI changes also get a browser check | Command list with real results |
| **Review** | Independent review when the task meets the review threshold (below) | Findings with severity and `file:line` |
| **Story** | A dated story when the change meets the story threshold ([stories/README.md](../stories/README.md)) | `docs/stories/YYYY-MM-DD-*.md` |
| **Handoff** | Report what changed, what was verified, what was not, and what is next. Never "done" with a failing or skipped check | Final report |

## Task size

| Size | Examples | Plan | Review | Story |
| --- | --- | --- | --- | --- |
| **Small** | Typo, one translation fix, one-file bug fix, a test for existing behaviour | No | No | No (group it into the next story if it matters) |
| **Medium** | One feature slice in one or two workspaces, a new endpoint with tests, a new page | Short checklist | Self-review against the [quality gates](../06-quality/quality-standards.md#quality-gates) | Yes, if behaviour or a contract changed |
| **Large** | Cross-workspace features, homepage visual work, schema changes, new dependencies, anything at a gate | Plan with acceptance criteria, approved in the chat before implementation | Independent review (reviewer agent or `/code-review`, plus `/security-review` for auth, input, or data handling) | Yes |

Hard-to-reverse steps always need the owner's explicit approval, whatever the size: see [Actions that need approval](#actions-that-need-approval).

## Delegation and the agent team

Project subagents live in [`.claude/agents/`](../../.claude/agents/). They are Claude Code subagents: each runs in its own context with its own model and tool list, and reports back to the main agent. They are not claude.ai chat collaborators, plugins, or skills.

| Agent | Model | Tools | Use it for |
| --- | --- | --- | --- |
| `architect` | `opus` | Read-only (Read, Grep, Glob, Bash for read-only commands) | Planning large tasks: units of work, dependencies, risks, acceptance criteria. Guards scope and the visual contract |
| `implementer` | `sonnet` | Full | A bounded, already-planned unit with clear acceptance criteria and a fixed file list |
| `quality-reviewer` | `sonnet` | Read-only + Bash for checks | Independent review of a finished change: regressions, security, tests, API contract, i18n, a11y |
| `visual-reviewer` | `sonnet` | Read-only + the built-in browser tools | Review of UI against [VISUAL_EXPERIENCE.md](VISUAL_EXPERIENCE.md). Never edits code |

Rules:

- **The main agent coordinates.** It keeps the shared context, integrates results, runs the final verification, and writes the report and story. Browser checks and gate reports stay with the main agent unless a reviewer is asked for a second opinion.
- **Delegate only when it pays.** Use a subagent for independent parallel units or an independent review at a gate. Don't route every task through every agent, and never give two agents the same task or the same files.
- **Each delegation is bounded:** scope, files it may touch, acceptance criteria, and the report expected back (files changed, checks run with results, open issues).
- **Cost.** Every subagent starts cold and re-reads context. Agents are spawned when the user asks for them or approves a plan that names them. Propose delegation in the plan; don't spawn silently.
- **Loading.** New agent files are not picked up immediately: on 2026-10-26, spawning `architect` right after creating it failed with "agent type not found", and the four agents appeared in the same session's agent list only later. If an agent is missing, start a new session. Skills were picked up at once.
- **Verified 2026-10-26:** all four agents launched and completed a bounded read-only task. Each reported its own model (`architect`: Opus 5.5; the other three: Sonnet 5.5), matching the `model` fields. That is the agents' self-report: the harness exposed no model metadata (the task output files were empty), so treat it as consistent but not independently confirmed.
- **Models.** The `model` field in each agent file selects the model for that agent, independent of the main conversation's model. `opus` for planning and high-risk reasoning, `sonnet` for bounded implementation and reviews. Model availability depends on the account; if a model is unavailable, Claude Code reports it when the agent is spawned.

Built-in capabilities to reuse instead of new agents: `/code-review` (correctness review of a diff, once per gate), `/security-review` (security review of pending changes), `/simplify` (clean-up pass), the built-in browser (`mcp__Claude_Browser__*`) and Playwright for UI checks.

## Project skills

Skills live in [`.claude/skills/`](../../.claude/skills/) and are invoked as `/<name>` or picked by Claude from their description.

| Skill | Use |
| --- | --- |
| `verify` | Pick and run the checks a change needs, report results honestly |
| `add-lesson-content` | Add or change seed content safely in tg/ru/en |
| `visual-qa` | Check a running page across viewports, locales, themes, motion, keyboard |
| `design-review` | Compare a UI proposal or implementation with the visual contract |
| `new-story` | Create or update a dated story from real changes and real evidence |

Add a skill only for a task that repeats and has project-specific steps. Don't duplicate a built-in command.

### External skills and tools (evaluated 2026-10-26)

Nothing external was installed. Candidates from the Anthropic plugin directory, for the owner to install from claude.ai if wanted:

| Plugin | Source | Use for Nuvora | Notes |
| --- | --- | --- | --- |
| `frontend-design` | Anthropic, `anthropics/claude-plugins-official` (`plugins/frontend-design`) | General guidance against generic UI during G4-B | Skill only, no tools or network. Our `design-review` stays the authority on Nuvora's contract |
| Axe Accessibility | Deque Systems (partner), `dequelabs/axe-accessibility` | Automated WCAG scans inside `visual-qa` | Adds an MCP server: review its permissions before enabling |

**UI/UX Pro Max**: installed 2026-10-26 with the owner's approval, project-scoped. Source: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), MIT.

- **Install method:** `npx ui-ux-pro-max-cli@2.15.0 init --ai claude` in the repository root. It is the official CLI, pinned, and runs from the npm cache without a global install. Version 2.15.0 has no `--dry-run`. The package was downloaded first, its checksum checked against the registry, and its code read: it works offline from bundled files and writes only into `.claude/skills/`.
- **Installed:** `.claude/skills/ui-ux-pro-max/` (68 files: `SKILL.md`, `data/` reference tables, `scripts/` with Python standard-library search scripts). The installer also created six sibling skills (`banner-design`, `brand`, `design-system`, `design`, `slides`, `ui-styling`). They were removed after checking they were new, untracked, and identical to the package. They overlap our brand and design-system documents, and some include scripts that write token files or add shadcn components.
- **Invocation:** explicit only. `.claude/settings.json` sets `"skillOverrides": { "ui-ux-pro-max": "user-invocable-only" }` (a supported value in this Claude Code version's settings schema). Claude doesn't pick it up on its own; `/ui-ux-pro-max` works. It needs Python 3; on Windows the scripts run as `python` (3.13 here).
- **Use in G4-B:** targeted lookups only, for example `--domain ux` for an accessibility or interaction question, or `--stack nextjs`/`--stack shadcn` for implementation notes. Weigh every result against [VISUAL_EXPERIENCE.md](VISUAL_EXPERIENCE.md), [HOMEPAGE_BRIEF.md](HOMEPAGE_BRIEF.md), and D-22; findings go into `visual-qa`/`design-review` reports, which stay our review workflows.
- **Never:** `--design-system`, `--persist`, or `--force`. They would generate a competing palette and typography, and write `design-system/<project>/MASTER.md`. No GSAP, even though the skill ships GSAP presets.
- **Local addition at risk:** a Nuvora rules block at the top of its `SKILL.md` repeats these limits. `uipro update` or `uipro init --force` regenerates that file and removes the block, and `uipro init` would recreate the six sibling skills. After any update, re-add the block and remove the siblings again.

Not recommended: a Playwright MCP plugin (duplicates the built-in browser and our Playwright setup), and large community "audit suite" bundles (overlap with `/code-review`, `/security-review`, and our skills). After installing a plugin, check that its skills appear in the session's skill list before relying on them.

## Dependencies

- Add a dependency only for a stated need that existing code or approved libraries can't meet. Prefer the platform (CSS, SVG, Canvas) and what is already installed.
- Check before adding: maintenance, licence, size (bundle cost for `apps/web`), install scripts (pnpm blocks them; see `allowBuilds` in `pnpm-workspace.yaml`), and compatibility with the [pinned toolchain](../../AGENTS.md#pinned-toolchain-g1-2026-10-25).
- Installing anything needs the owner's approval in the chat. Architectural libraries also need a [decision entry](../01-architecture/decisions.md). Pin exact versions for runtime libraries with architectural impact.
- The plan for the visual milestone's libraries is in [VISUAL_EXPERIENCE.md](VISUAL_EXPERIENCE.md#dependency-plan).

## Safety

- **Secrets.** Never read, print, or copy `.env*` values (only `.env.example`). Project settings ([`.claude/settings.json`](../../.claude/settings.json)) deny the file tools access to real `.env` files. Shell commands are not covered by that rule, so never `cat` or `type` an env file either.
- **Database.** `db:migrate`, `db:seed`, `db:seed:demo`, Prisma CLI commands, and `psql` ask for confirmation through project settings. `prisma migrate reset` and `prisma db push` are denied. Read-only commands (`seed:check`, `db:validate`, `db:status`, `db:seed:dry-run`) are fine.
- **Git.** No commits, pushes, branch changes, or PRs unless the user asks in the current session. `git push` and `git commit` ask for confirmation.
- **Other people's work.** Uncommitted changes in the tree are someone's work. Don't revert, reformat, or "clean up" files outside the task.

## Actions that need approval

Ask in the chat and wait for a clear yes before: moving past a gate · schema changes or new migrations · writing to, resetting, or deleting database data · installing or upgrading packages · editing `.env*` · changing an **Approved** decision · removing an MVP requirement · creating database roles or changing PostgreSQL/firewall configuration · committing, pushing, branching, or opening PRs.

## Recovery

When something fails or is left unfinished:

1. Report it plainly with the failing command and the first relevant error lines (`file:line`).
2. Leave the tree in a state the next person can reason about: no half-applied renames, no disabled tests.
3. Record the open item with a concrete next step, in the story for the change (or the final report if no story is needed).
4. A regression found later gets its own fix and, if it changed behaviour, a short story that links the original one.

## Efficiency

- Read the docs map and the one authoritative doc, not every document.
- Run the narrowest checks that cover the change while iterating ([VERIFICATION.md](VERIFICATION.md#choose-the-checks)), and the full set once before handoff.
- `pnpm build` and Playwright are the slow steps: run them once per change, not after every edit.
- Prefer one well-scoped agent to several overlapping ones.
