import { describe, it, expect, beforeEach } from 'vitest';
import { resetTestState, backdate } from './helpers';
import {
  addEvidence,
  confirmResolution,
  findIssue,
  reportIssue,
  reportRecurrence,
  requestReview,
} from '../issues';
import { acknowledgeIssue, startProgress, submitResolution } from '../admin';
import { decideDuplicateReview, decideValidation } from '../validations';
import { getEntryByEventId, getTotalPoints, updateRules } from '../civicScore';
import { getLedgerRaw, getValidationsRaw } from '../db';
import { buildEventId } from '../../data/defaults';
import { AuthorizationError, ValidationError } from '../../lib/errors';
import { daysAgo } from '../../lib/ids';

const AARAV = { id: 'u-aarav', role: 'resident' as const, kind: 'user' as const };
const PRIYA = { id: 'u-priya', role: 'resident' as const, kind: 'user' as const };
const ADMIN = { id: 'u-meera', role: 'admin' as const, kind: 'user' as const };

const REPORT = {
  title: 'Broken manhole cover on main road',
  description: 'The manhole cover near the bus stop is broken and half open. Two-wheelers could fall in during the evening rush.',
  category: 'roads' as const,
  severity: 'high' as const,
  area: 'Test Area',
};

beforeEach(() => resetTestState());

describe('issue report → score', () => {
  it('records the report contribution after a valid submission succeeds', () => {
    const res = reportIssue(AARAV, REPORT);
    expect(res.award?.outcome).toBe('awarded');
    expect(res.award?.pointsAdded).toBe(10);
    expect(getEntryByEventId(buildEventId('issueReport', { issueId: res.issue.id, citizenId: AARAV.id }))?.appEvent).toBe('issue.submitted');
    expect(getTotalPoints(AARAV.id)).toBe(10);
  });

  it('queues flagged duplicates for review instead of awarding immediately', () => {
    reportIssue(AARAV, { ...REPORT, title: 'First broken manhole cover report' });
    const res = reportIssue(PRIYA, { ...REPORT, title: 'Second broken manhole cover report' });
    expect(res.duplicateSuspected).toBe(true);
    expect(res.award).toBeNull();
    expect(getTotalPoints(PRIYA.id)).toBe(0);
  });

  it('completes the duplicate review: small credit for duplicates, full attribution preserved', () => {
    const first = reportIssue(AARAV, { ...REPORT, title: 'Original broken manhole cover report' });
    reportIssue(PRIYA, { ...REPORT, title: 'Duplicate broken manhole cover report' });
    const pending = getLedgerRaw().find((e) => e.citizenId === PRIYA.id && e.status === 'pending');
    expect(pending).toBeDefined();

    decideDuplicateReview(getPendingRequestId(PRIYA.id), 'duplicate', ADMIN, { parentIssueId: first.issue.id });
    expect(findIssue(first.issue.id)?.status).toBe('submitted'); // original untouched
    expect(getTotalPoints(PRIYA.id)).toBe(2); // +2 duplicate credit
    expect(getTotalPoints(AARAV.id)).toBe(10); // original keeps full attribution
  });

  it('awards independent reports the full reporter credit without review', () => {
    reportIssue(AARAV, { ...REPORT, title: 'Independent manhole report one' });
    const other = reportIssue(PRIYA, {
      ...REPORT,
      title: 'Independent streetlight outage report',
      category: 'streetlight',
      area: 'Other Area',
    });
    expect(other.duplicateSuspected).toBe(false);
    expect(getTotalPoints(PRIYA.id)).toBe(10);
  });

  it('supports manual validation policy for new reports', () => {
    updateRules({ policies: { newIssueValidation: 'manual' } }, ADMIN);
    const res = reportIssue(AARAV, REPORT);
    expect(res.award).toBeNull();
    expect(getTotalPoints(AARAV.id)).toBe(0);
    decideValidation(getPendingRequestId(AARAV.id), 'approve', ADMIN);
    expect(getTotalPoints(AARAV.id)).toBe(10);
  });

  it('attaches uploaded images and videos when reporting an issue', () => {
    const res = reportIssue(AARAV, {
      ...REPORT,
      media: [
        { id: 'm1', name: 'pothole.jpg', type: 'photo', url: 'data:image/jpeg;base64,fakejpg', size: 1024 },
        { id: 'm2', name: 'waterflow.mp4', type: 'video', url: 'data:video/mp4;base64,fakevideo', size: 2048 },
      ],
    });
    expect(res.issue.media).toHaveLength(2);
    expect(res.issue.media?.[0].name).toBe('pothole.jpg');
    expect(res.issue.media?.[0].type).toBe('photo');
    expect(res.issue.media?.[1].name).toBe('waterflow.mp4');
    expect(res.issue.media?.[1].type).toBe('video');

    const issueEvidence = getLedgerRaw(); // sanity check
    expect(res.award?.outcome).toBe('awarded');
  });
});

describe('evidence → score', () => {
  it('applies the evidence rule exactly once per issue per contributor', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    const first = addEvidence(PRIYA, { issueId: issue.id, type: 'photo', note: 'Photo of the open manhole from this morning.' });
    expect(first.outcome).toBe('awarded');
    expect(first.award?.pointsAdded).toBe(5);

    const second = addEvidence(PRIYA, { issueId: issue.id, type: 'photo', note: 'Another photo from the evening, still open.' });
    expect(second.outcome).toBe('already_recorded');
    expect(second.award).toBeNull();
    expect(getTotalPoints(PRIYA.id)).toBe(5);
  });

  it('requires useful context before auto-validating evidence', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    const short = addEvidence(PRIYA, { issueId: issue.id, type: 'photo', note: 'pic' });
    expect(short.outcome).toBe('not_eligible');
    expect(getTotalPoints(PRIYA.id)).toBe(0);
  });

  it('supports manual evidence validation policy', () => {
    updateRules({ policies: { evidenceValidation: 'manual' } }, ADMIN);
    const { issue } = reportIssue(AARAV, REPORT);
    const res = addEvidence(PRIYA, { issueId: issue.id, type: 'photo', note: 'Photo of the open manhole from this morning.' });
    expect(res.outcome).toBe('pending_review');
    decideValidation(getPendingRequestId(PRIYA.id), 'approve', ADMIN);
    expect(getTotalPoints(PRIYA.id)).toBe(5);
  });

  it('persists media attachments on supporting evidence and issue', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    const res = addEvidence(PRIYA, {
      issueId: issue.id,
      type: 'photo',
      note: 'Detailed photo showing the depth of the trench.',
      mediaUrl: 'data:image/png;base64,sampleimage',
      mediaName: 'trench.png',
    });
    expect(res.outcome).toBe('awarded');
    expect(res.evidence.mediaUrl).toBe('data:image/png;base64,sampleimage');
    expect(res.evidence.mediaName).toBe('trench.png');

    const updated = findIssue(issue.id);
    expect(updated?.media?.some((m) => m.name === 'trench.png')).toBe(true);
  });
});

describe('resolution → citizen confirmation → score', () => {
  it('never counts resolution-submitted alone; reporter must confirm after checking', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    acknowledgeIssue(ADMIN, issue.id);
    startProgress(ADMIN, issue.id);
    submitResolution(ADMIN, issue.id, { description: 'Cover replaced and sealed.' });

    expect(findIssue(issue.id)?.status).toBe('resolved');
    expect(getLedgerRaw().filter((e) => e.type === 'resolution_confirmation')).toHaveLength(0);
    expect(getTotalPoints(AARAV.id)).toBe(10); // only the report

    const confirm = confirmResolution(AARAV, { issueId: issue.id, verifiedOnSite: true });
    expect(confirm.award?.outcome).toBe('awarded');
    expect(confirm.award?.pointsAdded).toBe(15);
    expect(getTotalPoints(AARAV.id)).toBe(25);
  });

  it('refuses confirmation without the on-site check and blocks double confirmation', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    submitResolution(ADMIN, issue.id, { description: 'Cover replaced and sealed.' });

    expect(() => confirmResolution(AARAV, { issueId: issue.id, verifiedOnSite: false })).toThrow(ValidationError);
    expect(getTotalPoints(AARAV.id)).toBe(10);

    confirmResolution(AARAV, { issueId: issue.id, verifiedOnSite: true });
    expect(() => confirmResolution(AARAV, { issueId: issue.id, verifiedOnSite: true })).toThrow(/already been confirmed/);
    expect(getTotalPoints(AARAV.id)).toBe(25); // awarded exactly once
  });

  it('only the original reporter can confirm a resolution', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    submitResolution(ADMIN, issue.id, { description: 'Cover replaced and sealed.' });
    expect(() => confirmResolution(PRIYA, { issueId: issue.id, verifiedOnSite: true })).toThrow(AuthorizationError);
    expect(getLedgerRaw().filter((e) => e.type === 'resolution_confirmation')).toHaveLength(0);
  });
});

describe('review requests → validation → score', () => {
  it('rejects review requests before the configured window (no penalty)', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    expect(() => requestReview(AARAV, { issueId: issue.id })).toThrow(ValidationError);
    expect(getTotalPoints(AARAV.id)).toBe(10); // report intact, nothing deducted
  });

  it('settles a validated review request only after an admin decision (manual policy default)', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    backdate('issues', issue.id, 'createdAt', daysAgo(5));

    const res = requestReview(AARAV, { issueId: issue.id });
    expect(res.award).toBeNull();
    expect(getTotalPoints(AARAV.id)).toBe(10);

    decideValidation(getPendingRequestId(AARAV.id), 'approve', ADMIN);
    expect(getTotalPoints(AARAV.id)).toBe(20);
  });

  it('does not award review-request points once the issue is already resolved', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    backdate('issues', issue.id, 'createdAt', daysAgo(5));
    requestReview(AARAV, { issueId: issue.id });
    submitResolution(ADMIN, issue.id, { description: 'Fixed while the review was pending.' });

    decideValidation(getPendingRequestId(AARAV.id), 'approve', ADMIN);
    expect(getTotalPoints(AARAV.id)).toBe(10); // review not granted — issue no longer unresolved
  });

  it('supports the automatic review-request policy', () => {
    updateRules({ policies: { reviewRequestValidation: 'auto' } }, ADMIN);
    const { issue } = reportIssue(AARAV, REPORT);
    backdate('issues', issue.id, 'createdAt', daysAgo(5));
    const res = requestReview(AARAV, { issueId: issue.id });
    expect(res.award?.outcome).toBe('awarded');
    expect(getTotalPoints(AARAV.id)).toBe(20);
  });
});

describe('recurrence → verified evidence → score', () => {
  it('awards recurrence points only after verification', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    submitResolution(ADMIN, issue.id, { description: 'Cover replaced.' });
    confirmResolution(AARAV, { issueId: issue.id, verifiedOnSite: true });
    const before = getTotalPoints(PRIYA.id);

    const claim = reportRecurrence(PRIYA, { issueId: issue.id, note: 'Cover is broken again since Monday night.' });
    expect(claim.validation.status).toBe('pending');
    expect(getTotalPoints(PRIYA.id)).toBe(before); // nothing yet

    decideValidation(claim.validation.id, 'approve', ADMIN);
    expect(getTotalPoints(PRIYA.id)).toBe(before + 5);
    expect(getLedgerRaw().find((e) => e.eventId === claim.validation.dedupeEventId)?.appEvent).toBe('recurrence.confirmed');
  });

  it('reopens the issue on verified recurrence without punishing the original reporter', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    submitResolution(ADMIN, issue.id, { description: 'Cover replaced.' });
    confirmResolution(AARAV, { issueId: issue.id, verifiedOnSite: true });
    const reporterPoints = getTotalPoints(AARAV.id);

    const claim = reportRecurrence(PRIYA, { issueId: issue.id, note: 'The patch has collapsed again after rain.' });
    decideValidation(claim.validation.id, 'approve', ADMIN);

    const updated = findIssue(issue.id);
    expect(updated?.status).toBe('in_progress');
    expect(updated?.recurrenceCount).toBe(1);
    expect(getTotalPoints(AARAV.id)).toBe(reporterPoints); // untouched — no deductions
  });

  it('records unverified recurrence claims as not awarded (never negative)', () => {
    const { issue } = reportIssue(AARAV, REPORT);
    submitResolution(ADMIN, issue.id, { description: 'Cover replaced.' });
    const claim = reportRecurrence(PRIYA, { issueId: issue.id, note: 'Might be the same as before.' });
    decideValidation(claim.validation.id, 'reject', ADMIN);
    const entry = getLedgerRaw().find((e) => e.eventId === claim.validation.dedupeEventId);
    expect(entry?.status).toBe('rejected');
    expect(entry?.points).toBe(0);
    expect(getTotalPoints(PRIYA.id)).toBe(0);
  });
});

/* ------------------------------- helpers ---------------------------------- */

function getPendingRequestId(citizenId: string): string {
  const pending = getLedgerRaw().find((e) => e.citizenId === citizenId && e.status === 'pending');
  if (!pending) throw new Error('No pending validation found in test setup');
  const req = getValidationsRaw().find((v) => v.dedupeEventId === pending.eventId);
  if (!req) throw new Error('No matching validation request');
  return req.id;
}
