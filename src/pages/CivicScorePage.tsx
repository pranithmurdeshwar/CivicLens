import { Link } from 'react-router-dom';
import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Badge, Card, EmptyState, LevelBadge, PageHeader, ProgressBar, Stat } from '../components/ui';
import { getCurrentUser } from '../services/auth';
import { getLedger, getLevels, getScoreSummary } from '../services/civicScore';
import { getRules } from '../services/civicScore';
import { APP_EVENTS, CONTRIBUTION_LABELS, SCORING_DISCLAIMER } from '../data/defaults';
import { fmtPoints, formatDateTime, timeAgo } from '../lib/format';
import type { LedgerStatus } from '../types';

const STATUS_BADGE: Record<LedgerStatus, { tone: string; label: string }> = {
  awarded: { tone: 'green', label: 'Verified' },
  pending: { tone: 'amber', label: 'Pending validation' },
  rejected: { tone: 'neutral', label: 'Not awarded' },
};

export function CivicScorePage() {
  useAppVersion();
  const user = getCurrentUser();
  const summary = getScoreSummary(user.id);
  const rules = getRules();
  const levels = getLevels();
  const ledger = getLedger(user.id);

  return (
    <>
      <PageHeader
        title="My Civic Score"
        subtitle="A transparent record of your verified community contributions. Points follow the demo rules — they never measure personal worth, and genuine reports are never penalised."
        actions={<LevelBadge level={summary.level} big />}
      />

      {/* ------------------------------ summary ------------------------------ */}
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat icon="award" label="Total points" value={summary.totalPoints} hint="Verified contributions only" />
        <Stat icon="check-circle" label="Verified contributions" value={summary.verifiedContributions} hint={`${summary.rejectedCount} recorded as not awarded`} />
        <Stat icon="clock" label="Awaiting validation" value={summary.pendingCount} hint="No points until review completes" />
        <Stat icon="star" label="Recognition level" value={summary.level.name} hint={`Level floor: ${summary.level.min} pts`} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div>
          {/* --------------------------- progress --------------------------- */}
          <Card title="Progress toward the next level" icon="arrow-right">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>{summary.totalPoints}</span>
              <span className="kbd-note">points · {summary.level.name}</span>
            </div>
            {summary.nextLevel ? (
              <>
                <ProgressBar pct={summary.progressPct ?? 0} label={`Progress from ${summary.level.name} to ${summary.nextLevel.name}`} />
                <p className="kbd-note" style={{ marginTop: 8 }}>
                  <strong>{summary.pointsToNext} points</strong> to reach <strong>{summary.nextLevel.name}</strong> ({summary.nextLevel.min} pts) —{' '}
                  {summary.level.min}–{summary.level.max ?? '∞'} pts is {summary.level.name}.
                </p>
              </>
            ) : (
              <p className="kbd-note">You have reached the highest recognition level. Thank you for sustained community contribution.</p>
            )}

            <div className="levels-rail" style={{ marginTop: 14 }}>
              {levels.map((lvl) => {
                const current = lvl.key === summary.level.key;
                const past = summary.totalPoints >= (lvl.max ?? lvl.min) && !current;
                return (
                  <div key={lvl.key} className={`level-row ${current ? 'current' : past ? 'past' : ''}`}>
                    <span className="lr-icon" aria-hidden="true">
                      <Icon name={lvl.key === 'champion' ? 'star' : lvl.key === 'guardian' ? 'shield' : lvl.key === 'contributor' ? 'award' : 'eye'} size={17} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="lr-name">
                        {lvl.name} {current && <Badge tone="teal">You are here</Badge>}
                      </div>
                      <div className="lr-range">{lvl.min}{lvl.max != null ? `–${lvl.max}` : '+'} points · {lvl.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ---------------------------- badges ---------------------------- */}
          <Card title="Achievement badges" icon="star" subtitle="Accessible recognition for verified milestones.">
            <div className="badges-grid">
              {summary.badges.map((b) => (
                <div key={b.key} className={`ach-badge ${b.earned ? 'earned' : 'locked'}`}>
                  <span className="ach-icon" aria-hidden="true"><Icon name={b.icon} size={17} /></span>
                  <div>
                    <div className="ach-name">{b.name}</div>
                    <div className="ach-desc">
                      {b.description}
                      {b.earned && b.earnedAt && <div style={{ marginTop: 2, color: 'var(--teal-400)', fontWeight: 650 }}>Earned {timeAgo(b.earnedAt)}</div>}
                    </div>
                  </div>
                  <span className="sr-only">{b.earned ? 'Earned' : 'Not yet earned'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          {/* -------------------------- activity feed ------------------------ */}
          <Card title="Recent score activity" icon="clock" subtitle="Every entry references the application event and issue it came from.">
            {ledger.length === 0 ? (
              <EmptyState icon="award" title="No contributions yet">
                <p>Report an issue or add evidence to start your contribution record.</p>
                <Link className="btn btn-primary btn-sm" to="/resident/issues/new">Report an issue</Link>
              </EmptyState>
            ) : (
              <div className="feed">
                {ledger.slice(0, 8).map((e) => (
                  <div className="feed-item" key={e.id}>
                    <span className={`feed-icon ${e.status === 'awarded' ? 'green' : e.status === 'pending' ? 'amber' : 'red'}`} aria-hidden="true">
                      <Icon name="award" size={15} />
                    </span>
                    <div className="feed-body">
                      <div className="feed-title">{CONTRIBUTION_LABELS[e.type]}</div>
                      <div className="feed-sub">
                        {e.reason}
                        {e.issueId && (
                          <>
                            {' · '}
                            <Link to={`/resident/issues/${e.issueId}`}>{e.issueId}</Link>
                          </>
                        )}
                      </div>
                      <div className="feed-meta">
                        {formatDateTime(e.createdAt)} · <span className="mono">{e.appEvent}</span> · validated by {e.validatedBy.startsWith('u-') ? 'moderator' : e.validatedBy}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`points-cell ${e.points > 0 ? 'pos' : 'zero'}`}>{fmtPoints(e.points)}</div>
                      <Badge tone={STATUS_BADGE[e.status].tone}>{STATUS_BADGE[e.status].label}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ---------------------- contribution history ---------------------- */}
          <Card title="Contribution history" icon="list" subtitle="Related issue ID · action · points · verification state · timestamp.">
            {ledger.length === 0 ? (
              <EmptyState icon="list" title="Nothing recorded yet" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">Issue</th>
                      <th scope="col">Action</th>
                      <th scope="col" className="num">Points</th>
                      <th scope="col">Verification</th>
                      <th scope="col">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e) => (
                      <tr key={e.id}>
                        <td>{e.issueId ? <Link className="mono" to={`/resident/issues/${e.issueId}`}>{e.issueId}</Link> : <span className="kbd-note">—</span>}</td>
                        <td>{CONTRIBUTION_LABELS[e.type]}</td>
                        <td className={`num points-cell ${e.points > 0 ? 'pos' : 'zero'}`}>{fmtPoints(e.points)}</td>
                        <td><Badge tone={STATUS_BADGE[e.status].tone}>{STATUS_BADGE[e.status].label}</Badge></td>
                        <td className="kbd-note">{formatDateTime(e.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* --------------------------- how it works -------------------------- */}
          <Card title="How points work" icon="info">
            <div className="rule-grid">
              {(
                [
                  ['flag', 'Issue report', rules.points.issueReport],
                  ['camera', 'Supporting evidence', rules.points.evidence],
                  ['check-circle', 'Resolution confirmation', rules.points.resolutionConfirmation],
                  ['search', 'Review request', rules.points.reviewRequest],
                  ['refresh-cw', 'Recurrence evidence', rules.points.recurrenceEvidence],
                  ['copy', 'Confirmed duplicate', rules.points.duplicateReport],
                ] as [string, string, number][]
              ).map(([icon, label, pts]) => (
                <div className="rule-card" key={label}>
                  <div className="rc-head">
                    <Icon name={icon} size={15} />
                    <span className="rc-label">{label}</span>
                    <span className="rc-pts">+{pts}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="notice" style={{ marginTop: 12 }}>
              <span className="n-icon" aria-hidden="true"><Icon name="info" size={16} /></span>
              <p>
                {SCORING_DISCLAIMER} Anti-farming limits apply: at most {rules.limits.maxPointsPerIssuePerCitizen} pts per issue,
                {rules.limits.dailyPointCap} pts/day, and limited duplicate/recurrence credits. Scores are audited in the{' '}
                <span className="mono">{APP_EVENTS.adminManualAdjustment}</span> trail — only authorised administrators can adjust points.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="footer-note">
        <div className="notice teal">
          <span className="n-icon" aria-hidden="true"><Icon name="lock" size={16} /></span>
          <p>
            <strong>Privacy.</strong> Your score is visible to you and the moderation team. Public recognition on the
            community page is strictly <Link to="/resident/profile">opt-in</Link> and never shows contact details or exact locations.
          </p>
        </div>
      </div>
    </>
  );
}
