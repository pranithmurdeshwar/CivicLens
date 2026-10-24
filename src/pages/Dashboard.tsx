import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Badge, Card, EmptyState, LevelBadge, PageHeader, ProgressBar, Stat, StatusPill } from '../components/ui';
import { getCurrentUser } from '../services/auth';
import { getIssuesByReporter, getAllIssues } from '../services/issues';
import { getLedger, getScoreSummary } from '../services/civicScore';
import { getValidations } from '../services/validations';
import { CONTRIBUTION_LABELS, SCORING_DISCLAIMER } from '../data/defaults';
import { fmtPoints, timeAgo } from '../lib/format';
import { Link } from 'react-router-dom';

export function Dashboard() {
  useAppVersion();
  const user = getCurrentUser();
  const summary = getScoreSummary(user.id);
  const myIssues = getIssuesByReporter(user.id);
  const recentIssues = myIssues.slice(0, 4);
  const recentActivity = getLedger(user.id).slice(0, 5);
  const myPending = getValidations('pending').filter((v) => v.citizenId === user.id);
  const totalIssues = getAllIssues().length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        subtitle="Community issue reporting with transparent, verified civic recognition."
        actions={
          <>
            <Link className="btn btn-primary" to="/resident/issues/new">
              <Icon name="plus" size={16} /> Report an issue
            </Link>
            <Link className="btn btn-secondary" to="/resident/issues">
              <Icon name="flag" size={16} /> Browse issues
            </Link>
          </>
        }
      />

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat icon="award" label="Civic Score" value={`${summary.totalPoints} pts`} hint={<Link to="/resident/civic-score">View breakdown →</Link>} />
        <Stat icon="check-circle" label="Verified contributions" value={summary.verifiedContributions} hint={`${summary.pendingCount} awaiting validation`} />
        <Stat icon="flag" label="My reports" value={myIssues.length} hint={`${totalIssues} issues tracked community-wide (demo)`} />
        <div className="card stat">
          <span className="stat-icon" aria-hidden="true"><Icon name="star" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ marginBottom: 6 }}><LevelBadge level={summary.level} /></div>
            {summary.nextLevel ? (
              <>
                <ProgressBar pct={summary.progressPct ?? 0} label={`Progress to ${summary.nextLevel.name}`} />
                <div className="stat-hint" style={{ marginTop: 4 }}>
                  {summary.pointsToNext} pts to {summary.nextLevel.name}
                </div>
              </>
            ) : (
              <div className="stat-hint">Top recognition level reached</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <Card title="My recent reports" icon="flag" actions={<Link className="btn btn-ghost btn-sm" to="/resident/issues">View all</Link>}>
          {recentIssues.length === 0 ? (
            <EmptyState icon="flag" title="No reports yet">
              <p>Your reported issues will appear here.</p>
              <Link className="btn btn-primary btn-sm" to="/resident/issues/new">Report your first issue</Link>
            </EmptyState>
          ) : (
            <div className="feed">
              {recentIssues.map((issue) => (
                <div className="feed-item" key={issue.id}>
                  <span className="feed-icon teal" aria-hidden="true"><Icon name="flag" size={16} /></span>
                  <div className="feed-body">
                    <Link className="feed-title" to={`/resident/issues/${issue.id}`} style={{ color: 'inherit' }}>
                      {issue.title}
                    </Link>
                    <div className="feed-meta">
                      <span className="mono">{issue.id}</span>
                      <span>{issue.category}</span>
                      <span>{timeAgo(issue.createdAt)}</span>
                    </div>
                  </div>
                  <StatusPill status={issue.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Recent score activity"
          icon="award"
          actions={<Link className="btn btn-ghost btn-sm" to="/resident/civic-score">Civic Score</Link>}
        >
          {recentActivity.length === 0 ? (
            <EmptyState icon="award" title="No score activity yet">
              <p>Verified contributions earn points under the demo rules.</p>
            </EmptyState>
          ) : (
            <div className="feed">
              {recentActivity.map((e) => (
                <div className="feed-item" key={e.id}>
                  <span className={`feed-icon ${e.status === 'awarded' ? 'green' : e.status === 'pending' ? 'amber' : 'red'}`} aria-hidden="true">
                    <Icon name="award" size={16} />
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
                      {timeAgo(e.createdAt)} · event <span className="mono">{e.appEvent}</span>
                    </div>
                  </div>
                  <span className={`points-cell ${e.points > 0 ? 'pos' : 'zero'}`}>{fmtPoints(e.points)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {myPending.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card title="Awaiting validation" icon="clock">
            <div className="feed">
              {myPending.map((v) => (
                <div className="feed-item" key={v.id}>
                  <span className="feed-icon amber" aria-hidden="true"><Icon name="clock" size={16} /></span>
                  <div className="feed-body">
                    <div className="feed-title">{CONTRIBUTION_LABELS[v.type]} — {v.issueId}</div>
                    <div className="feed-sub">{v.note}</div>
                  </div>
                  <Badge tone="amber">+{v.pointsIfApproved} if approved</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="footer-note">
        <div className="notice">
          <span className="n-icon" aria-hidden="true"><Icon name="info" size={16} /></span>
          <p>
            <strong>Demo notice.</strong> {SCORING_DISCLAIMER} Points recognise verified community contributions — they are
            never a measure of personal worth, and reporting a genuine issue is never penalised.
          </p>
        </div>
      </div>
    </>
  );
}
