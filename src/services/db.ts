/**
 * Typed accessors over the prototype storage mechanism.
 * Every collection in CivicLens AI persists here, including the
 * civic-score contribution ledger.
 */
import type {
  AbuseFlag,
  AppNotification,
  ConfigAuditEntry,
  Evidence,
  Issue,
  RecognitionLevel,
  ScoreLedgerEntry,
  ScoreRulesConfig,
  User,
  ValidationRequest,
} from '../types';
import { DataStore, getDataStore, setDataStore } from '../lib/store';
import { MemoryStorageAdapter } from '../lib/store';
import { DEFAULT_LEVELS, DEFAULT_RULES } from '../data/defaults';

export const KEYS = {
  users: 'users',
  issues: 'issues',
  evidence: 'evidence',
  notifications: 'notifications',
  ledger: 'scoreLedger',
  validations: 'validations',
  flags: 'abuseFlags',
  rules: 'scoreRules',
  levels: 'recognitionLevels',
  configAudit: 'configAudit',
  session: 'session',
} as const;

/* ---------------------------------- users ---------------------------------- */

export function listUsers(): User[] {
  return getDataStore().read<User[]>(KEYS.users, []);
}

export function getUser(id: string): User | undefined {
  return listUsers().find((u) => u.id === id);
}

export function saveUsers(users: User[]): void {
  getDataStore().write(KEYS.users, users);
}

/* ---------------------------------- issues --------------------------------- */

export function getIssues(): Issue[] {
  return getDataStore().read<Issue[]>(KEYS.issues, []);
}

export function saveIssues(issues: Issue[]): void {
  getDataStore().write(KEYS.issues, issues);
}

export function getIssue(id: string): Issue | undefined {
  return getIssues().find((i) => i.id === id);
}

export function insertIssue(issue: Issue): void {
  saveIssues([issue, ...getIssues()]);
}

export function mutateIssue(id: string, fn: (issue: Issue) => Issue): Issue | undefined {
  const issues = getIssues();
  const idx = issues.findIndex((i) => i.id === id);
  if (idx < 0) return undefined;
  const next = fn(issues[idx]);
  issues[idx] = next;
  saveIssues(issues);
  return next;
}

/* --------------------------------- evidence -------------------------------- */

export function getEvidence(): Evidence[] {
  return getDataStore().read<Evidence[]>(KEYS.evidence, []);
}

export function getEvidenceForIssue(issueId: string): Evidence[] {
  return getEvidence()
    .filter((e) => e.issueId === issueId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function insertEvidence(evidence: Evidence): void {
  getDataStore().write(KEYS.evidence, [evidence, ...getEvidence()]);
}

/* ------------------------------- notifications ------------------------------ */

export function getNotifications(): AppNotification[] {
  return getDataStore().read<AppNotification[]>(KEYS.notifications, []);
}

export function getNotificationsFor(userId: string): AppNotification[] {
  return getNotifications()
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveNotifications(list: AppNotification[]): void {
  getDataStore().write(KEYS.notifications, list.slice(0, 200));
}

/* ---------------------------- score ledger (audit) -------------------------- */

export function getLedgerRaw(): ScoreLedgerEntry[] {
  return getDataStore().read<ScoreLedgerEntry[]>(KEYS.ledger, []);
}

export function saveLedgerRaw(entries: ScoreLedgerEntry[]): void {
  getDataStore().write(KEYS.ledger, entries);
}

/* ------------------------------- validations -------------------------------- */

export function getValidationsRaw(): ValidationRequest[] {
  return getDataStore().read<ValidationRequest[]>(KEYS.validations, []);
}

export function saveValidations(list: ValidationRequest[]): void {
  getDataStore().write(KEYS.validations, list);
}

/* -------------------------------- abuse flags ------------------------------- */

export function getFlagsRaw(): AbuseFlag[] {
  return getDataStore().read<AbuseFlag[]>(KEYS.flags, []);
}

export function saveFlagsRaw(list: AbuseFlag[]): void {
  getDataStore().write(KEYS.flags, list);
}

/* --------------------------- scoring configuration -------------------------- */

type DeepPartialRules = {
  points?: Partial<ScoreRulesConfig['points']>;
  limits?: Partial<ScoreRulesConfig['limits']>;
  policies?: Partial<ScoreRulesConfig['policies']>;
};

export function getRules(): ScoreRulesConfig {
  const stored = getDataStore().read<DeepPartialRules>(KEYS.rules, {});
  return {
    points: { ...DEFAULT_RULES.points, ...stored.points },
    limits: { ...DEFAULT_RULES.limits, ...stored.limits },
    policies: { ...DEFAULT_RULES.policies, ...stored.policies },
  };
}

export function saveRules(rules: ScoreRulesConfig): void {
  getDataStore().write(KEYS.rules, rules);
}

export function getLevelsRaw(): Omit<RecognitionLevel, 'max'>[] {
  return getDataStore().read<Omit<RecognitionLevel, 'max'>[]>(KEYS.levels, DEFAULT_LEVELS);
}

export function saveLevelsRaw(levels: Omit<RecognitionLevel, 'max'>[]): void {
  getDataStore().write(KEYS.levels, levels);
}

export function getConfigAudit(): ConfigAuditEntry[] {
  return getDataStore()
    .read<ConfigAuditEntry[]>(KEYS.configAudit, [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendConfigAudit(entry: ConfigAuditEntry): void {
  getDataStore().write(KEYS.configAudit, [entry, ...getConfigAudit()]);
}

/* ---------------------------------- session --------------------------------- */

export function getSessionUserId(): string | null {
  return getDataStore().read<string | null>(KEYS.session, null);
}

export function setSessionUserId(userId: string | null): void {
  getDataStore().write(KEYS.session, userId);
}

/* --------------------------------- test utils ------------------------------- */

/** Install a fresh in-memory store (used by the test-suite). */
export function installTestStore(): DataStore {
  const store = new DataStore(
    new MemoryStorageAdapter(),
    `civiclens.test.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
  );
  setDataStore(store);
  return store;
}
