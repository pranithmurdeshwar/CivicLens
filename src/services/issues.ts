/**
 * Issue domain service — the citizen-facing workflows that Civic Score hooks
 * into. Points are recorded only AFTER the underlying action succeeds.
 */
import type { Actor, AwardResult, Evidence, EvidenceType, Issue, IssueCategory, IssueMedia, Severity, ValidationRequest } from '../types';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { DAY_MS, nowIso, uid } from '../lib/ids';
import { APP_EVENTS, buildEventId } from '../data/defaults';
import {
  getEvidence,
  getEvidenceForIssue,
  getIssue,
  getIssues,
  getUser,
  insertEvidence,
  insertIssue,
  mutateIssue,
  saveIssues,
} from './db';
import { award, getEntryByEventId, getRules, raiseAbuseFlag } from './civicScore';
import { submitValidation } from './validations';
import { notify } from './notifications';

const UNRESOLVED: Issue['status'][] = ['submitted', 'acknowledged', 'in_progress'];

/* --------------------------------- queries ---------------------------------- */

export function getAllIssues(): Issue[] {
  return [...getIssues()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findIssue(id: string): Issue | undefined {
  return getIssue(id);
}

export function getIssuesByReporter(reporterId: string): Issue[] {
  return getAllIssues().filter((i) => i.reporterId === reporterId);
}

export function getIssueEvidence(issueId: string): Evidence[] {
  return getEvidenceForIssue(issueId);
}

/** Area-level duplicate detection (no coordinates are used anywhere). */
export function findSimilarIssues(
  candidate: { category: IssueCategory; area: string; excludeId?: string },
  issues: Issue[] = getIssues(),
): Issue[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const cutoff = Date.now() - 90 * DAY_MS;
  return issues.filter(
    (i) =>
      i.id !== candidate.excludeId &&
      i.category === candidate.category &&
      norm(i.area) === norm(candidate.area) &&
      i.status !== 'closed_duplicate' &&
      new Date(i.createdAt).getTime() >= cutoff,
  );
}

/* ------------------------------- report an issue ----------------------------- */

export interface ReportIssueInput {
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  area: string;
  landmark?: string;
  media?: IssueMedia[];
}

export interface ReportIssueResult {
  issue: Issue;
  duplicateSuspected: boolean;
  similar: Issue[];
  award: AwardResult | null;
  message: string;
}

function generateIssueId(existing: Issue[]): string {
  let n = existing.length + 1001;
  let id = `ISS-${n}`;
  while (existing.some((i) => i.id === id)) {
    n += 1;
    id = `ISS-${n}`;
  }
  return id;
}

export function reportIssue(actor: Actor, input: ReportIssueInput): ReportIssueResult {
  if (actor.kind !== 'user' || !actor.id) {
    throw new AuthorizationError('Sign in as a citizen to report issues.');
  }
  const errors: string[] = [];
  if (input.title.trim().length < 8) errors.push('Title must be at least 8 characters.');
  if (input.description.trim().length < 20) errors.push('Please describe the issue in at least 20 characters.');
  if (!input.area.trim()) errors.push('Enter the area / street so the issue can be located.');
  if (errors.length) throw new ValidationError(errors.join(' '));

  const issues = getIssues();
  const user = getUser(actor.id);
  const now = nowIso();
  const issue: Issue = {
    id: generateIssueId(issues),
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    severity: input.severity,
    status: 'submitted',
    reporterId: actor.id,
    ward: user?.ward ?? 'Unlisted ward (demo)',
    area: input.area.trim(),
    landmark: input.landmark?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    recurrenceCount: 0,
    media: input.media && input.media.length > 0 ? input.media : undefined,
  };

  if (input.media && input.media.length > 0) {
    for (const m of input.media) {
      insertEvidence({
        id: uid('ev'),
        issueId: issue.id,
        submittedById: actor.id,
        type: m.type,
        note: `Attached with complaint report: ${m.name}`,
        createdAt: now,
        mediaUrl: m.url,
        mediaName: m.name,
      });
    }
  }

  const similar = findSimilarIssues(
    { category: issue.category, area: issue.area, excludeId: issue.id },
    issues,
  );
  const rules = getRules();
  let awardResult: AwardResult | null = null;
  let message: string;

  if (similar.length > 0) {
    // Possible duplicate: no points until a moderator completes the review.
    issue.duplicateReviewStatus = 'flagged';
    insertIssue(issue);
    submitValidation({
      type: 'duplicate_review',
      issueId: issue.id,
      citizenId: actor.id,
      rule: 'issueReport',
      appEvent: APP_EVENTS.issueSubmitted,
      appEventId: issue.id,
      payload: {
        similarIssueIds: similar.map((i) => i.id).join(','),
        area: issue.area,
        category: issue.category,
      },
      note: 'Flagged automatically — same category and area as an existing report.',
    });
    message =
      `Report ${issue.id} submitted. We found ${similar.length} similar issue${similar.length > 1 ? 's' : ''} in this area, ` +
      `so it is queued for duplicate review: a moderator will confirm whether it is independent (+${rules.points.issueReport} pts) ` +
      `or a duplicate (+${rules.points.duplicateReport} pts, attribution preserved). No points are recorded until the review completes.`;
  } else {
    insertIssue(issue);
    if (rules.policies.newIssueValidation === 'auto') {
      awardResult = award({
        rule: 'issueReport',
        citizenId: actor.id,
        issueId: issue.id,
        appEvent: APP_EVENTS.issueSubmitted,
        appEventId: issue.id,
        validatedBy: 'system',
      });
      message = `Report ${issue.id} submitted and validated — thank you.`;
    } else {
      submitValidation({
        type: 'new_issue',
        issueId: issue.id,
        citizenId: actor.id,
        rule: 'issueReport',
        appEvent: APP_EVENTS.issueSubmitted,
        appEventId: issue.id,
      });
      message = `Report ${issue.id} submitted and queued for validation.`;
    }
  }

  // Anti-farming awareness flag (no automatic penalty).
  const lastHour = issues.filter(
    (i) => i.reporterId === actor.id && Date.now() - new Date(i.createdAt).getTime() < 3_600_000,
  );
  if (lastHour.length + 1 >= 5) {
    raiseAbuseFlag({
      citizenId: actor.id,
      type: 'rapid_submissions',
      severity: 'medium',
      detail: `${lastHour.length + 1} reports filed within one hour — flagged for awareness (no automatic penalty).`,
    });
  }

  notify({
    userId: actor.id,
    type: 'issue',
    title: `Report ${issue.id} received`,
    body: 'Your report is in the moderation workflow. You will be notified as its status changes.',
    link: `/resident/issues/${issue.id}`,
  });

  return { issue, duplicateSuspected: similar.length > 0, similar, award: awardResult, message };
}

/* ------------------------------ submit evidence ------------------------------ */

export interface EvidenceResult {
  evidence: Evidence;
  outcome: 'awarded' | 'pending_review' | 'not_eligible' | 'already_recorded';
  award: AwardResult | null;
  message: string;
}

export function addEvidence(
  actor: Actor,
  input: { issueId: string; type: EvidenceType; note: string; mediaUrl?: string; mediaName?: string },
): EvidenceResult {
  const issue = getIssue(input.issueId);
  if (!issue) throw new NotFoundError('Issue not found.');
  if (['closed', 'closed_duplicate'].includes(issue.status)) {
    throw new ValidationError('This issue is closed — evidence can no longer be added.');
  }
  if (!input.note.trim()) throw new ValidationError('Add a short note describing the evidence.');

  const evidence: Evidence = {
    id: uid('ev'),
    issueId: issue.id,
    submittedById: actor.id,
    type: input.type,
    note: input.note.trim(),
    createdAt: nowIso(),
    mediaUrl: input.mediaUrl,
    mediaName: input.mediaName,
  };
  insertEvidence(evidence);

  mutateIssue(issue.id, (i) => ({
    ...i,
    media: input.mediaUrl
      ? [
          ...(i.media || []),
          {
            id: evidence.id,
            name: input.mediaName || 'Evidence upload',
            type: input.type === 'video' ? 'video' : 'photo',
            url: input.mediaUrl,
          },
        ]
      : i.media,
    updatedAt: nowIso(),
  }));

  const rules = getRules();
  const eventId = buildEventId('evidence', { issueId: issue.id, citizenId: actor.id });

  // The evidence rule is applied only ONCE per issue per contributor.
  if (getEntryByEventId(eventId)) {
    return {
      evidence,
      outcome: 'already_recorded',
      award: null,
      message:
        'Evidence saved. Supporting-evidence points for this issue were already recorded once — one award per issue per contributor.',
    };
  }

  if (rules.policies.evidenceValidation === 'auto') {
    if (evidence.note.length < rules.limits.minEvidenceNoteLength) {
      return {
        evidence,
        outcome: 'not_eligible',
        award: null,
        message: `Evidence saved. Add at least ${rules.limits.minEvidenceNoteLength} characters of context for it to qualify as useful supporting evidence (+${rules.points.evidence} pts).`,
      };
    }
    const awardResult = award({
      rule: 'evidence',
      citizenId: actor.id,
      issueId: issue.id,
      appEvent: APP_EVENTS.evidenceSubmitted,
      appEventId: evidence.id,
      validatedBy: 'system',
    });
    return {
      evidence,
      outcome: awardResult.outcome === 'awarded' ? 'awarded' : 'not_eligible',
      award: awardResult,
      message:
        awardResult.outcome === 'awarded'
          ? 'Evidence saved and validated as useful supporting evidence.'
          : 'Evidence saved, but no additional points were recorded for this event.',
    };
  }

  submitValidation({
    type: 'evidence',
    issueId: issue.id,
    citizenId: actor.id,
    rule: 'evidence',
    appEvent: APP_EVENTS.evidenceSubmitted,
    appEventId: evidence.id,
    note: 'Evidence submitted — manual validation policy is active.',
  });
  return {
    evidence,
    outcome: 'pending_review',
    award: null,
    message: 'Evidence saved and queued for moderator validation.',
  };
}

/* --------------------------- confirm a resolution ---------------------------- */

export function confirmResolution(
  actor: Actor,
  input: { issueId: string; verifiedOnSite: boolean },
): { award: AwardResult | null; message: string } {
  const issue = getIssue(input.issueId);
  if (!issue) throw new NotFoundError('Issue not found.');
  if (actor.id !== issue.reporterId) {
    throw new AuthorizationError('Only the original reporter can confirm a resolution.');
  }
  if (!issue.resolution || issue.status !== 'resolved') {
    throw new ValidationError('There is no submitted resolution to confirm yet.');
  }
  if (issue.resolution.confirmedByReporter) {
    throw new ConflictError('This resolution has already been confirmed.');
  }
  if (!input.verifiedOnSite) {
    throw new ValidationError(
      'Please tick the on-site verification box — points are only awarded after you have actually checked the location.',
    );
  }

  // Action first, points second.
  mutateIssue(issue.id, (i) => ({
    ...i,
    resolution: i.resolution
      ? { ...i.resolution, confirmedByReporter: true, confirmedAt: nowIso(), confirmedBy: actor.id }
      : undefined,
    updatedAt: nowIso(),
  }));

  const awardResult = award({
    rule: 'resolutionConfirmation',
    citizenId: actor.id,
    issueId: issue.id,
    appEvent: APP_EVENTS.resolutionConfirmed,
    appEventId: issue.resolution.id,
    validatedBy: 'system',
  });

  return {
    award: awardResult,
    message: 'Thank you for verifying on site — your confirmation has been recorded.',
  };
}

/* ------------------------------- request review ------------------------------ */

export function requestReview(
  actor: Actor,
  input: { issueId: string; note?: string },
): { award: AwardResult | null; validation: ValidationRequest | null; message: string } {
  const issue = getIssue(input.issueId);
  if (!issue) throw new NotFoundError('Issue not found.');
  if (!UNRESOLVED.includes(issue.status)) {
    throw new ValidationError('This issue is already resolved or closed — review requests apply to unresolved issues.');
  }
  const rules = getRules();
  const ageDays = (Date.now() - new Date(issue.createdAt).getTime()) / DAY_MS;
  if (ageDays < rules.limits.reviewRequestMinDaysUnresolved) {
    throw new ValidationError(
      `Review requests open ${rules.limits.reviewRequestMinDaysUnresolved} days after reporting — this issue was reported ` +
        `${Math.floor(ageDays)} day(s) ago. Genuine unresolved reports are never penalised; there is simply nothing to request yet.`,
    );
  }

  if (rules.policies.reviewRequestValidation === 'auto') {
    const awardResult = award({
      rule: 'reviewRequest',
      citizenId: actor.id,
      issueId: issue.id,
      appEvent: APP_EVENTS.reviewRequested,
      appEventId: uid('rr'),
      validatedBy: 'system:auto-policy',
      reason: 'Review request auto-validated (issue still unresolved past the minimum window)',
    });
    return {
      award: awardResult,
      validation: null,
      message:
        awardResult.outcome === 'awarded'
          ? 'Review request validated automatically — the ward team has been asked to look again.'
          : 'Review request recorded. No additional points were recorded for this event.',
    };
  }

  const appEventId = uid('rr');
  const validation = submitValidation({
    type: 'review_request',
    issueId: issue.id,
    citizenId: actor.id,
    rule: 'reviewRequest',
    appEvent: APP_EVENTS.reviewRequested,
    appEventId,
    payload: { issueAgeDays: String(Math.floor(ageDays)) },
    note: input.note?.trim() || 'Reporter requests a re-check: the issue remains unresolved.',
  });
  notify({
    userId: actor.id,
    type: 'review',
    title: 'Review request submitted',
    body: `Your request on ${issue.id} is awaiting validation. Points are awarded only after it passes review.`,
    link: `/resident/issues/${issue.id}`,
  });
  return {
    award: null,
    validation,
    message: 'Review request submitted — it will be validated by the moderation team before any points are recorded.',
  };
}

/* ------------------------------ report recurrence ---------------------------- */

export function reportRecurrence(
  actor: Actor,
  input: { issueId: string; note: string },
): { validation: ValidationRequest; message: string } {
  const issue = getIssue(input.issueId);
  if (!issue) throw new NotFoundError('Issue not found.');
  if (issue.status !== 'resolved') {
    throw new ValidationError('Recurrence can be reported on issues that are currently marked resolved.');
  }
  if (input.note.trim().length < 10) {
    throw new ValidationError('Describe what you observed (at least 10 characters) — moderators verify recurrence claims before any points are recorded.');
  }

  insertEvidence({
    id: uid('ev'),
    issueId: issue.id,
    submittedById: actor.id,
    type: 'description',
    note: `[Recurrence] ${input.note.trim()}`,
    createdAt: nowIso(),
  });

  const appEventId = uid('rec');
  const validation = submitValidation({
    type: 'recurrence',
    issueId: issue.id,
    citizenId: actor.id,
    rule: 'recurrenceEvidence',
    appEvent: APP_EVENTS.recurrenceClaimed,
    appEventId,
    qualifier: appEventId, // each recurrence claim is its own idempotent event
    note: 'Recurrence claim — verified only after moderator review.',
  });
  notify({
    userId: actor.id,
    type: 'review',
    title: 'Recurrence claim submitted',
    body: `Your recurrence report on ${issue.id} is awaiting verification. The issue will be reopened if it is confirmed.`,
    link: `/resident/issues/${issue.id}`,
  });
  return {
    validation,
    message: 'Recurrence claim submitted — moderators will verify it. Points are recorded only after verification.',
  };
}

/* ---------------------------------- helpers ---------------------------------- */

export function countIssuesToday(actorId: string): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return getIssues().filter(
    (i) => i.reporterId === actorId && new Date(i.createdAt).getTime() >= startOfDay.getTime(),
  ).length;
}

export function allEvidenceCount(): number {
  return getEvidence().length;
}

void saveIssues;
