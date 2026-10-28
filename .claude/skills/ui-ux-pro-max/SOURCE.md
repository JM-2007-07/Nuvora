# UI/UX Pro Max: source and local changes

Third-party skill, vendored into this repository. Licence: MIT, see [`LICENSE`](LICENSE) (copied unchanged from the upstream repository, git blob `1e71cbf26660f31903807d099fe902c098fc7e4c`).

| | |
| --- | --- |
| Upstream | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| Version | 2.15.0 (npm package `ui-ux-pro-max-cli@2.15.0`, integrity `sha512-D0J/C40xrzzi5si6ZLtRGbEE5v3QjL7d4wJNnasmP3yfDSrGiuqVCdwQiqCNnIkbqOuVoA/uonR2o1WKXh3urw==`) |
| Installed | 2026-10-26, with the owner's approval |
| Method | `npx ui-ux-pro-max-cli@2.15.0 init --ai claude`, run in the repository root (official CLI, project-scoped, no global install) |

## Local changes

- **Removed:** the six sibling skills the installer also creates (`banner-design`, `brand`, `design-system`, `design`, `slides`, `ui-styling`). They overlap Nuvora's own brand and design-system documents.
- **Added to `SKILL.md`:** a "Nuvora rules" block after the frontmatter. It gives Nuvora's docs and D-22 precedence, limits the skill to reference lookups, forbids `--design-system`/`--persist`/`--force` and GSAP, and says not to change the homepage.
- **Added:** this file and `LICENSE`.
- **Unchanged:** `data/` and `scripts/` are byte-identical to the 2.15.0 package.

Invocation is explicit only (`"skillOverrides": { "ui-ux-pro-max": "user-invocable-only" }` in `.claude/settings.json`). Running `uipro update` or `uipro init --force` regenerates `SKILL.md`, which removes the Nuvora block, and `uipro init` recreates the six sibling skills. After an update, re-add the block and remove the siblings. Details: [`docs/engineering/HARNESS.md`](../../../docs/engineering/HARNESS.md).
