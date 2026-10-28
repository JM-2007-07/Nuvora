# Nuvora documentation

This folder holds Nuvora's product, architecture, design, and process documentation. Each topic has **one authoritative document**. Other files link to it rather than repeating it. If two documents disagree, the authoritative one wins, and the other must be fixed in the same change.

## Where each topic lives

| Topic | Authoritative document |
| --- | --- |
| Vision, target users, problems solved | [00-product/vision.md](00-product/vision.md) |
| User journeys, functional requirements, acceptance criteria | [00-product/requirements.md](00-product/requirements.md) |
| MVP scope vs. deferred features | [00-product/mvp-scope.md](00-product/mvp-scope.md) |
| System architecture, module boundaries, auth, i18n, theming | [01-architecture/architecture.md](01-architecture/architecture.md) |
| Status of every decision (approved / proposed / open) | [01-architecture/decisions.md](01-architecture/decisions.md) |
| Reasoning behind individual decisions | [01-architecture/adr/](01-architecture/adr/) |
| Brand: logo, colours, typography, asset usage | [02-design/BRAND_GUIDELINES.md](02-design/BRAND_GUIDELINES.md) |
| UI design system: theme tokens, UI type, components, motion | [02-design/design-system.md](02-design/design-system.md) |
| API conventions, errors, draft resource outline | [03-api/api-conventions.md](03-api/api-conventions.md) |
| Data model and entity relationships | [04-data/data-model.md](04-data/data-model.md) |
| Schedule to Oct 31, implementation sequence, Definition of Done | [05-planning/roadmap.md](05-planning/roadmap.md) |
| Testing, accessibility, performance, security, quality gates | [06-quality/quality-standards.md](06-quality/quality-standards.md) |
| Agent and contributor workflow: task sizing, planning, delegation, review, safety | [engineering/HARNESS.md](engineering/HARNESS.md) |
| Which checks a change needs, browser checks, how to report results | [engineering/VERIFICATION.md](engineering/VERIFICATION.md) |
| Homepage and brand-surface visual contract, imagery, motion/3D stack plan | [engineering/VISUAL_EXPERIENCE.md](engineering/VISUAL_EXPERIENCE.md) (G4-B working brief: [HOMEPAGE_BRIEF.md](engineering/HOMEPAGE_BRIEF.md)) |
| Dated records of significant changes | [stories/](stories/README.md) |
| Development workflow: git, commands, conventions, approval gates | [../AGENTS.md](../AGENTS.md) |
| Claude Code–specific instructions | [../CLAUDE.md](../CLAUDE.md) |

## Status labels

Documents and decisions use these labels:

- **Approved**: agreed by the team. Change it only through a new decision.
- **Proposed**: the recommended direction, not yet approved. Do not build anything that is hard to reverse on it without approval.
- **Open**: still undecided. The options are listed in [decisions.md](01-architecture/decisions.md).

## Keeping docs consistent

- A change that alters documented behaviour, scope, or a decision updates the authoritative document in the **same pull request**.
- New decisions go into [decisions.md](01-architecture/decisions.md) first. Write an ADR when the trade-off needs explaining.
- Before each phase gate (see [AGENTS.md](../AGENTS.md#approval-gates)), check that `decisions.md` has no stale **Open** items that block the phase.
- Significant changes get a dated story in [stories/](stories/README.md). A story links to decisions; it never replaces them.
