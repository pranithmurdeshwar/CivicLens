/**
 * CivicLens AI — domain types.
 * All data is fictional demo data. Nothing here represents real citizens or issues.
 */

/* ----------------------------- Identity / auth ---------------------------- */

export type Role = 'resident' | 'admin';
export type ActorKind = 'user' | 'system';

/** An actor performs service calls. UI users have kind 'user'; internal
 *  post-action scoring uses kind 'system'. Scoring itself is never exposed to
 *  residents as a free-form action. */
export interface Actor {
  id: string;
  role: Role;
  kind: ActorKind;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  ward: string;
  area: string;
  city: string;
  /** Privacy: public recognition is strictly opt-in. */
  publicRecognitionOptIn: boolean;
  avatarInitials: string;
  joinedAt: string;
  bio?: string;
}

/* --------------------------------- Issues --------------------------------- */

export type IssueCategory =
  | 'roads'
  | 'water'
  | 'electricity'
  | 'sanitation'
  | 'streetlight'
  | 'drainage'
  | 'parks'
  | 'other';

export type IssueStatus =
  | 'submitted'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed_duplicate'
  | 'closed';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface IssueResolution {
  id: string;
  description: string;
  submittedAt: string;
  submittedBy: string;
  /** True only after the reporter has checked on site and confirmed. */
  confirmedByReporter: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface IssueMedia {
  id: string;
  name: string;
  type: 'photo' | 'video';
  url: string;
  size?: number;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  reporterId: string;
  ward: string;
  /** Area-level location only. Exact residential coordinates are never stored. */
  area: string;
  landmark?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: IssueResolution;
  duplicateOfIssueId?: string;
  duplicateReviewStatus?: 'flagged' | 'confirmed_independent' | 'confirmed_duplicate';
  recurrenceCount: number;
  adminNote?: string;
  media?: IssueMedia[];
}

export type EvidenceType = 'photo' | 'video' | 'document' | 'description';

export interface Evidence {
  id: string;
  issueId: string;
  submittedById: string;
  type: EvidenceType;
  note: string;
  createdAt: string;
  mediaUrl?: string;
  mediaName?: string;
}

/* ------------------------------ Notifications ------------------------------ */

export type NotificationType = 'score' | 'issue' | 'review' | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

/* ------------------------------- Civic score ------------------------------- */

/** Configurable scoring rules (keys into ScoreRulesConfig.points). */
export type RuleKey =
  | 'issueReport'
  | 'evidence'
  | 'resolutionConfirmation'
  | 'reviewRequest'
  | 'recurrenceEvidence'
  | 'duplicateReport';

export type ContributionType =
  | 'issue_report'
  | 'evidence'
  | 'resolution_confirmation'
  | 'review_request'
  | 'recurrence_evidence'
  | 'duplicate_report'
  | 'manual_adjustment';

export type LedgerStatus = 'awarded' | 'pending' | 'rejected';

export interface ScoreRulesConfig {
  points: Record<RuleKey, number>;
  limits: {
    /** Anti-farming: a single citizen can earn at most this many points on one issue. */
    maxPointsPerIssuePerCitizen: number;
    /** Anti-farming: hard cap on points earned per citizen per day. */
    dailyPointCap: number;
    /** Duplicate-report credits per citizen per rolling week. */
    maxDuplicateCreditsPerWeek: number;
    /** Recurrence credits per citizen per issue. */
    maxRecurrenceCreditsPerIssue: number;
    /** Demo heuristic: minimum note length for evidence to auto-validate as useful. */
    minEvidenceNoteLength: number;
    /** Minimum days unresolved before a review request can be submitted. */
    reviewRequestMinDaysUnresolved: number;
  };
  policies: {
    newIssueValidation: 'auto' | 'manual';
    evidenceValidation: 'auto' | 'manual';
    reviewRequestValidation: 'auto' | 'manual';
  };
}

export interface RecognitionLevel {
  key: string;
  name: string;
  /** Inclusive minimum. Upper bound is derived from the next level's minimum. */
  min: number;
  /** Derived on read; null for the top level. */
  max: number | null;
  description: string;
}

/**
 * Immutable contribution-ledger entry — the audit trail. Every adjustment
 * references the real application event (`appEvent` + `appEventId`) and the
 * related issue where applicable. `eventId` is the idempotency key.
 */
export interface ScoreLedgerEntry {
  id: string;
  /** Unique event identifier — prevents duplicate point awards. */
  eventId: string;
  citizenId: string;
  issueId: string | null;
  type: ContributionType;
  /** 0 unless status === 'awarded'. */
  points: number;
  status: LedgerStatus;
  /** For pending entries: points awarded if the validation passes. */
  prospectivePoints?: number;
  appEvent: string;
  appEventId: string;
  /** 'system', 'system:auto-policy', or the admin user id. */
  validatedBy: string;
  reason: string;
  createdAt: string;
  decidedAt?: string;
  meta?: Record<string, string>;
}

export type ValidationType =
  | 'new_issue'
  | 'duplicate_review'
  | 'evidence'
  | 'review_request'
  | 'recurrence';

export interface ValidationRequest {
  id: string;
  type: ValidationType;
  issueId: string;
  citizenId: string;
  rule: RuleKey;
  pointsIfApproved: number;
  /** The ledger eventId that will be settled when this request is decided. */
  dedupeEventId: string;
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, string>;
  note?: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export type AbuseFlagType =
  | 'daily_cap_reached'
  | 'duplicate_credit_cap'
  | 'rapid_submissions'
  | 'repeated_rejections';

export interface AbuseFlag {
  id: string;
  citizenId: string;
  type: AbuseFlagType;
  detail: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'dismissed' | 'actioned';
  actionNote?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ConfigAuditEntry {
  id: string;
  actorId: string;
  summary: string;
  createdAt: string;
}

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: string;
}

export interface BadgeView extends BadgeDef {
  earned: boolean;
  earnedAt?: string;
}

export interface ScoreSummary {
  citizenId: string;
  totalPoints: number;
  level: RecognitionLevel;
  nextLevel: RecognitionLevel | null;
  pointsToNext: number | null;
  progressPct: number | null;
  verifiedContributions: number;
  pendingCount: number;
  rejectedCount: number;
  badges: BadgeView[];
}

export type AwardOutcome =
  | 'awarded'
  | 'already_awarded'
  | 'already_rejected'
  | 'pending_decision'
  | 'rejected';

export interface AwardResult {
  outcome: AwardOutcome;
  entry: ScoreLedgerEntry;
  pointsAdded: number;
}
