<!-- Copied unchanged from faroz-handoff/HANDOFF.md (Claude Design canvas "Faroz — Game Mode", exported 2026-10-28). Screenshots, artboards and demo data stay in the untracked faroz-handoff/ folder; tokens and logos are in assets/brand/faroz/. -->

# Faroz — design handoff for development

**What this is:** the approved design for Faroz (formerly Nuvora), exported from the Claude Design canvas “Faroz — Game Mode”. Use it as the source of truth when building the site in code.
**Product:** EdTech platform. Learners take a diagnostic, see their topic gaps and get quests: practice, reading, retest. Teachers see the gaps per group. Educational centers see group totals.
**Audience:** mostly Gen Z learners; teachers; center admins.
**Deadline:** project defense **Monday, 2 Nov 2026**. Prioritise accordingly (see §9).

> Read this file first, then look at `design/screens/*.jpg` for each page you build. `design/artboards/*.dc.html` hold the exact markup, copy, styles and demo logic of every screen. They are **reference only**: they run inside the design canvas runtime and can't be served on their own.

---

## 1. Folder contents

| Path | What |
|---|---|
| `design/screens/` | Screenshot of every artboard (1440 px, dark), plus mobile (390 px) and light versions of Home, learner dashboard, teacher dashboard and center dashboard |
| `design/artboards/` | Canvas source per screen (`*.dc.html`) and `canvas.json` (board list and titles) |
| `design/data/tokens.css`, `tokens.json` | All colour tokens, dark and light — generated from the canvas, use as is |
| `design/data/demo-learner-teacher.json` | Group B-12: 20 diagnostic questions, 24 students’ answers, topic totals, retest |
| `design/data/demo-center.json` | Teachers, groups (B-12, B-14, C-02, A-05, B-16, B-09), unassigned students, permission defaults |
| `brand/public/` | Logo, symbol, app icons, favicons (SVG + PNG). Copy into the Next.js `public/` folder. See `brand/public/README.md`. |

## 2. Brand

- Name: **Faroz**. Tajik Cyrillic **Фароз**, used only inside Tajik-language copy. Keep Latin “Faroz” in English and Russian copy.
- Meaning: “фароз” = height, rising upward → learning lifts you to the next level.
- Logo: two italic ribbons forming an F (top: blue → cyan, bottom: violet) plus a small cyan spark.
  - Use `faroz-logo-dark.svg` on dark surfaces (the default) and `faroz-logo.svg` on light ones.
  - In the UI, the header and sidebar logo = `faroz-mark(-dark).svg` at 28–34 px + the word “Faroz” as live text in **Unbounded 700**, 17–20 px.
  - Favicon = `favicon.ico` / `favicon.svg` (no spark). Don’t recolour, rotate or add effects.
- Never use the old name “Nuvora” anywhere visible. The demo organization is called **Faroz Demo Center**.

## 3. Visual system

**Themes:** dark “Game Mode” is the **default everywhere**; daylight is the alternative.
- Every page has a sun/moon toggle.
- The choice persists across pages (`localStorage` key in the prototype: `nvgm-theme`; rename it to e.g. `faroz-theme` in code).
- Implement with `data-theme` on `<html>` and the CSS variables in `tokens.css`.
- Avoid a flash of the wrong theme: set the attribute before paint (inline script or `next-themes`).

**Fonts** (Google Fonts, load with `next/font/google`):
- **Unbounded** 600/700 for headings, buttons and the wordmark, letter-spacing −0.02em.
- **Inter** 400/500/600/700 for body text.
- Both have Cyrillic subsets; include `cyrillic` and `cyrillic-ext` so Tajik letters (ҳ қ ӣ ғ ӯ ҷ) render.

**Key tokens** (full list in `tokens.css`):

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | #0A0B14 | #F4F5F8 | page |
| `--panel` / `--panel2` | #14162A / #1A1D35 | #FFFFFF / #F1F3F8 | cards / inner surfaces |
| `--line` / `--line2` | #262A47 / #3A3F66 | #DFE2EC / #C3C8D8 | borders |
| `--text` / `--muted` / `--faint` | #EEF0FF / #B4B9DE / #8F95C2 | #12142A / #3E4360 / #5A5F7A | text |
| `--mint` | #2EF2B5 | #12B886 | primary accent, “correct”, primary button in dark |
| `--blue` / `--blue-fill` | #3D7BFF / #2F5BEA | #2F5BEA | info, progress bars; blue fills with white text always use #2F5BEA |
| `--mag` | #FF4FD8 | #E0369F | gaps / below 60% / danger |
| `--gold` | #FFC83D | #FFC83D | XP, streaks, teacher chip |
| `--btn` / `--btn-ink` | mint / #0A0B14 | #12142A / #FFFFFF | primary button |

**Components** (from the canvas CSS):
- `.btn`: min-height 46px, padding 0 20px, radius 14px, Unbounded 700 13px, `:active` scale(.97), disabled opacity .45.
- `.btn.sm`: 38px, Inter 600 13px, radius 12px. `.ghost`: transparent with a `--line2` border.
- Inputs: 46px, radius 12px, 1px `--line2` border, Inter 15px.
- Chips: 12px/700, padding 5px 9px, pill radius.
- Cards: radius 20–26px, 1px `--line` border, `--panel` background, padding 16–24px.
- Tables: header row on `--panel2`, 12px cell padding, `--line` row borders.
- Sheets/dialogs: centred card, radius 22–24px, scrim `rgba(3,6,14,.7)`, slide-up animation.
- Toast: bottom-centre, inverse colours (`--text` background).
- Focus: always a visible focus ring. Touch targets ≥ 44px on mobile.
- Skeleton loading uses the `shimmer` gradient. Every data view has loading / empty / error states (see the artboards).

**Layout:**
- Website: content width 1240px, side padding 32px (18px on mobile).
- App pages: 248px sidebar + main column (max 1240px, padding 28px 32px).
- Below ~900px the sidebar becomes a top bar with a menu button.
- Breakpoints used: 1240, 1080, 960, 760, 640, 480. No horizontal page scroll at 390px.

## 4. Screen map → routes

| Artboard | Route | Notes |
|---|---|---|
| Main | `/` | Hero with the 3D “atom” (logo nucleus, subject tiles on 3D orbits; mouse tilts it), how it works, learners / teachers / centers, library preview, pricing, FAQ, final CTA, footer. EN/RU/TJ switch for nav and hero. |
| Library | `/library` | Real book titles with placeholder covers |
| System | — | Design-system sheet (colours, type, components) — reference |
| Brand | — | Logo variants — reference |
| Mobile | — | Mobile app prototype (390×844): home, quest with instant feedback, results, settings |
| Dashboard | `/app` | Learner home: next quest, streak, XP / level, topic map |
| Test | `/app/quest/[id]` | Quest / diagnostic player, one question at a time, instant feedback |
| Results | `/app/results` | Score 13/20, per-topic breakdown, honest caveats (one test ≠ mastery) |
| Tree | `/app/skills` | Skill tree |
| Progress | `/app/progress` | Before/after (Arrays 1/4 → 4/5 retest), retention check |
| GMSidebar / TSidebar / CSidebar | — | Shared sidebars: learner / teacher / center (center is role-aware) |
| TDashboard | `/teach` | Teacher home: next step in the loop, classes, alerts |
| TClasses | `/teach/classes`, `/teach/classes/[id]` | Class list and class detail |
| TStudents | `/teach/students`, `…/[id]` | Roster and student detail (answer by answer) |
| TMaterials | `/teach/materials` | Materials and upload |
| TAssessments | `/teach/assessments` | List: live / scheduled / draft / closed |
| TBuilder | `/teach/assessments/new` | Builder: questions, settings, student preview in EN/RU/TJ, save draft, publish |
| TBank | `/teach/bank` | Question bank |
| TInsights | `/teach/insights` | Gap insights → pick topic → students → assign practice |
| TAnalytics | `/teach/analytics` | Assessment analytics (question-level, misconceptions) |
| TResources | `/teach/resources` | Resource library |
| TSettings | `/teach/settings` | Teacher settings, reset demo |
| CDashboard | `/center` | Center home: org totals, groups needing attention, admin tasks |
| CGroups | `/center/groups`, `…/[id]` | Groups list and detail: students / results / assessments tabs; edit, archive, change teacher, add / move students |
| CGroupCreate | `/center/groups/new` | 4-step wizard |
| CStaff | `/center/staff` | Staff and invitations |
| CInvite | `/invite/[token]` | What the invitee sees (EN/RU/TJ) |
| CStudents | `/center/students` | Student directory (participation only) |
| CAnalytics | `/center/analytics` | Compare groups on the same assessments (group totals) |
| COversight | `/center/oversight` | Assessments and resources oversight (review only) |
| CSettings | `/center/settings` | Org profile, language / theme defaults, roles and permissions, reset |
| CDenied | (state) | Access-denied page pattern |

## 5. Core flows (must work in the defense demo)

1. **Learner:** Home → take diagnostic (20 questions) → results by topic → Arrays gap → practice quest → retest (4/5) → progress shows before/after.
2. **Teacher:** Dashboard → B-12 → analytics → gap insights (Arrays) → students → assign practice → retest and retention check (Oct 27) in Assessments → builder (create, preview, publish “Functions check”, Oct 19, 5 questions).
3. **Center:** Dashboard → create group → pick teacher → add students → group detail → staff → invite teacher → invitation page → analytics → oversight → settings (permissions).

## 6. Demo data rules (keep numbers consistent everywhere)

- Learner **Amina Rahimova**, group B-12: diagnostic 13/20; Arrays 1/4 → retest 4/5.
- Teacher **Dilshod Karimov** (B-12, B-14, B-16). Center admin **Farhod Jalilov**. Coordinator **Komila Rasulova**.
- B-12 topic totals: Variables 92 · Conditions 81 · Functions 58 · Arrays 44 · Objects 63 (%). Diagnostic window Oct 6–9; 24 of 26 submitted; average 68%.
- “Today” in the demo = Wed, Oct 14, 2026. Retest Oct 13. Functions check Oct 19. Retention check Oct 27.
- Some records are synthetic (C-02, A-05, extra staff) and are labelled “synthetic” in the UI. Keep those labels.
- All numbers come from `design/data/*.json`. Don’t invent new ones.

## 7. Roles, permissions, privacy

- **Roles:** student, teacher, coordinator, center admin.
- **Coordinator permissions** are set by the admin (defaults: manage groups ✓, see staff ✓; staff management, settings and library ✗).
  - When a permission is off, the actions are **disabled and blocked in their handlers**: show “View only” or an access-denied page, not just hidden nav.
- **Server rule:** the prototype checks permissions in the browser only. **In code, enforce every permission on the server** (route handlers / server actions / middleware). Client checks are UI only.
- **Privacy:** students see only their own results. Teachers see their groups answer by answer. **Centers see group totals and participation only**, never individual scores or answers.
  - Don’t reveal who got targeted practice or retests to the center: that implies a score band.
- **“Teacher can share topic labels” setting** (off by default): a teacher may share topic labels plus a short note for one student (never scores or answers). Admins and coordinators of that center can see it.
- The public FAQ promises “Centers see group totals, not individual answers” — keep that true.

## 8. Localization

- Prototype state:
  - Home nav and hero, plus the invitation page, switch EN/RU/TJ. Everything else is English.
  - The language choice is stored but not applied elsewhere.
- **In code:**
  - Message catalogs: `next-intl` (or i18next) with ICU plurals (Russian needs one/few/many).
  - Locales `en`, `ru`, `tg` (ISO code for Tajik — the prototype used `tj`).
  - Resolve user choice → org default → browser. Set `<html lang>` per locale.
  - Allow ~30% longer text; avoid `white-space: nowrap` on buttons.
- Known issue: in Tajik, Home nav labels wrap at 1440px. Use shorter labels or collapse the nav earlier.

## 9. Suggested build order (deadline Monday)

1. **Foundation:** tokens.css, fonts, theme provider (dark default and toggle), layout shells (website header/footer, app sidebar plus mobile top bar), logo components, favicon/manifest from `brand/public/`.
2. **Home `/`** pixel-close to `screens/Main.jpg` (the atom hero can start as the flat “Orbit” variant and be upgraded).
3. **Learner flow:** dashboard → quest → results → progress (flow 1), using `demo-learner-teacher.json`.
4. **Teacher flow:** dashboard → class → analytics / insights → assessments / builder (flow 2).
5. **Center flow:** dashboard → groups (+ create) → staff / invite → analytics (flow 3), including the permission and privacy rules in §7.
6. **Polish:** loading / empty / error states, mobile 390px, light theme, RU/TJ for public pages.

If the existing codebase already has some of these pages, **restyle them to match the screenshots** rather than rewriting working logic. Keep existing data models where they fit and map them to the demo data.

## 10. Done checklist per page

- [ ] Matches the screenshot in dark and light at 1440 and 390, with no horizontal scroll.
- [ ] Uses tokens (no hard-coded colours) and the Unbounded/Inter roles above.
- [ ] Logo and name are “Faroz”; no “Nuvora” anywhere.
- [ ] Numbers match `design/data`.
- [ ] Keyboard focus visible; targets ≥ 44px on mobile; contrast ≥ 4.5:1 for text.
- [ ] Loading / empty / error states where data loads.
- [ ] Role / permission checks on the server for teacher and center actions.
