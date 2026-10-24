/**
 * Fictional demo seed. All people, issues and events are invented.
 * Seeded only when a collection is empty so returning users keep their data.
 */
import type { AbuseFlag, AppNotification, Evidence, Issue, ScoreLedgerEntry, ValidationRequest } from '../types';
import { daysAgo, hoursAgo } from '../lib/ids';
import { DEMO_USERS } from '../services/auth';
import { KEYS } from '../services/db';
import { getDataStore } from '../lib/store';
import { buildEventId, DEFAULT_RULES, DEFAULT_LEVELS } from './defaults';

export function seedIfEmpty(): void {
  const ds = getDataStore();

  if (!ds.has(KEYS.users)) ds.write(KEYS.users, DEMO_USERS);
  if (!ds.has(KEYS.rules)) ds.write(KEYS.rules, DEFAULT_RULES);
  if (!ds.has(KEYS.levels)) ds.write(KEYS.levels, DEFAULT_LEVELS);
  if (!ds.has(KEYS.issues)) ds.write(KEYS.issues, SEED_ISSUES);
  if (!ds.has(KEYS.evidence)) ds.write(KEYS.evidence, SEED_EVIDENCE);
  if (!ds.has(KEYS.validations)) ds.write(KEYS.validations, SEED_VALIDATIONS);
  if (!ds.has(KEYS.ledger)) ds.write(KEYS.ledger, SEED_LEDGER);
  if (!ds.has(KEYS.notifications)) ds.write(KEYS.notifications, SEED_NOTIFICATIONS);
  if (!ds.has(KEYS.flags)) ds.write(KEYS.flags, SEED_FLAGS);
}

/* ---------------------------------- issues --------------------------------- */

export const SEED_ISSUES: Issue[] = [
  {
    id: 'ISS-1001',
    title: 'Deep pothole on 9th Cross causing two-wheelers to swerve',
    description:
      'A wide pothole has opened near the bus stop on 9th Cross. It fills with water in the evenings and is hard to spot. At least two riders have skidded here this week.',
    category: 'roads',
    severity: 'high',
    status: 'in_progress',
    reporterId: 'u-aarav',
    ward: 'Ward 45 — Jayanagar',
    area: 'Jayanagar',
    landmark: 'Near 4th Block bus stop',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(5),
    recurrenceCount: 0,
  },
  {
    id: 'ISS-1002',
    title: 'Streetlight out for a week near the park entrance',
    description:
      'The streetlight opposite the park entrance has been off for about a week. The stretch is completely dark after 7 pm and residents are avoiding it.',
    category: 'streetlight',
    severity: 'medium',
    status: 'resolved',
    reporterId: 'u-aarav',
    ward: 'Ward 45 — Jayanagar',
    area: 'Jayanagar',
    landmark: 'Opposite Nehru Park entrance',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(1),
    recurrenceCount: 0,
    resolution: {
      id: 'res-seed-1',
      description: 'Replacing faulty luminaire and checked the feeder line.',
      submittedAt: daysAgo(1),
      submittedBy: 'u-meera',
      confirmedByReporter: false,
    },
  },
  {
    id: 'ISS-1003',
    title: 'Garbage not collected near the metro station for two days',
    description:
      'The black spot behind the metro station has not been cleared for two days. Waste bags are spilling onto the footpath and attracting strays.',
    category: 'sanitation',
    severity: 'high',
    status: 'submitted',
    reporterId: 'u-rahul',
    ward: 'Ward 32 — Indiranagar',
    area: 'Indiranagar',
    landmark: 'Behind metro station gate 2',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    recurrenceCount: 0,
    duplicateReviewStatus: 'flagged',
  },
  {
    id: 'ISS-1004',
    title: 'Overflowing waste bags at the metro station black spot',
    description:
      'Contract workers say collection was missed this week. Bags are stacked at the usual black spot behind the metro station and the smell is unbearable by noon.',
    category: 'sanitation',
    severity: 'high',
    status: 'acknowledged',
    reporterId: 'u-priya',
    ward: 'Ward 32 — Indiranagar',
    area: 'Indiranagar',
    landmark: 'Behind metro station',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(4),
    recurrenceCount: 0,
  },
  {
    id: 'ISS-1005',
    title: 'Storm-water drain overflowing onto the footpath',
    description:
      'The drain near the community hall overflows every morning, and silt has made the footpath unusable. Pedestrians are walking on the road to get past.',
    category: 'drainage',
    severity: 'critical',
    status: 'resolved',
    reporterId: 'u-devika',
    ward: 'Ward 21 — Whitefield',
    area: 'Whitefield',
    landmark: 'Near community hall',
    createdAt: daysAgo(22),
    updatedAt: daysAgo(19),
    recurrenceCount: 0,
    resolution: {
      id: 'res-seed-2',
      description: 'Desilted 40 metres of drain and repaired the collapsed slab.',
      submittedAt: daysAgo(20),
      submittedBy: 'u-meera',
      confirmedByReporter: true,
      confirmedAt: daysAgo(19),
      confirmedBy: 'u-devika',
    },
  },
  {
    id: 'ISS-1006',
    title: 'Low water pressure in the afternoon across three streets',
    description:
      'Homes on the inner streets get only a trickle between 1 pm and 4 pm for the past week. Older residents are carrying water up the stairs.',
    category: 'water',
    severity: 'medium',
    status: 'acknowledged',
    reporterId: 'u-aarav',
    ward: 'Ward 45 — Jayanagar',
    area: 'Jayanagar',
    landmark: 'Inner streets, 4th Block',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(3),
    recurrenceCount: 0,
  },
  {
    id: 'ISS-1007',
    title: 'Pothole reappeared on 9th Cross near the bus stop',
    description:
      'Same pothole as last month near the bus stop — the patch material has given way again after two days of rain.',
    category: 'roads',
    severity: 'high',
    status: 'closed_duplicate',
    reporterId: 'u-rahul',
    ward: 'Ward 45 — Jayanagar',
    area: 'Jayanagar',
    landmark: 'Near 4th Block bus stop',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(7),
    recurrenceCount: 0,
    duplicateOfIssueId: 'ISS-1001',
    duplicateReviewStatus: 'confirmed_duplicate',
  },
];

/* --------------------------------- evidence --------------------------------- */

export const SEED_EVIDENCE: Evidence[] = [
  {
    id: 'ev-seed-1',
    issueId: 'ISS-1001',
    submittedById: 'u-priya',
    type: 'photo',
    note: 'Photo from this morning — the pothole is nearly half a metre wide after last night\'s rain.',
    createdAt: daysAgo(11),
  },
  {
    id: 'ev-seed-2',
    issueId: 'ISS-1001',
    submittedById: 'u-aarav',
    type: 'description',
    note: 'Two riders skidded here on Monday evening; sharing in the residents\' group for awareness.',
    createdAt: daysAgo(10),
  },
  {
    id: 'ev-seed-3',
    issueId: 'ISS-1005',
    submittedById: 'u-devika',
    type: 'photo',
    note: 'Morning overflow near the community hall — silt spread across the footpath.',
    createdAt: daysAgo(21),
  },
];

/* -------------------------------- validations -------------------------------- */

export const SEED_VALIDATIONS: ValidationRequest[] = [
  {
    id: 'val-seed-1',
    type: 'duplicate_review',
    issueId: 'ISS-1003',
    citizenId: 'u-rahul',
    rule: 'issueReport',
    pointsIfApproved: 10,
    dedupeEventId: buildEventId('issueReport', { issueId: 'ISS-1003', citizenId: 'u-rahul' }),
    status: 'pending',
    payload: { similarIssueIds: 'ISS-1004', area: 'Indiranagar', category: 'sanitation' },
    note: 'Flagged automatically — same category and area as an existing report.',
    createdAt: daysAgo(2),
  },
  {
    id: 'val-seed-2',
    type: 'review_request',
    issueId: 'ISS-1006',
    citizenId: 'u-aarav',
    rule: 'reviewRequest',
    pointsIfApproved: 10,
    dedupeEventId: buildEventId('reviewRequest', { issueId: 'ISS-1006', citizenId: 'u-aarav' }),
    status: 'pending',
    payload: { issueAgeDays: '4' },
    note: 'Reporter requests a re-check: the issue remains unresolved.',
    createdAt: hoursAgo(20),
  },
];

/* ---------------------------------- ledger ----------------------------------- */

function entry(
  id: string,
  rule: Parameters<typeof buildEventId>[0],
  opts: {
    citizen: string;
    issue?: string;
    points: number;
    status?: ScoreLedgerEntry['status'];
    prospective?: number;
    appEvent: string;
    appEventId: string;
    reason: string;
    createdAt: string;
    validatedBy?: string;
  },
): ScoreLedgerEntry {
  const typeMap: Record<string, ScoreLedgerEntry['type']> = {
    issueReport: 'issue_report',
    evidence: 'evidence',
    resolutionConfirmation: 'resolution_confirmation',
    reviewRequest: 'review_request',
    recurrenceEvidence: 'recurrence_evidence',
    duplicateReport: 'duplicate_report',
  };
  return {
    id,
    eventId: buildEventId(rule, { issueId: opts.issue ?? null, citizenId: opts.citizen }),
    citizenId: opts.citizen,
    issueId: opts.issue ?? null,
    type: typeMap[rule],
    points: opts.status === 'awarded' || opts.status === undefined ? opts.points : 0,
    status: opts.status ?? 'awarded',
    prospectivePoints: opts.prospective,
    appEvent: opts.appEvent,
    appEventId: opts.appEventId,
    validatedBy: opts.validatedBy ?? 'system',
    reason: opts.reason,
    createdAt: opts.createdAt,
    decidedAt: opts.status === 'pending' ? undefined : opts.createdAt,
  };
}

export const SEED_LEDGER: ScoreLedgerEntry[] = [
  // Aarav — 35 awarded + 1 pending
  entry('led-seed-01', 'issueReport', {
    citizen: 'u-aarav', issue: 'ISS-1001', points: 10, appEvent: 'issue.submitted', appEventId: 'ISS-1001',
    reason: 'Valid, actionable issue report', createdAt: daysAgo(12),
  }),
  entry('led-seed-02', 'evidence', {
    citizen: 'u-aarav', issue: 'ISS-1001', points: 5, appEvent: 'evidence.submitted', appEventId: 'ev-seed-2',
    reason: 'Useful supporting evidence (once per issue per contributor)', createdAt: daysAgo(10),
  }),
  entry('led-seed-03', 'issueReport', {
    citizen: 'u-aarav', issue: 'ISS-1002', points: 10, appEvent: 'issue.submitted', appEventId: 'ISS-1002',
    reason: 'Valid, actionable issue report', createdAt: daysAgo(9),
  }),
  entry('led-seed-04', 'issueReport', {
    citizen: 'u-aarav', issue: 'ISS-1006', points: 10, appEvent: 'issue.submitted', appEventId: 'ISS-1006',
    reason: 'Valid, actionable issue report', createdAt: daysAgo(4),
  }),
  entry('led-seed-05', 'reviewRequest', {
    citizen: 'u-aarav', issue: 'ISS-1006', points: 0, status: 'pending', prospective: 10,
    appEvent: 'review.requested', appEventId: 'rr-seed-1',
    reason: 'Supported review request on an issue that remains unresolved — awaiting validation',
    createdAt: hoursAgo(20), validatedBy: 'pending-review',
  }),
  // Priya — 15 awarded
  entry('led-seed-06', 'issueReport', {
    citizen: 'u-priya', issue: 'ISS-1004', points: 10, appEvent: 'issue.submitted', appEventId: 'ISS-1004',
    reason: 'Valid, actionable issue report', createdAt: daysAgo(6),
  }),
  entry('led-seed-07', 'evidence', {
    citizen: 'u-priya', issue: 'ISS-1001', points: 5, appEvent: 'evidence.submitted', appEventId: 'ev-seed-1',
    reason: 'Useful supporting evidence (once per issue per contributor)', createdAt: daysAgo(11),
  }),
  // Rahul — duplicate credit, attribution preserved
  entry('led-seed-08', 'issueReport', {
    citizen: 'u-rahul', issue: 'ISS-1007', points: 2, appEvent: 'issue.duplicate.confirmed', appEventId: 'ISS-1007',
    reason: 'Confirmed duplicate of ISS-1001 — credit awarded, attribution preserved',
    createdAt: daysAgo(7), validatedBy: 'u-meera',
  }),
  // Devika — full lifecycle on ISS-1005
  entry('led-seed-09', 'issueReport', {
    citizen: 'u-devika', issue: 'ISS-1005', points: 10, appEvent: 'issue.submitted', appEventId: 'ISS-1005',
    reason: 'Valid, actionable issue report', createdAt: daysAgo(22),
  }),
  entry('led-seed-10', 'evidence', {
    citizen: 'u-devika', issue: 'ISS-1005', points: 5, appEvent: 'evidence.submitted', appEventId: 'ev-seed-3',
    reason: 'Useful supporting evidence (once per issue per contributor)', createdAt: daysAgo(21),
  }),
  entry('led-seed-11', 'resolutionConfirmation', {
    citizen: 'u-devika', issue: 'ISS-1005', points: 15, appEvent: 'resolution.confirmed', appEventId: 'res-seed-2',
    reason: 'Reporter confirmed a resolution after checking it on site', createdAt: daysAgo(19),
  }),
  // Rahul — pending duplicate review for ISS-1003 (no points until decided)
  entry('led-seed-12', 'issueReport', {
    citizen: 'u-rahul', issue: 'ISS-1003', points: 0, status: 'pending', prospective: 10,
    appEvent: 'issue.submitted', appEventId: 'ISS-1003',
    reason: 'Valid, actionable issue report — awaiting duplicate review',
    createdAt: daysAgo(2), validatedBy: 'pending-review',
  }),
];

/* ------------------------------- notifications ------------------------------- */

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'ntf-seed-1',
    userId: 'u-aarav',
    type: 'score',
    title: '+10 points — Issue report',
    body: 'Valid, actionable issue report. Issue ISS-1006. Provisional demo rules for the CivicLens AI prototype.',
    link: '/resident/issues/ISS-1006',
    read: false,
    createdAt: daysAgo(4),
  },
  {
    id: 'ntf-seed-2',
    userId: 'u-aarav',
    type: 'issue',
    title: 'ISS-1002 is awaiting your confirmation',
    body: 'The ward team marked this issue resolved. Please check on site and confirm — resolution points are recorded only after your confirmation.',
    link: '/resident/issues/ISS-1002',
    read: false,
    createdAt: daysAgo(1),
  },
  {
    id: 'ntf-seed-3',
    userId: 'u-devika',
    type: 'score',
    title: '+15 points — Resolution confirmation',
    body: 'Reporter confirmed a resolution after checking it on site. Issue ISS-1005.',
    link: '/resident/issues/ISS-1005',
    read: true,
    createdAt: daysAgo(19),
  },
  {
    id: 'ntf-seed-4',
    userId: 'u-rahul',
    type: 'review',
    title: 'Duplicate review completed — +2 points',
    body: 'Your report ISS-1007 matched ISS-1001. You receive a small credit; the original reporter keeps full attribution.',
    link: '/resident/issues/ISS-1001',
    read: false,
    createdAt: daysAgo(7),
  },
];

/* --------------------------------- flags ------------------------------------- */

export const SEED_FLAGS: AbuseFlag[] = [];
