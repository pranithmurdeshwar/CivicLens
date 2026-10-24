import { describe, it, expect, beforeEach } from 'vitest';
import { resetTestState } from './helpers';
import {
  adjustPoints,
  award,
  getLevelProgress,
  getLevels,
  getScoreSummary,
  getTotalPoints,
  recordRejection,
  updateLevels,
  updateRules,
  computeBadges,
} from '../civicScore';
import { AuthorizationError } from '../../lib/errors';

const RESIDENT = { id: 'u-aarav', role: 'resident' as const, kind: 'user' as const };
const ADMIN = { id: 'u-meera', role: 'admin' as const, kind: 'user' as const };
const SYSTEM = { id: 'system', role: 'admin' as const, kind: 'system' as const };

beforeEach(() => resetTestState());

describe('point calculations', () => {
  it('awards the configured points for each rule', () => {
    const a = award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'issue.submitted', appEventId: 'ISS-2001' });
    const b = award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'evidence.submitted', appEventId: 'ev-1' });

    expect(a.outcome).toBe('awarded');
    expect(a.pointsAdded).toBe(10);
    expect(b.outcome).toBe('awarded');
    expect(b.pointsAdded).toBe(5);
    expect(getTotalPoints(RESIDENT.id)).toBe(15);
  });

  it('keeps configured demo values for all six rules', () => {
    const rules = updateRules({}, ADMIN); // read-through of defaults
    expect(rules.points).toEqual({
      issueReport: 10,
      evidence: 5,
      resolutionConfirmation: 15,
      reviewRequest: 10,
      recurrenceEvidence: 5,
      duplicateReport: 2,
    });
  });

  it('summarises level, progress and verified contribution counts', () => {
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'issue.submitted', appEventId: 'ISS-2001' });
    const summary = getScoreSummary(RESIDENT.id);
    expect(summary.totalPoints).toBe(10);
    expect(summary.level.key).toBe('observer');
    expect(summary.nextLevel?.key).toBe('contributor');
    expect(summary.pointsToNext).toBe(40);
    expect(summary.verifiedContributions).toBe(1);
  });

  it('computes progress across the configured recognition levels', () => {
    // 0–49 observer, 50–149 contributor, 150–299 guardian, 300+ champion
    expect(getLevelProgress(0).level.key).toBe('observer');
    expect(getLevelProgress(49).level.key).toBe('observer');
    expect(getLevelProgress(50).level.key).toBe('contributor');
    expect(getLevelProgress(149).level.key).toBe('contributor');
    expect(getLevelProgress(150).level.key).toBe('guardian');
    expect(getLevelProgress(299).level.key).toBe('guardian');
    expect(getLevelProgress(300).level.key).toBe('champion');
    expect(getLevelProgress(300).nextLevel).toBeNull();
    expect(getLevelProgress(25).pointsToNext).toBe(25);
    expect(getLevelProgress(100).progressPct).toBe(50); // halfway 50→150
  });

  it('derives level upper bounds from the next threshold', () => {
    const levels = getLevels();
    expect(levels.map((l) => [l.min, l.max])).toEqual([
      [0, 49],
      [50, 149],
      [150, 299],
      [300, null],
    ]);
  });

  it('supports admin-configured custom thresholds', () => {
    updateLevels(
      [
        { key: 'observer', name: 'Community Observer', min: 0, description: 'Start' },
        { key: 'star', name: 'Rising Star', min: 30, description: 'Early trust' },
        { key: 'champion', name: 'Civic Champion', min: 90, description: 'Top' },
      ],
      ADMIN,
    );
    expect(getLevelProgress(30).level.key).toBe('star');
    expect(getLevelProgress(89).pointsToNext).toBe(1);
  });

  it('awards achievement badges after the matching verified contribution', () => {
    expect(computeBadges(RESIDENT.id).find((b) => b.key === 'first_report')?.earned).toBe(false);
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'issue.submitted', appEventId: 'ISS-2001' });
    expect(computeBadges(RESIDENT.id).find((b) => b.key === 'first_report')?.earned).toBe(true);
    expect(computeBadges(RESIDENT.id).find((b) => b.key === 'reports_5')?.earned).toBe(false);
  });

  it('never lets balances go negative and records rejections at zero points', () => {
    const res = recordRejection({
      rule: 'reviewRequest',
      citizenId: RESIDENT.id,
      issueId: 'ISS-2001',
      appEvent: 'review.requested',
      appEventId: 'rr-404',
      reason: 'Did not pass validation',
    });
    expect(res.outcome).toBe('rejected');
    expect(res.entry.points).toBe(0);
    expect(getTotalPoints(RESIDENT.id)).toBe(0);
  });
});

describe('duplicate event prevention (idempotency)', () => {
  it('awards an event exactly once — replaying it changes nothing', () => {
    const input = {
      rule: 'issueReport' as const,
      citizenId: RESIDENT.id,
      issueId: 'ISS-2001',
      appEvent: 'issue.submitted',
      appEventId: 'ISS-2001',
    };
    const first = award(input);
    const replay = award({ ...input, appEventId: 'ISS-2001-retry' });

    expect(first.outcome).toBe('awarded');
    expect(replay.outcome).toBe('already_awarded');
    expect(replay.pointsAdded).toBe(0);
    expect(getTotalPoints(RESIDENT.id)).toBe(10); // unchanged
  });

  it('deduplicates on the deterministic rule+issue+citizen key, not the raw event id', () => {
    award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'evidence.submitted', appEventId: 'ev-A' });
    const second = award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'evidence.submitted', appEventId: 'ev-B' });
    expect(second.outcome).toBe('already_awarded');
    expect(getTotalPoints(RESIDENT.id)).toBe(5);
  });

  it('allows the same rule for different citizens and different issues', () => {
    award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'evidence.submitted', appEventId: 'ev-A' });
    award({ rule: 'evidence', citizenId: 'u-priya', issueId: 'ISS-2001', appEvent: 'evidence.submitted', appEventId: 'ev-B' });
    award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-2002', appEvent: 'evidence.submitted', appEventId: 'ev-C' });
    expect(getTotalPoints(RESIDENT.id)).toBe(10);
    expect(getTotalPoints('u-priya')).toBe(5);
  });

  it('treats a decided event as immutable — rejections cannot be re-decided into points', () => {
    recordRejection({ rule: 'reviewRequest', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'review.requested', appEventId: 'rr-1', reason: 'x' });
    const retry = award({ rule: 'reviewRequest', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'review.requested', appEventId: 'rr-2' });
    expect(retry.outcome).toBe('already_rejected');
    expect(getTotalPoints(RESIDENT.id)).toBe(0);
  });
});

describe('anti-farming limits', () => {
  it('enforces the per-issue cap per citizen and records a rejected entry with a reason', () => {
    updateRules({ points: { issueReport: 30 } }, ADMIN);
    const first = award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'issue.submitted', appEventId: 'ISS-2001' });
    const second = award({ rule: 'resolutionConfirmation', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'resolution.confirmed', appEventId: 'res-1' });

    expect(first.outcome).toBe('awarded');
    expect(second.outcome).toBe('rejected');
    expect(second.entry.reason).toContain('per-issue cap');
    expect(getTotalPoints(RESIDENT.id)).toBe(30); // cap 40 prevents 30+15
  });

  it('enforces the daily point cap and raises an awareness flag', () => {
    updateRules({ limits: { dailyPointCap: 20 } }, ADMIN);
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'issue.submitted', appEventId: 'ISS-2001' });
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2002', appEvent: 'issue.submitted', appEventId: 'ISS-2002' });
    const third = award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2003', appEvent: 'issue.submitted', appEventId: 'ISS-2003' });

    expect(third.outcome).toBe('rejected');
    expect(third.entry.reason).toContain('daily cap');
    expect(getScoreSummary(RESIDENT.id).badges); // sanity
    const summary = getScoreSummary(RESIDENT.id);
    expect(summary.rejectedCount).toBe(1);
  });

  it('caps duplicate-report credits per rolling week and flags the pattern', () => {
    updateRules({ limits: { maxDuplicateCreditsPerWeek: 2 } }, ADMIN);
    const mk = (i: number) => ({ rule: 'duplicateReport' as const, citizenId: RESIDENT.id, issueId: `ISS-300${i}`, appEvent: 'issue.duplicate.confirmed', appEventId: `dup-${i}` });
    expect(award(mk(1)).outcome).toBe('awarded');
    expect(award(mk(2)).outcome).toBe('awarded');
    const third = award(mk(3));
    expect(third.outcome).toBe('rejected');
    expect(third.entry.reason).toContain('duplicate-credit cap');
  });

  it('caps recurrence credits per issue', () => {
    updateRules({ limits: { maxRecurrenceCreditsPerIssue: 1 } }, ADMIN);
    const mk = (q: string) => ({ rule: 'recurrenceEvidence' as const, citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'recurrence.confirmed', appEventId: q, eventId: `recurrenceEvidence:ISS-2001:${RESIDENT.id}:${q}` });
    expect(award(mk('q1')).outcome).toBe('awarded');
    expect(award(mk('q2')).outcome).toBe('rejected');
  });
});

describe('scoring configuration & manual adjustments (admin-only)', () => {
  it('sanitises invalid rule values back to safe defaults', () => {
    const rules = updateRules({ points: { issueReport: -5 } }, ADMIN);
    expect(rules.points.issueReport).toBe(10); // invalid input falls back to configured default
  });

  it('writes a configuration audit entry on change', () => {
    updateRules({ points: { evidence: 7 } }, ADMIN);
    const after = updateRules({ points: { evidence: 8 } }, ADMIN);
    expect(after.points.evidence).toBe(8);
  });

  it('applies updated rule values to subsequent awards', () => {
    updateRules({ points: { issueReport: 12 } }, ADMIN);
    const res = award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-2001', appEvent: 'issue.submitted', appEventId: 'ISS-2001' });
    expect(res.pointsAdded).toBe(12);
  });

  it('requires a documented reason and a non-negative result for manual adjustments', () => {
    expect(() => adjustPoints({ citizenId: RESIDENT.id, delta: 5, reason: '  ' }, ADMIN)).toThrow();
    expect(() => adjustPoints({ citizenId: RESIDENT.id, delta: -999, reason: 'harsh' }, ADMIN)).toThrow(/below zero/);
    const entry = adjustPoints({ citizenId: RESIDENT.id, delta: 5, reason: 'Audit correction #A-17' }, ADMIN);
    expect(entry.type).toBe('manual_adjustment');
    expect(entry.validatedBy).toBe(ADMIN.id);
    expect(getTotalPoints(RESIDENT.id)).toBe(5);
  });

  it('rejects non-increasing or duplicate level thresholds', () => {
    expect(() =>
      updateLevels(
        [
          { key: 'a', name: 'One', min: 10, description: '' },
          { key: 'b', name: 'Two', min: 10, description: '' },
        ],
        ADMIN,
      ),
    ).toThrow(/strictly increasing/);
  });
});
