# CivicLens AI — Civic Score & Citizen Recognition

A complete, self-contained front-end prototype of **CivicLens AI**, a community civic-issue reporting
app, extended with the full **Civic Score & Citizen Recognition** feature.

> **All data is fictional demo data.** Scoring values are provisional demo rules, not universal standards.

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
```

Other scripts:

```bash
npm run typecheck  # strict TypeScript, zero errors
npm test           # vitest suite (scoring, lifecycle, authorization)
npm run check      # typecheck + tests
npm run build      # production build
```

## Demo sessions

Use the **user switcher** in the top bar:

| User | Role | Notes |
|---|---|---|
| Aarav Sharma | resident | 35 pts, pending review request |
| Priya Nair | resident | public recognition **opted out** |
| Rahul Verma | resident | duplicate credit, flagged report pending review |
| Devika Rao | resident | full lifecycle: report → evidence → resolution confirmation |
| **Meera Iyer** | **admin** | review console + score settings |

## The feature, stage by stage

### 1. Citizen Civic Score (resident)
- **Dashboard + profile** cards: total points, verified contributions, recent score activity, level, progress.
- **Dedicated route** `/resident/civic-score`: points, level rail with progress, accessible achievement
  badges, recent score activity, and a **contribution history table** (issue ID · action · points ·
  verification state · timestamp).

### 2. Initial scoring rules (configurable in Admin → Score settings)

| Action | Points |
|---|---|
| Valid, actionable issue report | +10 |
| Useful supporting evidence (once per issue per contributor) | +5 |
| Reporter confirms a resolution after checking on site | +15 |
| Supported review request on an unresolved issue (after validation) | +10 |
| Verified recurrence evidence (after moderator review) | +5 |
| Confirmed duplicate report (attribution preserved) | +2 |

Anti-farming limits (all configurable): max 40 pts/issue/citizen, 100 pts/day, 3 duplicate
credits/week, 2 recurrence credits/issue. No deductions anywhere — rejections award 0, never negative.

### 3. Recognition levels (configurable thresholds)
0–49 Community Observer · 50–149 Civic Contributor · 150–299 Community Guardian · 300+ Civic Champion.
Progress bars + achievement badges (First Voice, Evidence Contributor, Resolution Verifier, …).

### 4. Event-based scoring engine
- `src/services/civicScore.ts` — the typed CivicScore service.
- Append-only **contribution ledger** (`ScoreLedgerEntry`): every adjustment references a real
  application event (`appEvent` + `appEventId`) and an issue ID where applicable.
- **Idempotency**: deterministic event keys (`rule:issue:citizen[:qualifier]`) make duplicate awards
  impossible; decided events can never be re-decided.
- Ledger and all collections persist through the existing prototype storage mechanism
  (`localStorage` with in-memory fallback).
- Points are recorded **only after** the action succeeds — “resolution submitted” alone never counts;
  the reporter must tick the on-site verification.

### 5. Workflow integration
Issue report (auto/manual validation, duplicate review) → evidence (once per issue) → resolution
submission → reporter confirmation → review requests (validated; not awarded if the issue got resolved
meanwhile) → recurrence claims (reopen on verification). Every eligible award produces a score-activity
entry **and** an in-app notification.

### 6. Administrator controls (`/admin/*`, Meera Iyer only)
- **Review console**: validation queue (duplicates, review requests, recurrence, evidence), abuse flags,
  manual adjustments (documented + attributed), full score audit trail, issue lifecycle controls.
- **Score settings**: point rules, anti-farming thresholds, review policies (auto/manual per event),
  recognition levels — every change audited.
- Residents can never edit points or rules — enforced in the UI, the services, and the tests.

### 7. Privacy & fairness
Public recognition is **opt-in** (`/resident/profile`); the community page shows first names, levels and
verified-contribution counts only — no contact details, no exact coordinates, **no complaint-volume
leaderboard**.

## Project structure

```
src/
  components/     Icon set, UI kit, layout shell (nav, notifications, user switcher)
  data/           defaults.ts (rules/levels/badges) · seed.ts (fictional demo data)
  lib/            store.ts (prototype storage) · errors · ids · format · hooks · toast
  pages/          Dashboard · IssuesList · ReportIssue · IssueDetail · CivicScorePage ·
                  Profile · CommunityRecognition · AdminReview · AdminSettings · About
  services/       civicScore.ts · validations.ts · issues.ts · admin.ts · notifications.ts ·
                  auth.ts · db.ts
  types/          All domain types
  services/__tests__/  civicScore · workflows · authorization test suites
```

## Verification status

- `npm run typecheck` — strict mode, 0 errors.
- `npm test` — 30+ tests covering point calculations, duplicate-event prevention, caps/flags,
  authorization assumptions, and score changes after every issue-lifecycle event.
- **Simulated:** photo/video uploads, moderation heuristics (note length, area matching), and the
  session model (user switcher instead of real auth). **Functional:** everything else, in-browser.
