# CLAUDE.md

Repository conventions are in AGENTS.md and apply in full:

@AGENTS.md

## Claude Code specifics

- **Read before writing.** Start each task by reading the authoritative doc for the area (map in `docs/README.md`). Treat it as the spec. If code and docs disagree, stop and ask which is right.
- **Respect the current phase and gates** in AGENTS.md. In Phase 0, only docs and brand assets change. Never move past a gate without explicit approval in the chat.
- **Plan first** for multi-file or multi-layer work. Keep the plan as a short checklist and ask before large or hard-to-reverse steps (schema changes, new dependencies, deleting files).
- **Never** commit, push, open PRs, install packages, or touch `.env*` files unless the user asks for that specific action in the current session.
- **Proposed ≠ approved.** Build on Proposed decisions only where they are cheap to reverse. Flag them in your summary.
- **Verify, then report.** Run the AGENTS.md verification scripts once they exist. Report what was run, what passed, and what was not verified.
- **Brand assets** in `assets/brand/` are the source of truth for the logo. Don't redraw or "improve" them unless asked. Follow `docs/02-design/BRAND_GUIDELINES.md`.

## Agents and skills

No custom subagents or skills are defined yet. Add one only when a repeated task clearly benefits. Likely candidates after G1:

- a `verify` skill that runs lint, typecheck, test, and build and summarises the failures;
- an `add-lesson-content` skill with the checklist for adding localized lessons, quiz questions, and resources to the seed files.
