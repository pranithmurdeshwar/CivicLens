import { describe, it, expect, beforeEach } from 'vitest';
import { resetTestState } from './helpers';
import {
  adjustPoints,
  award,
  requireAdmin,
  resetRulesToDefaults,
  settlePending,
  updateLevels,
  updateRules,
  createPendingEntry,
} from '../civicScore';
import { acknowledgeIssue, closeIssue, startProgress, submitResolution } from '../admin';
import { decideDuplicateReview, decideValidation } from '../validations';
import { confirmResolution, reportIssue } from '../issues';
import { getLedgerRaw, getValidationsRaw, listUsers } from '../db';
import { AuthorizationError } from '../../lib/errors';
import { getDataStore, MemoryStorageAdapter, DataStore } from '../../lib/store';

const RESIDENT = { id: 'u-aarav', role: 'resident' as const, kind: 'user' as const };
const OTHER = { id: 'u-priya', role: 'resident' as const, kind: 'user' as const };
const ADMIN = { id: 'u-meera', role: 'admin' as const, kind: 'user' as const };
const SYSTEM = { id: 'system', role: 'admin' as const, kind: 'system' as const };

const REPORT = {
  title: 'Fallen tree blocking the footpath',
  description: 'A large branch has fallen across the footpath near the school and pedestrians are walking on the road.',
  category: 'parks' as const,
  severity: 'high' as const,
  area: 'Test Area',
};

beforeEach(() => resetTestState());

describe('authorization assumptions', () => {
  it('residents can never change scoring rules, levels or reset configuration', () => {
    expect(() => updateRules({ points: { issueReport: 999 } }, RESIDENT)).toThrow(AuthorizationError);
    expect(() => updateLevels([{ key: 'x', name: 'Hacked', min: 0, description: '' }], RESIDENT)).toThrow(AuthorizationError);
    expect(() => resetRulesToDefaults(RESIDENT)).toThrow(AuthorizationError);
  });

  it('residents can never adjust points — theirs or anyone else’s', () => {
    expect(() => adjustPoints({ citizenId: RESIDENT.id, delta: 100, reason: 'self award' }, RESIDENT)).toThrow(AuthorizationError);
    expect(getLedgerRaw()).toHaveLength(0); // nothing was written
  });

  it('residents can never settle validations, decide duplicates or reviews', () => {
    createPendingEntry({ rule: 'reviewRequest', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'review.requested', appEventId: 'rr-1' });
    expect(() => settlePending('reviewRequest:ISS-1:u-aarav:default', 'approve', { actor: RESIDENT })).toThrow(AuthorizationError);
    expect(() => decideValidation('val-x', 'approve', RESIDENT)).toThrow(AuthorizationError);
    expect(() => decideDuplicateReview('val-x', 'independent', RESIDENT)).toThrow(AuthorizationError);
  });

  it('residents can never perform moderation lifecycle actions', () => {
    const { issue } = reportIssue(RESIDENT, REPORT);
    expect(() => acknowledgeIssue(OTHER, issue.id)).toThrow(AuthorizationError);
    expect(() => startProgress(OTHER, issue.id)).toThrow(AuthorizationError);
    expect(() => submitResolution(OTHER, issue.id, { description: 'fake resolution by resident' })).toThrow(AuthorizationError);
    expect(() => closeIssue(OTHER, issue.id)).toThrow(AuthorizationError);
  });

  it('authorised administrators and the system actor can act', () => {
    updateRules({ points: { issueReport: 12 } }, ADMIN); // no throw
    createPendingEntry({ rule: 'reviewRequest', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'review.requested', appEventId: 'rr-1' });
    expect(settlePending('reviewRequest:ISS-1:u-aarav:default', 'approve', { actor: SYSTEM }).outcome).toBe('awarded'); // system settles post-action events
  });

  it('exposes the shared guard used across the scoring API', () => {
    expect(() => requireAdmin(RESIDENT, 'test')).toThrow(AuthorizationError);
    expect(() => requireAdmin(ADMIN, 'test')).not.toThrow();
    expect(() => requireAdmin(SYSTEM, 'test')).not.toThrow();
  });

  it('demo storage users separate the admin role from residents', () => {
    const users = listUsers();
    expect(users.find((u) => u.id === 'u-meera')?.role).toBe('admin');
    expect(users.filter((u) => u.role === 'resident').length).toBeGreaterThan(0);
  });
});

describe('audit trail integrity', () => {
  it('every ledger entry references an application event, event id and validator', () => {
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'issue.submitted', appEventId: 'ISS-1' });
    adjustPoints({ citizenId: RESIDENT.id, delta: 5, reason: 'Audit correction' }, ADMIN);
    for (const e of getLedgerRaw()) {
      expect(e.eventId).toBeTruthy();
      expect(e.appEvent).toBeTruthy();
      expect(e.appEventId).toBeTruthy();
      expect(e.validatedBy).toBeTruthy();
      expect(['awarded', 'pending', 'rejected']).toContain(e.status);
    }
  });

  it('records one entry per event — no silent edits after the fact', () => {
    award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'evidence.submitted', appEventId: 'ev-1' });
    award({ rule: 'evidence', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'evidence.submitted', appEventId: 'ev-2' });
    const entries = getLedgerRaw().filter((e) => e.type === 'evidence');
    expect(entries).toHaveLength(1);
    expect(entries[0].points).toBe(5);
  });

  it('keeps manual adjustments attributed to the acting administrator', () => {
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'issue.submitted', appEventId: 'ISS-1' });
    const entry = adjustPoints({ citizenId: RESIDENT.id, delta: -2, reason: 'Correction after review #A-21' }, ADMIN);
    expect(entry.type).toBe('manual_adjustment');
    expect(entry.validatedBy).toBe('u-meera');
    expect(entry.points).toBe(-2);
    expect(getLedgerRaw().find((e) => e.id === entry.id)?.reason).toContain('#A-21');
  });
});

describe('privacy & fairness guarantees', () => {
  it('stores area-level locations only — no coordinates or contact fields on issues', () => {
    const { issue } = reportIssue(RESIDENT, REPORT);
    const keys = Object.keys(issue);
    for (const forbidden of ['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'phone', 'email', 'address']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(issue.area).toBe('Test Area');
    expect(issue.landmark ?? '').not.toMatch(/\d{1,3}\.\d{4,}/); // no GPS-style numbers
  });

  it('public recognition is opt-in per user', () => {
    const users = listUsers();
    expect(users.find((u) => u.id === 'u-aarav')?.publicRecognitionOptIn).toBe(true);
    expect(users.find((u) => u.id === 'u-priya')?.publicRecognitionOptIn).toBe(false);
  });

  it('rejections never deduct points and balances never go negative', () => {
    award({ rule: 'issueReport', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'issue.submitted', appEventId: 'ISS-1' });
    createPendingEntry({ rule: 'reviewRequest', citizenId: RESIDENT.id, issueId: 'ISS-1', appEvent: 'review.requested', appEventId: 'rr-9' });
    settlePending('reviewRequest:ISS-1:u-aarav:default', 'reject', { actor: ADMIN, note: 'Did not pass validation' });
    expect(getLedgerRaw().find((e) => e.status === 'rejected')?.points).toBe(0);
  });

  it('duplicate handling preserves attribution for the original reporter', () => {
    const first = reportIssue(RESIDENT, { ...REPORT, title: 'Fallen tree near the school gate' });
    reportIssue(OTHER, { ...REPORT, title: 'Tree branch fallen across the path' });
    const pending = getLedgerRaw().find((e) => e.citizenId === OTHER.id && e.status === 'pending');
    expect(pending).toBeDefined();
    const req = getValidationsRaw().find((v) => v.dedupeEventId === pending!.eventId)!;
    decideDuplicateReview(req.id, 'duplicate', ADMIN, { parentIssueId: first.issue.id });
    expect(getLedgerRaw().find((e) => e.citizenId === RESIDENT.id)?.points).toBe(10); // original intact
  });
});

describe('prototype storage mechanism', () => {
  it('isolates stores by namespace and falls back to memory', () => {
    resetTestState();
    const a = new DataStore(new MemoryStorageAdapter(), 'ns-a');
    const b = new DataStore(new MemoryStorageAdapter(), 'ns-b');
    a.write('ledger', [{ id: 1 }]);
    expect(b.read<unknown[]>('ledger', [])).toHaveLength(0);
    expect(a.read<unknown[]>('ledger', [])).toHaveLength(1);
    expect(getDataStore().mode).toBe('memory');
  });
});
