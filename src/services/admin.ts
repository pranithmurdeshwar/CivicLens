/**
 * Admin service — lifecycle actions and moderation. Every function requires an
 * authorised administrator actor. Admins manage rules/policies through
 * civicScore.updateRules & co; residents have no path to edit their own points.
 */
import type { Actor, Issue, IssueResolution } from '../types';
import { NotFoundError, ValidationError } from '../lib/errors';
import { nowIso, uid } from '../lib/ids';
import { mutateIssue } from './db';
import { requireAdmin } from './civicScore';
import { notify } from './notifications';
import { decideDuplicateReview, decideValidation, getValidations } from './validations';

export { decideValidation, decideDuplicateReview, getValidations };

export function acknowledgeIssue(actor: Actor, issueId: string): Issue {
  requireAdmin(actor, 'acknowledge issues');
  const issue = mutateIssue(issueId, (i) => ({ ...i, status: 'acknowledged', updatedAt: nowIso() }));
  if (!issue) throw new NotFoundError('Issue not found.');
  notify({
    userId: issue.reporterId,
    type: 'issue',
    title: `${issue.id} acknowledged`,
    body: 'The ward team has acknowledged your report and queued it for action.',
    link: `/resident/issues/${issue.id}`,
  });
  return issue;
}

export function startProgress(actor: Actor, issueId: string): Issue {
  requireAdmin(actor, 'move issues into progress');
  const issue = mutateIssue(issueId, (i) => ({ ...i, status: 'in_progress', updatedAt: nowIso() }));
  if (!issue) throw new NotFoundError('Issue not found.');
  notify({
    userId: issue.reporterId,
    type: 'issue',
    title: `${issue.id} is now in progress`,
    body: 'Work has started on this issue. We will notify you when a resolution is submitted.',
    link: `/resident/issues/${issue.id}`,
  });
  return issue;
}

/**
 * Submits a resolution. NOTE: this alone never records citizen-confirmed
 * resolution points — the reporter must check on site and confirm.
 */
export function submitResolution(
  actor: Actor,
  issueId: string,
  input: { description: string },
): Issue {
  requireAdmin(actor, 'submit resolutions');
  if (!input.description.trim() || input.description.trim().length < 10) {
    throw new ValidationError('Describe the resolution (at least 10 characters).');
  }
  const resolution: IssueResolution = {
    id: uid('res'),
    description: input.description.trim(),
    submittedAt: nowIso(),
    submittedBy: actor.id,
    confirmedByReporter: false,
  };
  const issue = mutateIssue(issueId, (i) => ({
    ...i,
    status: 'resolved',
    resolution,
    updatedAt: nowIso(),
  }));
  if (!issue) throw new NotFoundError('Issue not found.');
  notify({
    userId: issue.reporterId,
    type: 'issue',
    title: `Resolution submitted for ${issue.id}`,
    body: 'The ward team marked this issue resolved. Please check on site and confirm — resolution points are recorded only after your confirmation.',
    link: `/resident/issues/${issue.id}`,
  });
  return issue;
}

export function closeIssue(actor: Actor, issueId: string, note?: string): Issue {
  requireAdmin(actor, 'close issues');
  const issue = mutateIssue(issueId, (i) => ({
    ...i,
    status: 'closed',
    adminNote: note?.trim() || i.adminNote,
    updatedAt: nowIso(),
  }));
  if (!issue) throw new NotFoundError('Issue not found.');
  notify({
    userId: issue.reporterId,
    type: 'issue',
    title: `${issue.id} closed`,
    body: note?.trim() || 'This issue has been closed by the moderation team.',
    link: `/resident/issues/${issue.id}`,
  });
  return issue;
}

export { acknowledgeIssue as ack };
