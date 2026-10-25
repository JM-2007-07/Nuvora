# User journeys and requirements

Status: **Approved** (G0 baseline, owner, 2026-10-25). IDs are stable and referenced from PRs and other docs.

Priority labels (assigned in [mvp-scope.md](mvp-scope.md)):

- **MVP-Must**: required for the October 31 presentation. The loop breaks without it.
- **MVP-Should**: planned for the presentation, but may be simplified or cut at feature freeze.
- **Later**: explicitly deferred.

## User journeys

### J1: First visit

1. A learner opens Nuvora. The interface appears in **Tajik** (the default), and the theme follows the system setting.
2. They can switch language (Тоҷикӣ / Русский / English) and theme (light / dark / system) from the header at any time. The choice persists.
3. They see the list of subjects and can read any lesson without choosing a learner.
4. They can pick a **demo learner** (to see a learner with history) or **continue as a guest** (start fresh). If they do neither, guest mode starts automatically the first time they take a quiz or mark a lesson complete.

### J2: Core learning loop (the demo path)

1. The learner opens a subject and sees its topics in a recommended order, with a status for each.
2. They open a topic and study its lesson: explanation, worked examples, supporting materials.
3. They take the topic's quiz (or, if built, the subject checkpoint quiz), answering one question at a time. If no learner is chosen yet, guest mode starts here.
4. They submit and see their score. Each question shows whether it was correct, the correct answer, and an explanation.
5. Results show a per-topic breakdown and mark **weak topics**.
6. Nuvora recommends what to review next: a prerequisite lesson, the weak topic's lesson, or a recommended book or resource.
7. The learner opens a recommendation, reviews it, and retakes the quiz.
8. Their progress page shows the improved mastery.

### J3: Explore the Knowledge Map

1. From a subject, the learner opens the Knowledge Map.
2. They see topics as nodes and prerequisites as arrows. Each node shows the learner's status (not started / weak / developing / mastered).
3. Selecting a node opens that topic.

### J4: Review the Learning Journey

1. The learner opens "My progress".
2. They see completed lessons, quiz attempt history with scores, and mastery per topic.
3. (Later) They set a goal and see earned achievements.

## Functional requirements and acceptance criteria

### Catalog (FR-CAT)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-CAT-01 | List subjects | Subjects page shows every published subject with localized title, short description, and topic count. |
| FR-CAT-02 | Subject detail with ordered topics | Topics appear in their defined order. Each shows a localized title, a summary, and the learner's mastery status. |
| FR-CAT-03 | Topic detail | Shows the topic's lessons, its prerequisites (linked), its recommended resources, and a "Take quiz" action. |

### Lessons (FR-LES)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-LES-01 | Read a structured lesson | Lesson shows a title, estimated reading time, a body with headings, at least one worked example, and key takeaways, all in the selected locale (see FR-I18N-03 for fallback). |
| FR-LES-02 | Mark lesson complete | The learner can mark a lesson complete. Completion appears on the topic, the subject, and the progress page. |
| FR-LES-03 | Next step from a lesson | The end of a lesson offers "Take the quiz" and links to the next topic. |

### Resources and books (FR-RES)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-RES-01 | Recommended resources per topic | A topic lists its resources with type (book / article / video / exercise), title, author or source, language, and a short "why it helps". |
| FR-RES-02 | External links are safe | External links open in a new tab with `rel="noopener noreferrer"`. No resource is downloaded or embedded without review. |

### Quizzes (FR-QUIZ)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-QUIZ-01 | Take a quiz | Questions display one at a time with progress ("3 / 10"). Single-choice questions are fully keyboard operable. |
| FR-QUIZ-02 | Submit and score | On submit, the server (never the client) scores the attempt and returns the total score and percentage. |
| FR-QUIZ-03 | Explanations | Results show, per question: the learner's answer, the correct answer, and a localized explanation. |
| FR-QUIZ-04 | Per-topic breakdown | Results show the percentage correct per topic covered by the quiz. |
| FR-QUIZ-05 | Retake | The learner can retake a quiz. Each attempt is stored separately. |
| FR-QUIZ-06 | No answer leakage | The quiz payload sent before submission doesn't reveal which options are correct. |

### Adaptive Quiz: weak topics and recommendations (FR-ADAPT)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-ADAPT-01 | Identify weak topics | After an attempt, topics are classified with the rules in [ADR-0004](../01-architecture/adr/0004-rule-based-mastery-and-recommendations.md). Weak topics are highlighted in the results. |
| FR-ADAPT-02 | Recommend what to review | Results show up to 3 recommendations, each with a reason ("You scored 33% on Fractions", "Prerequisite for Equations"). Each links to a lesson or resource. |
| FR-ADAPT-03 | Prerequisites first | If a weak topic has a prerequisite that is also weak or not started, the prerequisite is recommended first. |
| FR-ADAPT-04 | Adaptive question selection | **Later.** The next questions are chosen based on earlier answers. |

### Progress and Learning Journey (FR-PROG, FR-JOUR)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-PROG-01 | Topic mastery | Mastery status per topic is updated after every attempt and shown on the subject page, the map, and the progress page. |
| FR-PROG-02 | Progress page | Shows completed lessons, quiz attempts (date, quiz, score), and mastery per topic for the current learner. |
| FR-JOUR-01 | Attempt history over time | Progress page shows each topic's score trend across attempts (a simple list or sparkline is enough). |
| FR-JOUR-02 | Goals | **Later.** The learner sets a goal (e.g. "Master Algebra basics by Dec 1") and sees progress toward it. |
| FR-JOUR-03 | Achievements | **Later.** Badges for milestones (first quiz, first topic mastered, 7-day streak). |

### Knowledge Map (FR-MAP)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-MAP-01 | Visual topic graph | For a subject, show topics as nodes and prerequisite relations as directed edges. |
| FR-MAP-02 | Status on the map | Each node shows the learner's status with **both** colour and an icon or text label. Colour is never the only signal. |
| FR-MAP-03 | Navigate from the map | Clicking a node, or pressing Enter on it, opens the topic. Nodes are reachable by keyboard. |
| FR-MAP-04 | Accessible alternative | The same information is available as an ordered list (for screen readers and small screens). |

### Localization (FR-I18N)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-I18N-01 | Interface languages | Every UI string exists in `tg`, `ru`, and `en`. A missing key fails a test. Tajik is the default: `/` opens `/tg` unless the learner chose another language before. |
| FR-I18N-02 | Language switcher | The header switcher is on every page and lists languages by native name. Switching keeps the current page, changes the URL locale, and persists across visits. `<html lang>` matches the locale. |
| FR-I18N-03 | Localized content | All core demo content is available in all three languages (the seed check fails otherwise). Other content falls back by the [documented order](../01-architecture/architecture.md#content-fallback-strategy) and shows a "not yet translated" label. |
| FR-I18N-04 | Locale-correct formatting | Dates, percentages, and counts read correctly in each language and look the same on server and client render. Tajik doesn't depend on browser `Intl` data (D-19). |

### Appearance (FR-THEME)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-THEME-01 | Light, dark, system | The theme switcher offers three options. The default is system. The choice persists. |
| FR-THEME-02 | No flash | The page renders in the correct theme on first paint, with no light-to-dark flash. |
| FR-THEME-03 | Brand-correct logo | Light theme uses `logo-full.svg`. Dark theme uses `logo-full-dark.svg`. |

### Accounts (FR-AUTH)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-AUTH-01 | Demo profiles and guest mode | The learner can choose one of the seeded demo learners or continue as a guest ([ADR-0006](../01-architecture/adr/0006-demo-profiles-and-guest-mode.md)). Taking a quiz or marking a lesson complete without a learner starts guest mode automatically. Progress survives page reloads. |
| FR-AUTH-02 | Data isolation | A learner can never read or change another learner's attempts or progress. Enforced by the API and covered by an integration test. |
| FR-AUTH-03 | Current learner visible | The header shows the current learner's name, a "Demo" badge, "Switch learner", and "Leave". |
| FR-AUTH-04 | Demo reset | One command restores demo learners to their scripted history and removes guest learners. |
| FR-AUTH-05 | Registration, passwords, social login | **Later.** Not in the MVP (D-03). Required before any public deployment. |
| FR-AUTH-06 | Content administration UI | **Later.** MVP content comes from reviewed seed files ([ADR-0005](../01-architecture/adr/0005-content-as-code.md)). |

## Non-functional requirements

These are defined in their authoritative documents. They are summarised here only so the full requirement set is in one view.

| Area | Summary | Authoritative doc |
| --- | --- | --- |
| Accessibility | WCAG 2.2 AA target, keyboard-operable quiz and map | [quality-standards.md](../06-quality/quality-standards.md#accessibility) |
| Responsiveness | Works from 360 px wide upward, mobile-first | [design-system.md](../02-design/design-system.md#layout-and-responsiveness) |
| Performance | Fast first load on a mid-range phone, no heavy libraries | [quality-standards.md](../06-quality/quality-standards.md#performance) |
| Security | Server-side scoring, validated inputs, no secrets in repo | [quality-standards.md](../06-quality/quality-standards.md#security) |
