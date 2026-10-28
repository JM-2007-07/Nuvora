---
name: design-review
description: Review a proposed or implemented Nuvora UI (homepage, knowledge core, brand surfaces, or any new page) against the approved visual direction in docs/engineering/VISUAL_EXPERIENCE.md, the brand guidelines, and the design system - coherence, hierarchy, motion and 3D choices, imagery and asset integration, and dependency fit - and recommend specific improvements without redesigning unrelated areas. Use for design proposals, mockups, or UI pull requests before implementation is finalized.
---

# Design review

A design critique against Nuvora's written contract. It judges and recommends; it doesn't implement. For pixel-level checks across viewports, locales, and themes use `visual-qa`.

## Inputs

What is being reviewed: a description or mockup, a diff (`git diff -- apps/web`), or a running page. Read only the parts of these that apply:

- `docs/engineering/VISUAL_EXPERIENCE.md`: identity, the knowledge core, homepage structure, motion/3D ownership, imagery rules, implementation checklist, dependency plan.
- `docs/02-design/BRAND_GUIDELINES.md`: colours, contrast rules, typography, logo usage.
- `docs/02-design/design-system.md`: tokens, type scale, layout, components, UI motion.
- `docs/00-product/requirements.md` and `docs/03-api/api-conventions.md`: what the product and API really support.

## Review questions

1. **Identity.** Does it look and feel like Nuvora (deep navy space, restrained violet/teal light, the spark, calm and premium), or could it be any product's landing page? Is the knowledge core the clear focal point on the homepage?
2. **Meaning.** Does each visual element explain something real (connected topics from real prerequisite data, the loop, mastery)? Flag decoration that exists only to look impressive.
3. **Truthfulness.** Does it show or imply features the backend doesn't have? Future concepts must be labelled or left out.
4. **Hierarchy and composition.** One focal point per section, clear headline and CTA, readable supporting text, rhythm between sections, no card grids standing in for design.
5. **Typography.** Inter for UI in all three locales, Poppins only for the tagline/Latin display, type scale respected, long Russian/Tajik strings accommodated.
6. **Colour and tokens.** Only `--nv-*` tokens and Tailwind theme classes; new colours proposed as tokens; contrast rules from BRAND_GUIDELINES.md met.
7. **Motion and 3D.** Each job has one owner (SVG, CSS, Motion, Canvas, or approved R3F); entrance and idle motion are purposeful; reduced-motion and no-WebGL paths exist; mobile is lighter. Libraries follow D-22: Motion is approved; Canvas and 3D need a justified, tested need (3D also an owner OK).
8. **Imagery.** Each asset has a reason, a recorded source and licence, consistent art direction, responsive crops, alt text or `alt=""`, and a scrim where text sits on top.
9. **Mobile.** Composed for small screens, not scaled down. Touch targets ≥ 44 px.
10. **Performance.** Heavy pieces are client-only and lazy; the hero renders without waiting for them; there is a plan to measure.

## Output

1. Verdict in one line: aligned / aligned with changes / not aligned.
2. What works (brief, specific).
3. Recommendations, most important first. Each: the issue, the contract rule it relates to (doc and section), a concrete change, and the expected effect. Stay within the reviewed area; don't redesign unrelated pages.
4. Open questions for the owner (for example decisions that D-22 leaves open).
