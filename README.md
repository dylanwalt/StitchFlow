# StitchFlow

StitchFlow is a gentle, local-first study cockpit for A311, F102, and F108 exam season.

The cockpit is built around a repeatable study loop: understand a small section, retrieve it without notes, practise the exam form, review the useful errors, and revisit later. Tasks explain what they contribute to the study path, while the dashboard keeps the three subjects visible without turning progress into a predicted mark.

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

The browser state is versioned and migrates the original starter format safely. Export a JSON backup before changing browsers; this is intentionally local to the current browser and does not sync between devices.

## GitHub Pages

Vite is configured with the `/StitchFlow/` base path. The workflow in `.github/workflows/deploy.yml` builds the app and deploys `dist` to GitHub Pages whenever `master` or `main` is updated.
