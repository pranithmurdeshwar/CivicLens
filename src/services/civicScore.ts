/**
 * CivicScore service — the typed scoring engine for Civic Score & Citizen
 * Recognition.
 *
 * Design guarantees:
 *  - Every score adjustment references a real application event (`appEvent`,
 *    `appEventId`) and an issue ID where applicable.
 *  - Duplicate awards are prevented with deterministic idempotency keys
 *    (`eventId`, see buildEventId) checked against the contribution ledger.
 *  - The ledger is append-only and immutable: it is the audit trail.
 *  - Points are awarded only after the underlying action has succeeded;
 *    domain services call `award` *after* mutating application state.
 *  - Anti-farming limits (per-issue cap, daily cap, weekly duplicate credits,
 *    recurrence cap) plus abuse flags for the admin audit view.
 *  - No automated deductions — citizens are never punished for reporting
 *    genuine issues that remain unresolved. Rejections award 0 points.
 *  - Residents can never edit their own points: rule changes, manual
 *    adjustments and validation decisions all require an admin actor.
 */
import type {
  AbuseFlag,
  Actor,
  AwardOutcome,
  AwardResult,
  BadgeView,
  ContributionType,
  RecognitionLevel,
  ScoreLedgerEntry,
  ScoreRulesConfig,
  ScoreSummary,
} from '../types';
import type { RuleKey } from '../types';
import { AuthorizationError, NotFoundError, ValidationError } from '../lib/errors';
import { nowIso, uid } from '../lib/ids';
import {
  BADGE_DEFS,
  DEFAULT_RULES,
  RULE_META,
  SCORING_DISCLAIMER,
  buildEventId,
} from '../data/defaults';
import {
  appendConfigAudit,
  getFlagsRaw,
  getLedgerRaw,
  getLevelsRaw,
  getRules,
  saveFlagsRaw,
  saveLedgerRaw,
  saveLevelsRaw,
  saveRules,
} from './db';

// Re-exports used by the admin UI (single scoring surface for pages).
export { getRules, getFlagsRaw, saveFlagsRaw };
export { getConfigAudit } from './db';

/** Deeply-partial patch accepted by updateRules. */
export interface ScoreRulesPatch {
  points?: Partial<ScoreRulesConfig['points']>;
  limits?: Partial<ScoreRulesConfig['limits']>;
  policies?: Partial<ScoreRulesConfig['policies']>;
}
import { notify } from './notifications';

export { SCORING_DISCLAIMER };

/* ------------------------------- authorization ------------------------------ */

/** Authorization assumption: only admins (or the system) may touch scoring config. */
export function requireAdmin(actor: Actor, action = 'perform this action'): void {
  if (!actor || actor.role !== 'admin') {
    throw new AuthorizationError(
      `Only authorised administrators can ${action}. Residents can never edit score rules, thresholds or point balances.`,
    );
  }
}

/* ------------------------------- configuration ------------------------------ */

function sanitizeRules(rules: ScoreRulesConfig): ScoreRulesConfig {
  const num = (n: unknown, fallback: number): number => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const pol = (p: unknown, fallback: 'auto' | 'manual'): 'auto' | 'manual' =>
    p === 'auto' || p === 'manual' ? p : fallback;
  const d = getRules();
  return {
    points: {
      issueReport: num(rules.points.issueReport, d.points.issueReport),
      evidence: num(rules.points.evidence, d.points.evidence),
      resolutionConfirmation: num(rules.points.resolutionConfirmation, d.points.resolutionConfirmation),
      reviewRequest: num(rules.points.reviewRequest, d.points.reviewRequest),
      recurrenceEvidence: num(rules.points.recurrenceEvidence, d.points.recurrenceEvidence),
      duplicateReport: num(rules.points.duplicateReport, d.points.duplicateReport),
    },
    limits: {
      maxPointsPerIssuePerCitizen: num(rules.limits.maxPointsPerIssuePerCitizen, d.limits.maxPointsPerIssuePerCitizen),
      dailyPointCap: num(rules.limits.dailyPointCap, d.limits.dailyPointCap),
      maxDuplicateCreditsPerWeek: num(rules.limits.maxDuplicateCreditsPerWeek, d.limits.maxDuplicateCreditsPerWeek),
      maxRecurrenceCreditsPerIssue: num(rules.limits.maxRecurrenceCreditsPerIssue, d.limits.maxRecurrenceCreditsPerIssue),
      minEvidenceNoteLength: num(rules.limits.minEvidenceNoteLength, d.limits.minEvidenceNoteLength),
      reviewRequestMinDaysUnresolved: num(rules.limits.reviewRequestMinDaysUnresolved, d.limits.reviewRequestMinDaysUnresolved),
    },
    policies: {
      newIssueValidation: pol(rules.policies.newIssueValidation, d.policies.newIssueValidation),
      evidenceValidation: pol(rules.policies.evidenceValidation, d.policies.evidenceValidation),
      reviewRequestValidation: pol(rules.policies.reviewRequestValidation, d.policies.reviewRequestValidation),
    },
  };
}

function diffSummary(before: ScoreRulesConfig, after: ScoreRulesConfig): string {
  const changes: string[] = [];
  const sections: [string, Record<string, string | number | boolean>][] = [
    ['points', after.points],
    ['limits', after.limits],
    ['policies', after.policies],
  ];
  const beforeAny = before as unknown as Record<string, Record<string, unknown>>;
  for (const [section, obj] of sections) {
    for (const key of Object.keys(obj)) {
      const b = beforeAny[section][key];
      const a = obj[key];
      if (b !== a) changes.push(`${section}.${key}: ${String(b)} → ${String(a)}`);
    }
  }
  return changes.join('; ');
}

export function updateRules(patch: ScoreRulesPatch, actor: Actor): ScoreRulesConfig {
  requireAdmin(actor, 'change scoring rules');
  const before = getRules();
  const merged: ScoreRulesConfig = {
    points: { ...before.points, ...patch.points },
    limits: { ...before.limits, ...patch.limits },
    policies: { ...before.policies, ...patch.policies },
  };
  const next = sanitizeRules(merged);
  const summary = diffSummary(before, next);
  saveRules(next);
  appendConfigAudit({
    id: uid('cfg'),
    actorId: actor.id,
    summary: summary ? `Updated scoring configuration — ${summary}` : 'Saved scoring configuration (no changes)',
    createdAt: nowIso(),
  });
  return next;
}

export function resetRulesToDefaults(actor: Actor): ScoreRulesConfig {
  requireAdmin(actor, 'reset scoring rules');
  const restored: ScoreRulesConfig = JSON.parse(JSON.stringify(DEFAULT_RULES)) as ScoreRulesConfig;
  saveRules(restored);
  appendConfigAudit({
    id: uid('cfg'),
    actorId: actor.id,
    summary: 'Reset scoring configuration to provisional demo defaults',
    createdAt: nowIso(),
  });
  return restored;
}

/** Levels are stored with `min` only; `max` is derived from the next level. */
export function getLevels(): RecognitionLevel[] {
  const raw = [...getLevelsRaw()].sort((a, b) => a.min - b.min);
  return raw.map((lvl, i) => ({
    ...lvl,
    max: i < raw.length - 1 ? raw[i + 1].min - 1 : null,
  }));
}

export function updateLevels(
  levels: { key: string; name: string; min: number; description: string }[],
  actor: Actor,
): RecognitionLevel[] {
  requireAdmin(actor, 'change recognition levels and thresholds');
  if (levels.length < 1) throw new ValidationError('At least one recognition level is required.');
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  if (sorted[0].min < 0) throw new ValidationError('Level thresholds cannot be negative.');
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min <= sorted[i - 1].min) {
      throw new ValidationError('Level thresholds must be strictly increasing.');
    }
  }
  if (new Set(sorted.map((l) => l.name.trim().toLowerCase())).size !== sorted.length) {
    throw new ValidationError('Level names must be unique.');
  }
  const clean = sorted.map((l) => ({
    key: l.key,
    name: l.name.trim(),
    min: Math.round(l.min),
    description: l.description.trim(),
  }));
  saveLevelsRaw(clean);
  appendConfigAudit({
    id: uid('cfg'),
    actorId: actor.id,
    summary: `Updated recognition level thresholds — ${clean.map((l) => `${l.name} @ ${l.min}`).join(', ')}`,
    createdAt: nowIso(),
  });
  return getLevels();
}

/* --------------------------------- levels ---------------------------------- */

export function getLevelForPoints(points: number): {
  level: RecognitionLevel;
  nextLevel: RecognitionLevel | null;
} {
  const levels = getLevels();
  let idx = 0;
  for (let i = 0; i < levels.length; i++) {
    if (points >= levels[i].min) idx = i;
  }
  return { level: levels[idx], nextLevel: levels[idx + 1] ?? null };
}

export function getLevelProgress(points: number): {
  level: RecognitionLevel;
  nextLevel: RecognitionLevel | null;
  pointsToNext: number | null;
  progressPct: number | null;
} {
  const { level, nextLevel } = getLevelForPoints(points);
  if (!nextLevel) return { level, nextLevel: null, pointsToNext: null, progressPct: 100 };
  const span = nextLevel.min - level.min;
  const pct = span > 0 ? Math.round(((points - level.min) / span) * 100) : 100;
  return {
    level,
    nextLevel,
    pointsToNext: Math.max(0, nextLevel.min - points),
    progressPct: Math.min(100, Math.max(0, pct)),
  };
}

/* ---------------------------------- ledger ---------------------------------- */

export function getLedger(citizenId?: string): ScoreLedgerEntry[] {
  const all = getLedgerRaw().sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  return citizenId ? all.filter((e) => e.citizenId === citizenId) : all;
}

export function getEntryByEventId(eventId: string): ScoreLedgerEntry | undefined {
  return getLedgerRaw().find((e) => e.eventId === eventId);
}

export function getTotalPoints(citizenId: string): number {
  const total = getLedger(citizenId)
    .filter((e) => e.status === 'awarded')
    .reduce((sum, e) => sum + e.points, 0);
  return Math.max(0, total);
}

export function getPointsForIssue(citizenId: string, issueId: string): number {
  return getLedger(citizenId)
    .filter((e) => e.status === 'awarded' && e.issueId === issueId)
    .reduce((sum, e) => sum + e.points, 0);
}

function defaultReason(rule: RuleKey): string {
  return RULE_META[rule].description;
}

function citizenName(citizenId: string): string {
  // Best-effort for notification copy; ledger stores IDs only.
  return citizenId;
}

/* ------------------------------ anti-abuse caps ------------------------------ */

interface CapRejection {
  reason: string;
  flag?: { type: AbuseFlag['type']; severity: AbuseFlag['severity']; detail: string };
}

function evaluateCaps(
  input: { rule: RuleKey; citizenId: string; issueId?: string | null },
  points: number,
  rules: ScoreRulesConfig,
): CapRejection | null {
  const awarded = getLedgerRaw().filter((e) => e.status === 'awarded' && e.citizenId === input.citizenId);

  if (input.issueId) {
    const onIssue = awarded
      .filter((e) => e.issueId === input.issueId)
      .reduce((s, e) => s + e.points, 0);
    if (onIssue + points > rules.limits.maxPointsPerIssuePerCitizen) {
      return {
        reason: `per-issue cap reached (${onIssue}/${rules.limits.maxPointsPerIssuePerCitizen} pts already recorded on ${input.issueId})`,
      };
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = awarded
    .filter((e) => new Date(e.createdAt).getTime() >= startOfDay.getTime())
    .reduce((s, e) => s + e.points, 0);
  if (today + points > rules.limits.dailyPointCap) {
    return {
      reason: `daily cap reached (${today}/${rules.limits.dailyPointCap} pts today)`,
      flag: {
        type: 'daily_cap_reached',
        severity: 'low',
        detail: `Daily cap of ${rules.limits.dailyPointCap} points reached — further awards today are recorded as rejected in the audit trail (no penalty, no deductions).`,
      },
    };
  }

  if (input.rule === 'duplicateReport') {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const weekCount = awarded.filter(
      (e) => e.type === 'duplicate_report' && new Date(e.createdAt).getTime() >= weekAgo,
    ).length;
    if (weekCount >= rules.limits.maxDuplicateCreditsPerWeek) {
      return {
        reason: `weekly duplicate-credit cap reached (${weekCount}/${rules.limits.maxDuplicateCreditsPerWeek})`,
        flag: {
          type: 'duplicate_credit_cap',
          severity: 'medium',
          detail: `More than ${rules.limits.maxDuplicateCreditsPerWeek} duplicate-report credits attempted within 7 days — flagged for review.`,
        },
      };
    }
  }

  if (input.rule === 'recurrenceEvidence' && input.issueId) {
    const count = awarded.filter(
      (e) => e.type === 'recurrence_evidence' && e.issueId === input.issueId,
    ).length;
    if (count >= rules.limits.maxRecurrenceCreditsPerIssue) {
      return {
        reason: `recurrence credit cap reached for ${input.issueId} (${count}/${rules.limits.maxRecurrenceCreditsPerIssue})`,
      };
    }
  }

  return null;
}

export function raiseAbuseFlag(input: {
  citizenId: string;
  type: AbuseFlag['type'];
  severity: AbuseFlag['severity'];
  detail: string;
}): AbuseFlag {
  const existing = getFlagsRaw().find(
    (f) => f.citizenId === input.citizenId && f.type === input.type && f.status === 'open',
  );
  if (existing) return existing;
  const flag: AbuseFlag = {
    id: uid('flag'),
    citizenId: input.citizenId,
    type: input.type,
    severity: input.severity,
    detail: input.detail,
    status: 'open',
    createdAt: nowIso(),
  };
  saveFlagsRaw([flag, ...getFlagsRaw()]);
  return flag;
}

/* ------------------------------ core: awarding ------------------------------ */

export interface AwardInput {
  rule: RuleKey;
  citizenId: string;
  issueId?: string | null;
  appEvent: string;
  appEventId: string;
  /** Explicit idempotency key; defaults to the deterministic buildEventId. */
  eventId?: string;
  validatedBy?: string;
  reason?: string;
  meta?: Record<string, string>;
}

export function award(input: AwardInput): AwardResult {
  const rules = getRules();
  const points = rules.points[input.rule];
  const eventId =
    input.eventId ?? buildEventId(input.rule, { issueId: input.issueId, citizenId: input.citizenId });

  // Idempotency: an event can only ever produce one ledger entry.
  const existing = getEntryByEventId(eventId);
  if (existing) {
    const outcome: AwardOutcome =
      existing.status === 'awarded'
        ? 'already_awarded'
        : existing.status === 'rejected'
          ? 'already_rejected'
          : 'pending_decision';
    return { outcome, entry: existing, pointsAdded: 0 };
  }

  const base: ScoreLedgerEntry = {
    id: uid('led'),
    eventId,
    citizenId: input.citizenId,
    issueId: input.issueId ?? null,
    type: RULE_META[input.rule].contribution,
    points: 0,
    status: 'awarded',
    appEvent: input.appEvent,
    appEventId: input.appEventId,
    validatedBy: input.validatedBy ?? 'system',
    reason: input.reason ?? defaultReason(input.rule),
    createdAt: nowIso(),
    meta: input.meta,
  };

  const cap = evaluateCaps(input, points, rules);
  let entry: ScoreLedgerEntry;
  if (cap) {
    entry = { ...base, status: 'rejected', points: 0, reason: `Not awarded — ${cap.reason}` };
    if (cap.flag) {
      raiseAbuseFlag({ citizenId: input.citizenId, ...cap.flag });
    }
  } else {
    entry = { ...base, points };
    notify({
      userId: input.citizenId,
      type: 'score',
      title: `+${points} points — ${RULE_META[input.rule].label}`,
      body: `${entry.reason}.${input.issueId ? ` Issue ${input.issueId}.` : ''} ${SCORING_DISCLAIMER}`,
      link: input.issueId ? `/resident/issues/${input.issueId}` : '/resident/civic-score',
    });
  }

  saveLedgerRaw([entry, ...getLedgerRaw()]);
  return { outcome: cap ? 'rejected' : 'awarded', entry, pointsAdded: entry.points };
}

/** Records an audited rejection (0 points). Rejections also consume the
 *  eventId so the same event cannot be re-decided into points later. */
export function recordRejection(input: {
  rule: RuleKey;
  citizenId: string;
  issueId?: string | null;
  appEvent: string;
  appEventId: string;
  eventId?: string;
  reason: string;
  validatedBy?: string;
}): AwardResult {
  const eventId =
    input.eventId ?? buildEventId(input.rule, { issueId: input.issueId, citizenId: input.citizenId });
  const existing = getEntryByEventId(eventId);
  if (existing) {
    return {
      outcome: existing.status === 'awarded' ? 'already_awarded' : 'already_rejected',
      entry: existing,
      pointsAdded: 0,
    };
  }
  const entry: ScoreLedgerEntry = {
    id: uid('led'),
    eventId,
    citizenId: input.citizenId,
    issueId: input.issueId ?? null,
    type: RULE_META[input.rule].contribution,
    points: 0,
    status: 'rejected',
    appEvent: input.appEvent,
    appEventId: input.appEventId,
    validatedBy: input.validatedBy ?? 'system',
    reason: input.reason,
    createdAt: nowIso(),
    decidedAt: nowIso(),
  };
  saveLedgerRaw([entry, ...getLedgerRaw()]);
  return { outcome: 'rejected', entry, pointsAdded: 0 };
}

/** Creates a pending ledger entry while a validation request is under review. */
export function createPendingEntry(input: {
  rule: RuleKey;
  citizenId: string;
  issueId?: string | null;
  appEvent: string;
  appEventId: string;
  eventId?: string;
  reason?: string;
}): ScoreLedgerEntry {
  const eventId =
    input.eventId ?? buildEventId(input.rule, { issueId: input.issueId, citizenId: input.citizenId });
  const existing = getEntryByEventId(eventId);
  if (existing) return existing;
  const rules = getRules();
  const entry: ScoreLedgerEntry = {
    id: uid('led'),
    eventId,
    citizenId: input.citizenId,
    issueId: input.issueId ?? null,
    type: RULE_META[input.rule].contribution,
    points: 0,
    status: 'pending',
    prospectivePoints: rules.points[input.rule],
    appEvent: input.appEvent,
    appEventId: input.appEventId,
    validatedBy: 'pending-review',
    reason: input.reason ?? `${RULE_META[input.rule].description} — awaiting validation`,
    createdAt: nowIso(),
  };
  saveLedgerRaw([entry, ...getLedgerRaw()]);
  return entry;
}

export interface SettleOptions {
  actor: Actor;
  note?: string;
  pointsOverride?: number;
  typeOverride?: ContributionType;
  appEventOverride?: string;
}

/** Decides a pending entry. Admin actor required unless invoked by the system. */
export function settlePending(
  eventId: string,
  decision: 'approve' | 'reject',
  opts: SettleOptions,
): AwardResult {
  if (opts.actor.kind !== 'system') {
    requireAdmin(opts.actor, 'decide score validations');
  }
  const ledger = getLedgerRaw();
  const entry = ledger.find((e) => e.eventId === eventId);
  if (!entry) throw new NotFoundError(`No pending score entry for event ${eventId}.`);
  if (entry.status !== 'pending') {
    return {
      outcome: entry.status === 'awarded' ? 'already_awarded' : 'already_rejected',
      entry,
      pointsAdded: 0,
    };
  }

  const rules = getRules();
  if (decision === 'approve') {
    const points = opts.pointsOverride ?? entry.prospectivePoints ?? 0;
    // Caps are re-checked at settlement time (they may have filled meanwhile).
    const cap = evaluateCaps(
      { rule: ruleKeyForType(opts.typeOverride ?? (entry.type as ContributionType)), citizenId: entry.citizenId, issueId: entry.issueId },
      points,
      rules,
    );
    entry.status = cap ? 'rejected' : 'awarded';
    entry.points = cap ? 0 : points;
    entry.type = opts.typeOverride ?? (entry.type as ContributionType);
    entry.appEvent = opts.appEventOverride ?? entry.appEvent;
    entry.validatedBy = opts.actor.id;
    entry.reason = cap ? `Not awarded — ${cap.reason}` : opts.note ?? entry.reason;
    entry.decidedAt = nowIso();
    if (entry.status === 'awarded') {
      notify({
        userId: entry.citizenId,
        type: 'score',
        title: `+${entry.points} points — ${contributionLabel(entry.type)}`,
        body: `${entry.reason}.${entry.issueId ? ` Issue ${entry.issueId}.` : ''} ${SCORING_DISCLAIMER}`,
        link: entry.issueId ? `/resident/issues/${entry.issueId}` : '/resident/civic-score',
      });
    } else {
      notify({
        userId: entry.citizenId,
        type: 'review',
        title: 'Contribution reviewed — no points this time',
        body: `${entry.reason}. Reporting genuine issues is never penalised.`,
        link: entry.issueId ? `/resident/issues/${entry.issueId}` : '/resident/civic-score',
      });
    }
  } else {
    entry.status = 'rejected';
    entry.points = 0;
    entry.validatedBy = opts.actor.id;
    entry.reason = opts.note ?? 'Rejected during validation review';
    entry.decidedAt = nowIso();
    notify({
      userId: entry.citizenId,
      type: 'review',
      title: 'Contribution reviewed — no points this time',
      body: `${entry.reason}. Reporting genuine issues is never penalised — no points were deducted.`,
      link: entry.issueId ? `/resident/issues/${entry.issueId}` : '/resident/civic-score',
    });
  }

  saveLedgerRaw(ledger.map((e) => (e.id === entry.id ? entry : e)));
  return { outcome: entry.status === 'awarded' ? 'awarded' : 'rejected', entry, pointsAdded: entry.points };
}

function ruleKeyForType(type: ContributionType): RuleKey {
  const found = (Object.keys(RULE_META) as RuleKey[]).find((k) => RULE_META[k].contribution === type);
  return found ?? 'evidence';
}

export function contributionLabel(type: ContributionType): string {
  return RULE_LABELS[type] ?? type;
}

const RULE_LABELS: Record<string, string> = {
  issue_report: 'Issue report',
  evidence: 'Supporting evidence',
  resolution_confirmation: 'Resolution confirmation',
  review_request: 'Review request',
  recurrence_evidence: 'Recurrence evidence',
  duplicate_report: 'Duplicate report',
  manual_adjustment: 'Administrator adjustment',
};

/* ---------------------------- admin manual adjust ---------------------------- */

export function adjustPoints(
  input: { citizenId: string; delta: number; reason: string },
  actor: Actor,
): ScoreLedgerEntry {
  requireAdmin(actor, 'adjust citizen points');
  const reason = input.reason.trim();
  if (!reason) throw new ValidationError('A documented reason is required for manual point adjustments.');
  const delta = Math.round(Number(input.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    throw new ValidationError('Adjustment must be a non-zero number of points.');
  }
  const currentTotal = getTotalPoints(input.citizenId);
  if (currentTotal + delta < 0) {
    throw new ValidationError(
      'Adjustment would reduce the balance below zero — citizens are never given a negative score. Use a smaller adjustment.',
    );
  }
  const entry: ScoreLedgerEntry = {
    id: uid('led'),
    eventId: `manual_adjustment:${uid('adj')}`,
    citizenId: input.citizenId,
    issueId: null,
    type: 'manual_adjustment',
    points: delta,
    status: 'awarded',
    appEvent: 'admin.manual_adjustment',
    appEventId: 'manual',
    validatedBy: actor.id,
    reason,
    createdAt: nowIso(),
  };
  saveLedgerRaw([entry, ...getLedgerRaw()]);
  notify({
    userId: input.citizenId,
    type: 'score',
    title: `${delta > 0 ? '+' : ''}${delta} points — administrator adjustment`,
    body: `${reason}. Reviewed and recorded by the moderation team.`,
    link: '/resident/civic-score',
  });
  return entry;
}

/* ---------------------------------- badges ---------------------------------- */

export function computeBadges(citizenId: string): BadgeView[] {
  const awarded = getLedger(citizenId)
    .filter((e) => e.status === 'awarded')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const total = Math.max(0, awarded.reduce((s, e) => s + e.points, 0));

  const earliestOfType = (type: ContributionType): string | undefined =>
    awarded.find((e) => e.type === type)?.createdAt;
  const earliestCrossing = (threshold: number): string | undefined => {
    let acc = 0;
    for (const e of awarded) {
      acc += e.points;
      if (acc >= threshold) return e.createdAt;
    }
    return undefined;
  };

  const levels = getLevels();
  const minOf = (key: string): number => levels.find((l) => l.key === key)?.min ?? Infinity;

  const checks: Record<string, string | undefined> = {
    first_report: earliestOfType('issue_report'),
    reports_5: awarded.filter((e) => e.type === 'issue_report').length >= 5
      ? earliestOfType('issue_report')
      : undefined,
    first_evidence: earliestOfType('evidence'),
    resolution_verifier: earliestOfType('resolution_confirmation'),
    review_advocate: earliestOfType('review_request'),
    watchdog: earliestOfType('recurrence_evidence'),
    level_contributor: total >= minOf('contributor') ? earliestCrossing(minOf('contributor')) : undefined,
    level_guardian: total >= minOf('guardian') ? earliestCrossing(minOf('guardian')) : undefined,
    level_champion: total >= minOf('champion') ? earliestCrossing(minOf('champion')) : undefined,
  };

  return BADGE_DEFS.map((def) => ({
    ...def,
    earned: checks[def.key] != null,
    earnedAt: checks[def.key],
  }));
}

/* --------------------------------- summary ---------------------------------- */

export function getScoreSummary(citizenId: string): ScoreSummary {
  const totalPoints = getTotalPoints(citizenId);
  const { level, nextLevel, pointsToNext, progressPct } = getLevelProgress(totalPoints);
  const ledger = getLedger(citizenId);
  return {
    citizenId,
    totalPoints,
    level,
    nextLevel,
    pointsToNext,
    progressPct,
    verifiedContributions: ledger.filter((e) => e.status === 'awarded').length,
    pendingCount: ledger.filter((e) => e.status === 'pending').length,
    rejectedCount: ledger.filter((e) => e.status === 'rejected').length,
    badges: computeBadges(citizenId),
  };
}

void citizenName;
