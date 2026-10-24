import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Badge, Card, LevelBadge, PageHeader } from '../components/ui';
import { getCurrentUser, listAllUsers } from '../services/auth';
import { getScoreSummary } from '../services/civicScore';
import { Link } from 'react-router-dom';

/**
 * Community recognition — deliberately NOT a complaint-volume leaderboard.
 * Shows opted-in citizens with their verified-contribution counts, framed as
 * collective recognition. Contact details and exact locations are never shown;
 * users who opt out appear only to themselves, anonymised.
 */
export function CommunityRecognition() {
  useAppVersion();
  const me = getCurrentUser();
  const users = listAllUsers();

  const residents = users
    .filter((u) => u.role === 'resident')
    .map((u) => ({ user: u, summary: getScoreSummary(u.id) }))
    .sort((a, b) => b.summary.verifiedContributions - a.summary.verifiedContributions || b.summary.totalPoints - a.summary.totalPoints);

  const spotlight = residents.filter((r) => r.user.publicRecognitionOptIn || r.user.id === me.id);
  const totalVerified = residents.reduce((s, r) => s + r.summary.verifiedContributions, 0);

  return (
    <>
      <PageHeader
        title="Community recognition"
        subtitle="Recognising verified contributions across the community — collaboration, not competition. This page deliberately has no complaint-volume ranking."
        actions={<Badge tone="teal"><Icon name="check-circle" size={13} /> {totalVerified} verified contributions (demo)</Badge>}
      />

      <Card
        title="Recognition spotlight"
        icon="users"
        subtitle="Sorted by verified contributions, not by volume of complaints. Residents control their visibility."
      >
        <div>
          {spotlight.map(({ user, summary }) => {
            const isMe = user.id === me.id;
            const publicView = user.publicRecognitionOptIn;
            return (
              <div className="spotlight-row" key={user.id}>
                <span className={`avatar ${publicView ? 'optin' : ''}`} aria-hidden="true">
                  {publicView ? user.name.charAt(0) : <Icon name="user" size={18} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#ffffff' }}>
                    {publicView
                      ? isMe
                        ? `${user.name.split(' ')[0]} (you)`
                        : user.name.split(' ')[0]
                      : isMe
                        ? 'You (private mode)'
                        : 'A community member'}
                  </div>
                  <div className="kbd-note">
                    {summary.verifiedContributions} verified contribution{summary.verifiedContributions === 1 ? '' : 's'}
                    {publicView ? '' : ' · recognition hidden by choice'}
                    {publicView && ` · ${user.ward}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <LevelBadge level={summary.level} />
                  <div className="kbd-note" style={{ marginTop: 4 }}>{summary.totalPoints} pts</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="notice" style={{ marginTop: 12 }}>
          <span className="n-icon" aria-hidden="true"><Icon name="lock" size={16} /></span>
          <p>
            Only first names appear — never emails, phone numbers or exact locations. Residents who prefer privacy keep
            their recognition hidden; their contributions still count fully toward their own Civic Score.
          </p>
        </div>
      </Card>

      <Card title="Why this isn't a leaderboard" icon="info">
        <p>
          Ranking citizens by complaint volume rewards noise, not impact. CivicLens recognises <strong>verified</strong>{' '}
          contributions: reports that proved actionable, evidence that helped verification, on-site resolution
          confirmations and responsible follow-ups.
        </p>
        <p className="kbd-note">
          Privacy controls: <Link to="/resident/profile">manage your opt-in choice</Link>. Demo values shown are fictional.
        </p>
      </Card>
    </>
  );
}
