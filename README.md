# StitchFlow

StitchFlow is a gentle, local-first study cockpit for F102 and F108 exam season. Lecture pre-reading is generated from calendar dates, and each chapter has its own ongoing notes and editable flashcards.

The cockpit is built around a repeatable study loop: understand a small section, retrieve it without notes, practise the exam form, review the useful errors, and revisit later. Tasks explain what they contribute to the study path, while the dashboard keeps both subjects visible without turning progress into a predicted mark. Each subject also has a chapter runway with separate Read, Summary, Confident, and Review passes; chapter totals can be adjusted in the UI and are grouped into compact 1–10, 11–20 buckets.

The calendar uses a seven-day column view so lectures, tests, assignments, and exam dates remain visible beside one another. Subjects include an ASSA exam lens with source-linked question prompts, examiner traps, syllabus links, and semester archive links for F102 and the combined F108/F101/F104 material. The study plan also surfaces a source-backed daily exam lens. This is curated study guidance only, not an exhaustive frequency analysis; course-note page weighting can be added when the notes are available locally. The app does not access or send email.

Plan items support 50%, 80%, and Done progress, so a partial pass is saved as useful work instead of disappearing or becoming a missed streak. The Study plan opens on Today and groups the wider runway into Tomorrow, This week, Later, and Everything.

The dashboard compares chapter progress with the supplied lecture runway, so it can say whether each subject is ahead, on track, or behind the current schedule. Individual task checkboxes and partial-progress controls keep the plan honest; guided rebalancing is intentionally not exposed yet.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

Run the test suite with:

```bash
npm run test
```

## Data model

The app is intentionally static. Seed data ships with the repository, while progress, tasks, sessions, and checkpoints are stored in the browser under a versioned local-storage key. Settings includes JSON export/import so the single-user plan can be backed up or moved to another browser.

There is no Supabase connection, authentication, analytics, server API, or database credential.

The browser state is versioned and migrates the original starter format safely, including the initial F102/F108 chapter progress, the canonical F102 (5 November 2026) and F108 (16 November 2026) exam dates, and the course-note reference sections. Export a JSON backup before changing browsers; this is intentionally local to the current browser and does not sync between devices.

Lecture readiness is ranked ahead of assessment preparation. ASSA paper work is split into short question drills from older archive papers and full three-hour sittings for newer papers, with the official archive links kept as the source of truth for using every available paper.

## GitHub Pages

Vite is configured with the `/StitchFlow/` base path. The workflow in `.github/workflows/deploy.yml` builds the app and deploys `dist` to GitHub Pages whenever `master` or `main` is updated.
