/**
 * Validation / review queue.
 *
 * Score-affecting requests that require review (duplicate reports, review
 * requests, recurrence claims, manual-policy evidence) are held as
 * ValidationRequests with a pending ledger entry. Points settle only after an
 * authorised administrator completes the review — never on submission alone.
 */
import type { Actor, AwardResult, ValidationRequest, ValidationType } from '../types';
import type { RuleKey } from '../types';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { nowIso, uid } from '../lib/ids';
import { APP_EVENTS, buildEventId } from '../data/defaults';
import {
  getIssue,
  getValidationsRaw,
  mutateIssue,
  saveValidations,
} from './db';
import {
  createPendingEntry,
  getEntryByEventId,
  getRules,
  requireAdmin,
  settlePending,
} from './civicScore';
import { notify } from './notifications';

export function getValidations(status?: ValidationRequest['status']): ValidationRequest[] {
  const all = getValidationsRaw().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return status ? all.filter((v) => v.status === status) : all;
}

export function getValidation(id: string): ValidationRequest | undefined {
  return getValidationsRaw().find((v) => v.id === id);
}

export interface SubmitValidationInput {
  type: ValidationType;
  issueId: string;
  citizenId: string;
  rule: RuleKey;
  appEvent: string;
  appEventId: string;
  /** Extra qualifier for the idempotency key (e.g. per-claim recurrence). */
  qualifier?: string;
  payload?: Record<string, string>;
  note?: string;
}

export function submitValidation(input: SubmitValidationInput): ValidationRequest {
  const eventId = buildEventId(input.rule, {
    issueId: input.issueId,
    citizenId: input.citizenId,
    qualifier: input.qualifier,
  });
  const existing = getEntryByEventId(eventId);
  if (existing) {
    throw new ConflictError(
      existing.status === 'pending'
        ? 'A request for this contribution is already awaiting review.'
        : `This contribution was already decided earlier (${existing.status}). See the audit trail — events cannot be re-decided.`,
    );
  }

  const request: ValidationRequest = {
    id: uid('val'),
    type: input.type,
    issueId: input.issueId,
    citizenId: input.citizenId,
    rule: input.rule,
    pointsIfApproved: getRules().points[input.rule],
    dedupeEventId: eventId,
    status: 'pending',
    payload: input.payload ?? {},
    note: input.note,
    createdAt: nowIso(),
  };
  saveValidations([request, ...getValidationsRaw()]);

  createPendingEntry({
    rule: input.rule,
    citizenId: input.citizenId,
    issueId: input.issueId,
    appEvent: input.appEvent,
    appEventId: input.appEventId,
    eventId,
  });
  return request;
}

export function decideValidation(
  id: string,
  decision: 'approve' | 'reject',
  actor: Actor,
  note?: string,
): AwardResult {
  requireAdmin(actor, 'decide validation requests');
  const request = getValidation(id);
  if (!request) throw new NotFoundError('Validation request not found.');
  if (request.status !== 'pending') {
    throw new ConflictError('This request has already been decided.');
  }

  let finalDecision = decision;
  let finalNote = note;

  // Review requests are only valid while the issue is still unresolved.
  if (request.type === 'review_request' && decision === 'approve') {
    const issue = getIssue(request.issueId);
    if (!issue || ['resolved', 'closed', 'closed_duplicate'].includes(issue.status)) {
      finalDecision = 'reject';
      finalNote =
        note ??
        'Issue was resolved before the review completed — no longer eligible. No points awarded, none deducted.';
    }
  }

  const result = settlePending(request.dedupeEventId, finalDecision, {
    actor,
    note: finalNote,
    appEventOverride:
      request.type === 'recurrence' && finalDecision === 'approve'
        ? APP_EVENTS.recurrenceConfirmed
        : undefined,
  });

  saveValidations(
    getValidationsRaw().map((v) =>
      v.id === id
        ? {
            ...v,
            status: finalDecision === 'approve' ? ('approved' as const) : ('rejected' as const),
            decidedAt: nowIso(),
            decidedBy: actor.id,
            decisionNote: finalNote,
          }
        : v,
    ),
  );

  // Side effect on approval: a confirmed recurrence reopens the issue.
  if (request.type === 'recurrence' && finalDecision === 'approve') {
    mutateIssue(request.issueId, (i) => ({
      ...i,
      status: 'in_progress',
      recurrenceCount: i.recurrenceCount + 1,
      updatedAt: nowIso(),
    }));
    notify({
      userId: request.citizenId,
      type: 'review',
      title: 'Recurrence confirmed — issue reopened',
      body: `Your recurrence report on ${request.issueId} was verified. The issue has been reopened for action.`,
      link: `/resident/issues/${request.issueId}`,
    });
  }
  if (request.type === 'recurrence' && finalDecision === 'reject') {
    notify({
      userId: request.citizenId,
      type: 'review',
      title: 'Recurrence claim not confirmed',
      body: `Moderators could not verify the recurrence on ${request.issueId}. No points were deducted.`,
      link: `/resident/issues/${request.issueId}`,
    });
  }
  if (request.type === 'review_request' && finalDecision === 'approve') {
    notify({
      userId: request.citizenId,
      type: 'review',
      title: 'Review request validated',
      body: `Your review request on ${request.issueId} passed validation. Thank you for following up responsibly.`,
      link: `/resident/issues/${request.issueId}`,
    });
  }

  return result;
}

/**
 * Completes a duplicate review. Only after this review completes may the
 * reporter receive +2 (duplicate) or the full report credit (independent),
 * preserving attribution for the original reporter either way.
 */
export function decideDuplicateReview(
  id: string,
  outcome: 'independent' | 'duplicate',
  actor: Actor,
  opts: { parentIssueId?: string; note?: string } = {},
): AwardResult {
  requireAdmin(actor, 'decide duplicate reviews');
  const request = getValidation(id);
  if (!request) throw new NotFoundError('Validation request not found.');
  if (request.status !== 'pending') throw new ConflictError('This review has already been decided.');

  const rules = getRules();
  let result: AwardResult;

  if (outcome === 'duplicate') {
    const parentId = opts.parentIssueId;
    if (!parentId) throw new ValidationError('Select the original issue this report duplicates.');
    if (parentId === request.issueId) {
      throw new ValidationError('An issue cannot be a duplicate of itself.');
    }
    const parent = getIssue(parentId);
    if (!parent) throw new ValidationError('The selected original issue no longer exists.');

    mutateIssue(request.issueId, (i) => ({
      ...i,
      status: 'closed_duplicate',
      duplicateOfIssueId: parent.id,
      duplicateReviewStatus: 'confirmed_duplicate',
      updatedAt: nowIso(),
    }));

    result = settlePending(request.dedupeEventId, 'approve', {
      actor,
      note: opts.note ?? `Confirmed duplicate of ${parent.id} — credit awarded, attribution preserved`,
      pointsOverride: rules.points.duplicateReport,
      typeOverride: 'duplicate_report',
      appEventOverride: APP_EVENTS.issueDuplicateConfirmed,
    });

    notify({
      userId: request.citizenId,
      type: 'review',
      title: `Duplicate review completed — +${rules.points.duplicateReport} points`,
      body: `Your report ${request.issueId} matched ${parent.id}. You receive a small credit; the original reporter keeps full attribution.`,
      link: `/resident/issues/${parent.id}`,
    });
  } else {
    mutateIssue(request.issueId, (i) => ({
      ...i,
      duplicateReviewStatus: 'confirmed_independent',
      updatedAt: nowIso(),
    }));
    result = settlePending(request.dedupeEventId, 'approve', {
      actor,
      note: opts.note ?? 'Confirmed as an independent report — full reporter credit',
    });
    notify({
      userId: request.citizenId,
      type: 'review',
      title: 'Report confirmed independent',
      body: `${request.issueId} was verified as a genuinely new issue. Full reporter credit recorded.`,
      link: `/resident/issues/${request.issueId}`,
    });
  }

  saveValidations(
    getValidationsRaw().map((v) =>
      v.id === id
        ? {
            ...v,
            status: 'approved',
            decidedAt: nowIso(),
            decidedBy: actor.id,
            decisionNote: opts.note ?? (outcome === 'duplicate' ? `Duplicate of ${opts.parentIssueId}` : 'Independent'),
            payload: outcome === 'duplicate' ? { ...v.payload, parentIssueId: String(opts.parentIssueId) } : v.payload,
          }
        : v,
    ),
  );
  return result;
}
