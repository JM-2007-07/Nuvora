# Faroz documentation

This folder holds the product, architecture, design, and process documentation of **Faroz** (formerly Nuvora, renamed in D-23 on 2026-10-28). Documents written before the rebrand still say "Nuvora"; where they conflict with the Faroz design, [FAROZ_HANDOFF.md](02-design/FAROZ_HANDOFF.md) wins. The latest state is in the newest [story](stories/README.md). Each topic has **one authoritative document**. Other files link to it rather than repeating it. If two documents disagree, the authoritative one wins, and the other must be fixed in the same change.

## Where each topic lives

| Topic | Authoritative document |
| --- | --- |
| Vision, target users, problems solved | [00-product/vision.md](00-product/vision.md) |
| User journeys, functional requirements, acceptance criteria | [00-product/requirements.md](00-product/requirements.md) |
| MVP scope vs. deferred features | [00-product/mvp-scope.md](00-product/mvp-scope.md) |
| System architecture, module boundaries, auth, i18n, theming | [01-architecture/architecture.md](01-architecture/architecture.md) |
| Status of every decision (approved / proposed / open) | [01-architecture/decisions.md](01-architecture/decisions.md) |
| Reasoning behind individual decisions | [01-architecture/adr/](01-architecture/adr/) |
| **Faroz design** (current): brand, tokens, fonts, components, screen map, roles, privacy, demo data | [02-design/FAROZ_HANDOFF.md](02-design/FAROZ_HANDOFF.md); logos and tokens in [assets/brand/faroz](../assets/brand/faroz) |
| Brand: logo, colours, typography, asset usage (Nuvora; superseded by the handoff where they conflict) | [02-design/BRAND_GUIDELINES.md](02-design/BRAND_GUIDELINES.md) |
| UI design system: theme tokens, UI type, components, motion (Nuvora; superseded by the handoff where they conflict) | [02-design/design-system.md](02-design/design-system.md) |
| Writing voice for UI copy: tone, address form, glossary, examples (ru/tg/en) | [02-design/VOICE.md](02-design/VOICE.md) |
| API conventions, errors, draft resource outline | [03-api/api-conventions.md](03-api/api-conventions.md) |
| Data model and entity relationships | [04-data/data-model.md](04-data/data-model.md) |
| Schedule to the defense (Mon 2 Nov 2026), Faroz defense phases, implementation sequence, Definition of Done | [05-planning/roadmap.md](05-planning/roadmap.md) |
| Testing, accessibility, performance, security, quality gates | [06-quality/quality-standards.md](06-quality/quality-standards.md) |
| Agent and contributor workflow: task sizing, planning, delegation, review, safety | [engineering/HARNESS.md](engineering/HARNESS.md) |
| Which checks a change needs, browser checks, how to report results | [engineering/VERIFICATION.md](engineering/VERIFICATION.md) |
| Homepage and brand-surface visual contract, imagery, motion/3D stack plan | [engineering/VISUAL_EXPERIENCE.md](engineering/VISUAL_EXPERIENCE.md) (G4-B working brief: [HOMEPAGE_BRIEF.md](engineering/HOMEPAGE_BRIEF.md)) |
| Technical readiness audit (Phase 0, 2026-10-30): functionality matrix, security findings, mobile readiness, roadmap | [engineering/FAROZ-TECHNICAL-READINESS-REPORT.md](engineering/FAROZ-TECHNICAL-READINESS-REPORT.md) |
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
