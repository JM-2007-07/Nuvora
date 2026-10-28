# CLAUDE.md

Repository conventions are in AGENTS.md and apply in full:

@AGENTS.md

## Claude Code specifics

- **Read before writing.** Start each task by reading the authoritative doc for the area (map in `docs/README.md`), not the whole repository. Treat it as the spec. If code and docs disagree, stop and ask which is right.
- **Stay inside the current gate** (AGENTS.md, roadmap G4-A … G4-E). Never move past a gate without explicit approval in the chat.
- **Size the task** per `docs/engineering/HARNESS.md`: small tasks just get done and verified; medium tasks get a short checklist; large or hard-to-reverse work gets a plan approved in the chat first.
- **Never** commit, push, change branches, open PRs, install packages, write to the database, or touch `.env*` files unless the user asks for that specific action in the current session. Project settings (`.claude/settings.json`) back this up with deny/ask rules.
- **Proposed ≠ approved.** Build on Proposed decisions only where they are cheap to reverse. D-22's 3D libraries are conditional, not approved. Flag them in your summary.
- **Verify, then report.** Use the `verify` skill (`docs/engineering/VERIFICATION.md`). Report what was run, what passed, and what was not verified.
- **Visual work** follows `docs/engineering/VISUAL_EXPERIENCE.md`: the luminous knowledge core, never a generic card grid. Brand assets in `assets/brand/` are the source of truth; don't redraw them unless asked (`docs/02-design/BRAND_GUIDELINES.md`).
- **Record significant changes** as dated stories (`new-story` skill, `docs/stories/README.md`).

## Design: Faroz (since 2026-10-28)

The product is now **Faroz** (D-23); "Nuvora" never appears anywhere visible. Older docs that still describe the Nuvora brand or the knowledge-core homepage (BRAND_GUIDELINES, design-system, VISUAL_EXPERIENCE, HOMEPAGE_BRIEF) are superseded where they conflict.

- **Spec:** `docs/02-design/FAROZ_HANDOFF.md` (screen map, components, roles, demo data, build order). Screenshots, artboards and demo JSON are in the untracked `faroz-handoff/faroz-handoff/design/`; compare every page with its screenshot at 1440 and 390 px, dark and light.
- **Tokens and fonts:** only the variables from `assets/brand/faroz/tokens.css` (copied to `apps/web/src/styles/faroz-tokens.css`); never hand-written colours. Unbounded for headings, buttons and the wordmark, Inter for text.
- **Theme:** dark by default; sun/moon toggle; the choice persists (`faroz-theme`, `data-theme` on `<html>`).
- **Logo:** files from `assets/brand/faroz/` (copied to `apps/web/public/brand/`); header and sidebar use the symbol plus the name as live text.
- **Demo numbers and names:** only from the handoff's `design/data/*.json`; never invented.
- **Permissions are checked on the server** (route handlers, server actions, guards); client checks are UI only.
- **Privacy:** students see their own results; teachers see their groups answer by answer; **centers see group totals and participation only**, never individual scores or answers, and never who got targeted practice.
- Restyle working pages instead of rewriting their logic.

## Skills, agents, and reviews

Project skills (`.claude/skills/`), invoked as `/<name>`:

- `verify`: choose and run the checks a change needs, report honestly.
- `add-lesson-content`: add or change localized seed content safely.
- `visual-qa`: check running pages across viewports, locales, themes, motion, keyboard.
- `design-review`: compare a UI proposal or implementation with the visual contract.
- `new-story`: create or update a dated story from the real diff and real check output.
- `ui-ux-pro-max` (third-party, v2.15.0, explicit `/ui-ux-pro-max` only): reference data for UX patterns, accessibility, and stack notes. Nuvora's docs and D-22 win; never its `--design-system`/`--persist` (no second design system or `MASTER.md`), no GSAP. A CLI update regenerates its `SKILL.md` and drops our Nuvora block: re-add it.

Project subagents (`.claude/agents/`): `architect` (opus, read-only planning), `implementer` (sonnet, bounded units), `quality-reviewer` (sonnet, read-only review), `visual-reviewer` (sonnet, read-only UI review). Spawn them only when the user asks or approves a plan that names them; each one costs extra usage. The main agent coordinates, integrates, runs final verification, and writes the report. Rules: `docs/engineering/HARNESS.md#delegation-and-the-agent-team`.

Reviews: built-in `/code-review` and `/security-review` once per gate (or for large changes), not per edit.

Nested instructions: `apps/web/CLAUDE.md` imports the Next.js 16 rules from `apps/web/AGENTS.md`.
