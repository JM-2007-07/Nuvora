---
name: new-story
description: Create or update a dated engineering story in docs/stories/ (YYYY-MM-DD-short-description.md) from the real diff and the real verification output of a significant Nuvora change - a G4 milestone step, an API or data-model change, new tooling or dependencies, a decision, or a demo-path regression fix. Use at the end of such a change or when asked to record, log, or write up what was done.
---

# New story

Writes the project's change record. Rules and template: `docs/stories/README.md` (read it first).

## Steps

1. **Decide if a story is needed** using the threshold in `docs/stories/README.md#when-to-write-one`. Trivial changes don't get one; say so and stop, or add them to an open story of the same area.
2. **Get the real date** from the environment (for example `date +%F` in the shell). Never guess, and never backdate.
3. **Find an existing story** for the same piece of work (`docs/stories/` index). If the work continues it, add a `## Update YYYY-MM-DD` section instead of a new file.
4. **Collect facts, not intentions:**
   - `git status --short` and `git diff --stat` for the files changed.
   - The verification commands that were actually run in this session and their actual results. If a check wasn't run, write "not run" and why.
   - Decisions taken (link `docs/01-architecture/decisions.md` IDs and ADRs), requirement IDs, roadmap milestone.
5. **Write the file** `docs/stories/YYYY-MM-DD-short-description.md` with the template sections. Keep it short: a reviewer should read it in two minutes. Separate planned, implemented, and verified. Never describe a future feature as done.
6. **Add it to the index** table in `docs/stories/README.md` (newest last) with its status.
7. **Check** that every link and path in the story exists.

## Never

- Invent dates, results, or history.
- Include secrets, `.env` values, personal data, or full logs (quote the first relevant lines only).
- Replace a decision entry with a story: decisions go to `decisions.md`, the story links to them.

## Output

The story path, its status line, and any open items it records.
