import type { ContributionType, RecognitionLevel, RuleKey, ScoreRulesConfig, BadgeDef, ValidationType } from '../types';

/**
 * PROVISIONAL DEMO SCORING RULES — not universal standards.
 * These values are configurable defaults; authorised administrators can change
 * them in Admin → Civic Score.
 */
export const SCORING_DISCLAIMER =
  'Provisional demo rules for the CivicLens AI prototype — they are configurable defaults, not universal standards.';

export const DEFAULT_RULES: ScoreRulesConfig = {
  points: {
    // Valid, actionable issue report
    issueReport: 10,
    // Useful supporting evidence
    evidence: 5,
    // Reporter confirms a resolution after checking it on site
    resolutionConfirmation: 15,
    // Supported review request on an issue that remains unresolved (after validation)
    reviewRequest: 10,
    // Verified recurrence evidence
    recurrenceEvidence: 5,
    // Confirmed duplicate report (attribution preserved)
    duplicateReport: 2,
  },
  limits: {
    maxPointsPerIssuePerCitizen: 40,
    dailyPointCap: 100,
    maxDuplicateCreditsPerWeek: 3,
    maxRecurrenceCreditsPerIssue: 2,
    minEvidenceNoteLength: 10,
    reviewRequestMinDaysUnresolved: 3,
  },
  policies: {
    newIssueValidation: 'auto',
    evidenceValidation: 'auto',
    reviewRequestValidation: 'manual',
  },
};

/** Configurable recognition levels (min is stored; max derived from next level). */
export const DEFAULT_LEVELS: Omit<RecognitionLevel, 'max'>[] = [
  {
    key: 'observer',
    name: 'Community Observer',
    min: 0,
    description: 'Getting started — every verified contribution counts.',
  },
  {
    key: 'contributor',
    name: 'Civic Contributor',
    min: 50,
    description: 'A trusted voice: verified reports and evidence.',
  },
  {
    key: 'guardian',
    name: 'Community Guardian',
    min: 150,
    description: 'Consistently helps verify and close out neighbourhood issues.',
  },
  {
    key: 'champion',
    name: 'Civic Champion',
    min: 300,
    description: 'Sustained, verified civic contribution across the community.',
  },
];

export const BADGE_DEFS: BadgeDef[] = [
  { key: 'first_report', name: 'First Voice', description: 'First verified issue report', icon: 'flag' },
  { key: 'reports_5', name: 'Reliable Reporter', description: 'Five verified issue reports', icon: 'list' },
  { key: 'first_evidence', name: 'Evidence Contributor', description: 'First verified supporting evidence', icon: 'camera' },
  { key: 'resolution_verifier', name: 'Resolution Verifier', description: 'Confirmed a resolution after checking on site', icon: 'check-circle' },
  { key: 'review_advocate', name: 'Review Advocate', description: 'First validated review request on an unresolved issue', icon: 'search' },
  { key: 'watchdog', name: 'Community Watchdog', description: 'First verified recurrence report', icon: 'refresh-cw' },
  { key: 'level_contributor', name: 'Civic Contributor', description: 'Reached the Civic Contributor level', icon: 'award' },
  { key: 'level_guardian', name: 'Community Guardian', description: 'Reached the Community Guardian level', icon: 'shield' },
  { key: 'level_champion', name: 'Civic Champion', description: 'Reached the Civic Champion level', icon: 'star' },
];

export interface RuleMeta {
  label: string;
  contribution: ContributionType;
  description: string;
  icon: string;
}

export const RULE_META: Record<RuleKey, RuleMeta> = {
  issueReport: {
    label: 'Issue report',
    contribution: 'issue_report',
    description: 'Valid, actionable issue report',
    icon: 'flag',
  },
  evidence: {
    label: 'Supporting evidence',
    contribution: 'evidence',
    description: 'Useful supporting evidence (once per issue per contributor)',
    icon: 'camera',
  },
  resolutionConfirmation: {
    label: 'Resolution confirmation',
    contribution: 'resolution_confirmation',
    description: 'Reporter confirmed a resolution after checking it on site',
    icon: 'check-circle',
  },
  reviewRequest: {
    label: 'Review request',
    contribution: 'review_request',
    description: 'Supported review request on an issue that remains unresolved — awarded after validation',
    icon: 'search',
  },
  recurrenceEvidence: {
    label: 'Recurrence evidence',
    contribution: 'recurrence_evidence',
    description: 'Verified recurrence evidence (after moderator review)',
    icon: 'refresh-cw',
  },
  duplicateReport: {
    label: 'Duplicate report',
    contribution: 'duplicate_report',
    description: 'Confirmed duplicate report — small credit, attribution preserved',
    icon: 'copy',
  },
};

export const CONTRIBUTION_LABELS: Record<ContributionType | ValidationType, string> = {
  issue_report: 'Issue report',
  evidence: 'Supporting evidence',
  resolution_confirmation: 'Resolution confirmation',
  review_request: 'Review request',
  recurrence_evidence: 'Recurrence evidence',
  duplicate_report: 'Duplicate report',
  manual_adjustment: 'Administrator adjustment',
  new_issue: 'New-issue validation',
  duplicate_review: 'Duplicate review',
  recurrence: 'Recurrence claim',
};

export const CONTRIBUTION_ICONS: Record<ContributionType, string> = {
  issue_report: 'flag',
  evidence: 'camera',
  resolution_confirmation: 'check-circle',
  review_request: 'search',
  recurrence_evidence: 'refresh-cw',
  duplicate_report: 'copy',
  manual_adjustment: 'settings',
};

export const LEVEL_ICONS: Record<string, string> = {
  observer: 'eye',
  contributor: 'award',
  guardian: 'shield',
  champion: 'star',
};

/**
 * Deterministic idempotency key for a scoring event.
 * Same rule + issue + citizen (+ optional qualifier) can never be awarded twice.
 */
export function buildEventId(
  rule: RuleKey,
  opts: { issueId?: string | null; citizenId: string; qualifier?: string },
): string {
  return [rule, opts.issueId ?? 'none', opts.citizenId, opts.qualifier ?? 'default'].join(':');
}

export const APP_EVENTS = {
  issueSubmitted: 'issue.submitted',
  issueDuplicateConfirmed: 'issue.duplicate.confirmed',
  evidenceSubmitted: 'evidence.submitted',
  resolutionConfirmed: 'resolution.confirmed',
  reviewRequested: 'review.requested',
  recurrenceClaimed: 'recurrence.claimed',
  recurrenceConfirmed: 'recurrence.confirmed',
  adminManualAdjustment: 'admin.manual_adjustment',
} as const;
