import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Badge, Card, EmptyState, PageHeader, Stat } from '../components/ui';
import { currentUserActor, getCurrentUser, listAllUsers } from '../services/auth';
import { acknowledgeIssue, closeIssue, decideDuplicateReview, decideValidation, getValidations, startProgress, submitResolution } from '../services/admin';
import { adjustPoints, getFlagsRaw, getLedger, getRules, raiseAbuseFlag, saveFlagsRaw } from '../services/civicScore';
import { getIssue } from '../services/db';
import { CONTRIBUTION_LABELS } from '../data/defaults';
import { fmtPoints, formatDateTime, timeAgo } from '../lib/format';
import { pushToast } from '../lib/toast';
import { AppError } from '../lib/errors';
import type { AbuseFlag } from '../types';

function msg(err: unknown): string {
  return err instanceof AppError ? err.message : 'Action failed — please try again.';
}

type Tab = 'queue' | 'flags' | 'adjust' | 'audit';

export function AdminReview() {
  useAppVersion();
  const me = getCurrentUser();
  const isAdmin = me.role === 'admin';

  const [tab, setTab] = useState<Tab>('queue');
  const [error, setError] = useState<string | null>(null);
  const [dupParent, setDupParent] = useState<Record<string, string>>({});
  const [resDesc, setResDesc] = useState<Record<string, string>>({});
  const [adjust, setAdjust] = useState({ citizenId: 'u-aarav', delta: '5', reason: '' });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Administrator area" />
        <Card>
          <EmptyState icon="lock" title="403 — authorised administrators only">
            <p>
              You are signed in as a resident. Score rules, validations, point adjustments and audits are restricted to
              authorised administrators. Switch the demo session to <strong>Meera Iyer (admin)</strong> in the top bar.
            </p>
            <Link className="btn btn-secondary btn-sm" to="/resident/dashboard">Back to resident portal</Link>
          </EmptyState>
        </Card>
      </>
    );
  }

  const actor = currentUserActor();
  const pending = getValidations('pending');
  const decided = getValidations().filter((v) => v.status !== 'pending');
  const flags = getFlagsRaw();
  const openFlags = flags.filter((f) => f.status === 'open');
  const ledger = getLedger();
  const users = listAllUsers();
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  function run(fn: () => void) {
    setError(null);
    try {
      fn();
    } catch (err) {
      setError(msg(err));
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'queue', label: 'Validation queue', count: pending.length },
    { key: 'flags', label: 'Abuse flags', count: openFlags.length },
    { key: 'adjust', label: 'Manual adjustments' },
    { key: 'audit', label: 'Score audit trail', count: ledger.length },
  ];

  return (
    <>
      <PageHeader
        title="Review console"
        subtitle="Authorised administrators only. Every decision is written to the score audit trail with your reviewer identity."
        actions={<Badge tone="violet"><Icon name="shield" size={13} /> Signed in as admin</Badge>}
      />

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat icon="clock" label="Pending validations" value={pending.length} hint="Points settle only on decision" />
        <Stat icon="alert-triangle" label="Open abuse flags" value={openFlags.length} hint="Awareness — no auto-penalties" />
        <Stat icon="list" label="Ledger entries" value={ledger.length} hint="Append-only audit trail" />
        <Stat icon="check-circle" label="Decided reviews" value={decided.length} />
      </div>

      <div className="filter-bar" role="tablist" aria-label="Admin sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {error && <div className="notice red" role="alert" style={{ marginBottom: 12 }}><span className="n-icon"><Icon name="alert-triangle" size={16} /></span><p>{error}</p></div>}

      <div key={tab} className="tab-transition">
        {tab === 'queue' && (
        <Card title="Validation queue" icon="clock" subtitle="Score-affecting requests awaiting a moderator decision. Nothing is awarded on submission alone.">
          {pending.length === 0 ? (
            <EmptyState icon="check-circle" title="Queue is clear">
              <p>New requests appear here as residents submit them.</p>
            </EmptyState>
          ) : (
            <div className="feed">
              {pending.map((v) => {
                const issue = getIssue(v.issueId);
                const similarIds = (v.payload.similarIssueIds ?? '').split(',').filter(Boolean);
                return (
                  <div className="feed-item" key={v.id} style={{ flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                      <span className="feed-icon amber" aria-hidden="true"><Icon name="clock" size={16} /></span>
                      <div className="feed-body">
                        <div className="feed-title">
                          {v.type === 'duplicate_review' ? 'Duplicate review' : v.type === 'review_request' ? 'Review request' : v.type === 'recurrence' ? 'Recurrence claim' : v.type === 'evidence' ? 'Evidence validation' : 'New-issue validation'} — {v.issueId}
                        </div>
                        <div className="feed-sub">
                          {nameOf(v.citizenId)} · {CONTRIBUTION_LABELS[v.type]} · requested {timeAgo(v.createdAt)}
                        </div>
                        <div className="feed-meta">
                          {v.note}
                          {issue && <> · status: {issue.status}</>}
                          {v.type === 'duplicate_review' && similarIds.length > 0 && (
                            <> · similar: {similarIds.map((sid) => <span key={sid} className="mono" style={{ marginRight: 6 }}>{sid}</span>)}</>
                          )}
                        </div>
                      </div>
                      <Badge tone="amber">+{v.pointsIfApproved} if approved</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 46, alignItems: 'center' }}>
                      {v.type === 'duplicate_review' && (
                        <>
                          <select
                            aria-label={`Original issue for ${v.issueId}`}
                            style={{ maxWidth: 260 }}
                            value={dupParent[v.id] ?? ''}
                            onChange={(e) => setDupParent((m) => ({ ...m, [v.id]: e.target.value }))}
                          >
                            <option value="">Select original issue…</option>
                            {(v.payload.similarIssueIds ?? '').split(',').filter(Boolean).map((sid) => (
                              <option key={sid} value={sid}>{sid}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => run(() => {
                              decideDuplicateReview(v.id, 'duplicate', actor, { parentIssueId: dupParent[v.id] });
                              pushToast('Confirmed duplicate — small credit recorded, attribution preserved');
                            })}
                          >
                            <Icon name="copy" size={14} /> Confirm duplicate (+{getRules().points.duplicateReport} pts)
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => run(() => {
                              decideDuplicateReview(v.id, 'independent', actor);
                              pushToast('Confirmed independent — full reporter credit recorded');
                            })}
                          >
                            <Icon name="check" size={14} /> Confirm independent (full pts)
                          </button>
                        </>
                      )}
                      {v.type !== 'duplicate_review' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => run(() => {
                              decideValidation(v.id, 'approve', actor);
                              pushToast('Approved — points recorded after validation');
                            })}
                          >
                            <Icon name="check" size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => run(() => {
                              decideValidation(v.id, 'reject', actor, 'Did not pass validation — recorded as not awarded (never a penalty).');
                              pushToast('Rejected — recorded as not awarded, no deduction', 'info');
                            })}
                          >
                            <Icon name="x" size={14} /> Reject (0 pts)
                          </button>
                        </>
                      )}
                      <Link className="btn btn-ghost btn-sm" to={`/resident/issues/${v.issueId}`}>Open issue</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'flags' && (
        <Card title="Abuse & anomaly flags" icon="alert-triangle" subtitle="Automatic awareness flags from anti-farming limits. Flags never deduct points by themselves.">
          {flags.length === 0 ? (
            <EmptyState icon="check-circle" title="No flags raised">
              <p>Caps and heuristics raise flags here when patterns look unusual.</p>
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Citizen</th>
                    <th scope="col">Flag</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f: AbuseFlag) => (
                    <tr key={f.id}>
                      <td>{nameOf(f.citizenId)}</td>
                      <td><span className="mono">{f.type}</span></td>
                      <td><Badge tone={f.severity === 'high' ? 'red' : f.severity === 'medium' ? 'amber' : 'neutral'}>{f.severity}</Badge></td>
                      <td style={{ maxWidth: 340 }}>{f.detail}</td>
                      <td><Badge tone={f.status === 'open' ? 'amber' : 'green'}>{f.status}</Badge></td>
                      <td>
                        {f.status === 'open' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => run(() => {
                              saveFlagsRaw(
                                getFlagsRaw().map((x) =>
                                  x.id === f.id
                                    ? { ...x, status: 'dismissed' as const, resolvedAt: new Date().toISOString(), resolvedBy: actor.id }
                                    : x,
                                ),
                              );
                              pushToast('Flag dismissed', 'info');
                            })}
                          >
                            Dismiss
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'adjust' && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Card title="Manual point adjustment" icon="settings" subtitle="Documented, attributed, and visible in the resident's activity. Residents can never do this themselves.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => {
                  const entry = adjustPoints({ citizenId: adjust.citizenId, delta: Number(adjust.delta), reason: adjust.reason }, actor);
                  pushToast(`Adjustment of ${fmtPoints(entry.points)} recorded for ${nameOf(adjust.citizenId)}`);
                  setAdjust({ ...adjust, reason: '' });
                });
              }}
            >
              <div className="field">
                <label htmlFor="adj-user">Citizen</label>
                <select id="adj-user" value={adjust.citizenId} onChange={(e) => setAdjust((a) => ({ ...a, citizenId: e.target.value }))}>
                  {users.filter((u) => u.role === 'resident').map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="adj-delta">Points (positive or negative)</label>
                <input id="adj-delta" type="number" value={adjust.delta} onChange={(e) => setAdjust((a) => ({ ...a, delta: e.target.value }))} />
                <div className="hint">Balances never go below zero — citizens are never given a negative score.</div>
              </div>
              <div className="field">
                <label htmlFor="adj-reason">Documented reason (required)</label>
                <textarea id="adj-reason" value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} placeholder="e.g. good-faith correction after audit review #A-17" />
              </div>
              <button className="btn btn-primary" type="submit"><Icon name="settings" size={15} /> Record adjustment</button>
            </form>
          </Card>

          <Card title="Issue lifecycle (demo controls)" icon="flag" subtitle="Move issues through the workflow — resolution submission alone never records citizen-confirmed points.">
            <p className="kbd-note" style={{ marginBottom: 10 }}>
              Pick an issue below to acknowledge, start work, or submit a resolution. The resident portal handles
              confirmation and review requests.
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th scope="col">Issue</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
                </thead>
                <tbody>
                  {(['ISS-1001', 'ISS-1002', 'ISS-1004', 'ISS-1006'] as const).map((iid) => {
                    const issue = getIssue(iid);
                    if (!issue) return null;
                    return (
                      <tr key={iid}>
                        <td><Link className="mono" to={`/resident/issues/${iid}`}>{iid}</Link></td>
                        <td><Badge tone="navy">{issue.status}</Badge></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {issue.status === 'submitted' && (
                              <button className="btn btn-secondary btn-sm" onClick={() => run(() => { acknowledgeIssue(actor, iid); pushToast(`${iid} acknowledged`); })}>Acknowledge</button>
                            )}
                            {(issue.status === 'acknowledged' || issue.status === 'submitted') && (
                              <button className="btn btn-secondary btn-sm" onClick={() => run(() => { startProgress(actor, iid); pushToast(`${iid} moved to in progress`); })}>Start work</button>
                            )}
                            {!issue.resolution && issue.status !== 'closed' && issue.status !== 'closed_duplicate' && (
                              <span style={{ display: 'inline-flex', gap: 6 }}>
                                <input
                                  type="text"
                                  aria-label={`Resolution description for ${iid}`}
                                  placeholder="Resolution description…"
                                  style={{ width: 180 }}
                                  value={resDesc[iid] ?? ''}
                                  onChange={(e) => setResDesc((m) => ({ ...m, [iid]: e.target.value }))}
                                />
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => run(() => { submitResolution(actor, iid, { description: resDesc[iid] ?? '' }); pushToast(`Resolution submitted for ${iid} — awaiting reporter confirmation`); })}
                                >
                                  Resolve
                                </button>
                              </span>
                            )}
                            {issue.status === 'resolved' && <span className="kbd-note">awaiting reporter confirmation</span>}
                            {(issue.status === 'resolved' || issue.status === 'closed') && (
                              <button className="btn btn-danger btn-sm" onClick={() => run(() => { closeIssue(actor, iid, 'Closed after verification window.'); pushToast(`${iid} closed`); })}>Close</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <Card title="Score audit trail" icon="list" subtitle="Append-only ledger: every adjustment references its application event, issue and validator.">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Citizen</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Contribution</th>
                  <th scope="col" className="num">Points</th>
                  <th scope="col">Status</th>
                  <th scope="col">Event</th>
                  <th scope="col">Validated by</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id}>
                    <td className="kbd-note">{formatDateTime(e.createdAt)}</td>
                    <td>{nameOf(e.citizenId)}</td>
                    <td>{e.issueId ? <span className="mono">{e.issueId}</span> : '—'}</td>
                    <td>{CONTRIBUTION_LABELS[e.type]}</td>
                    <td className={`num points-cell ${e.points > 0 ? 'pos' : 'zero'}`}>{fmtPoints(e.points)}</td>
                    <td><Badge tone={e.status === 'awarded' ? 'green' : e.status === 'pending' ? 'amber' : 'neutral'}>{e.status}</Badge></td>
                    <td><span className="mono">{e.appEvent}</span></td>
                    <td className="kbd-note">{e.validatedBy.startsWith('u-') ? nameOf(e.validatedBy) : e.validatedBy}</td>
                    <td style={{ maxWidth: 280, fontSize: 12.5 }}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </div>

      <div className="footer-note">
        <div className="notice navy">
          <span className="n-icon" aria-hidden="true"><Icon name="info" size={16} /></span>
          <p>
            Test hook: suspected abuse can also be raised manually via the audit service (<span className="mono">raiseAbuseFlag</span>) —
            e.g. <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => run(() => { raiseAbuseFlag({ citizenId: 'u-rahul', type: 'repeated_rejections', severity: 'low', detail: 'Demo flag: several contributions were recently recorded as not awarded. Review for pattern. (Demonstration only.)' }); pushToast('Demo flag raised', 'info'); })}>
              raise a demo flag
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
