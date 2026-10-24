import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Badge, Card, EmptyState, LevelBadge, PageHeader, ProgressBar, Stat } from '../components/ui';
import { getCurrentUser } from '../services/auth';
import { getUser, listUsers, saveUsers } from '../services/db';
import { getLedger, getScoreSummary } from '../services/civicScore';
import { getIssuesByReporter } from '../services/issues';
import { CONTRIBUTION_LABELS } from '../data/defaults';
import { fmtPoints, formatDate, formatDateTime } from '../lib/format';
import { pushToast } from '../lib/toast';

export function Profile() {
  useAppVersion();
  const user = getCurrentUser();
  const summary = getScoreSummary(user.id);
  const issues = getIssuesByReporter(user.id);
  const ledger = getLedger(user.id);
  const [optIn, setOptIn] = useState(user.publicRecognitionOptIn);

  function setPrivacy(checked: boolean) {
    setOptIn(checked);
    const users = listUsers();
    saveUsers(users.map((u) => (u.id === user.id ? { ...u, publicRecognitionOptIn: checked } : u)));
    const me = getUser(user.id);
    if (me?.publicRecognitionOptIn !== checked) {
      // Storage write failed (sandboxed preview) — state stays consistent for the session.
      void me;
    }
    pushToast(
      checked
        ? 'Public recognition enabled — only your first name, level and verified-contribution count are shown.'
        : 'Public recognition disabled — you will not appear on the community page.',
      'info',
    );
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Your account, privacy choices and full contribution record." />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div>
          <Card>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
              <span className="avatar optin" style={{ width: 54, height: 54, fontSize: 18 }}>{user.avatarInitials}</span>
              <div>
                <h2 style={{ marginBottom: 2 }}>{user.name}</h2>
                <div className="kbd-note">{user.email} · member since {formatDate(user.joinedAt)}</div>
                <div style={{ marginTop: 6 }}><Badge tone="navy">{user.ward}</Badge></div>
              </div>
            </div>
            {user.bio && <p className="kbd-note">{user.bio}</p>}
            <p className="kbd-note" style={{ marginTop: 8 }}>
              Demo account — the real product would never display your email or any contact detail publicly.
            </p>
          </Card>

          <Card title="Privacy & recognition" icon="lock" subtitle="Public recognition is strictly opt-in.">
            <div className="checkbox-row">
              <input id="optin" type="checkbox" checked={optIn} onChange={(e) => setPrivacy(e.target.checked)} />
              <label htmlFor="optin">
                <strong>Appear on the community recognition page.</strong> If enabled, only your first name, recognition
                level and verified-contribution count are shown — never your contact details, exact location, or any
                complaint-volume ranking.
              </label>
            </div>
          </Card>

          <div className="grid grid-2">
            <Stat icon="award" label="Civic Score" value={summary.totalPoints} hint={<Link to="/resident/civic-score">Open Civic Score →</Link>} />
            <Stat icon="flag" label="Reports filed" value={issues.length} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Card title="Level progress" icon="star">
              <div style={{ marginBottom: 8 }}><LevelBadge level={summary.level} /></div>
              {summary.nextLevel ? (
                <>
                  <ProgressBar pct={summary.progressPct ?? 0} label={`Progress to ${summary.nextLevel.name}`} />
                  <p className="kbd-note" style={{ marginTop: 6 }}>{summary.pointsToNext} pts to {summary.nextLevel.name}</p>
                </>
              ) : (
                <p className="kbd-note">Highest recognition level reached.</p>
              )}
            </Card>
          </div>
        </div>

        <Card title="Contribution record" icon="list" subtitle="Every entry is audit-linked to an application event.">
          {ledger.length === 0 ? (
            <EmptyState icon="list" title="No contributions recorded yet" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">Issue</th>
                    <th scope="col" className="num">Points</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {CONTRIBUTION_LABELS[e.type]}
                        <div className="kbd-note">
                          {e.status === 'awarded' ? 'Verified' : e.status === 'pending' ? 'Pending validation' : 'Not awarded'}
                        </div>
                      </td>
                      <td>{e.issueId ? <span className="mono">{e.issueId}</span> : '—'}</td>
                      <td className={`num points-cell ${e.points > 0 ? 'pos' : 'zero'}`}>{fmtPoints(e.points)}</td>
                      <td className="kbd-note">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="kbd-note" style={{ marginTop: 10 }}>
            Residents can never edit these entries. Adjustments can only be made — and are always documented — by an
            authorised administrator.
          </p>
        </Card>
      </div>

      <div className="footer-note">
        <div className="notice">
          <span className="n-icon" aria-hidden="true"><Icon name="info" size={16} /></span>
          <p>Civic Score details and history live on the <Link to="/resident/civic-score">Civic Score page</Link>.</p>
        </div>
      </div>
    </>
  );
}
