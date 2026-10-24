import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Card, EmptyState, PageHeader, StatusPill } from '../components/ui';
import { getAllIssues } from '../services/issues';
import type { IssueCategory, IssueStatus } from '../types';
import { timeAgo } from '../lib/format';

const CATEGORIES: IssueCategory[] = ['roads', 'water', 'electricity', 'sanitation', 'streetlight', 'drainage', 'parks', 'other'];
const STATUSES: IssueStatus[] = ['submitted', 'acknowledged', 'in_progress', 'resolved', 'closed_duplicate', 'closed'];

export function IssuesList() {
  useAppVersion();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | IssueCategory>('all');
  const [status, setStatus] = useState<'all' | IssueStatus>('all');

  const issues = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return getAllIssues().filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false;
      if (status !== 'all' && i.status !== status) return false;
      if (needle && !`${i.title} ${i.description} ${i.area} ${i.id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [q, cat, status]);

  return (
    <>
      <PageHeader
        title="Community issues"
        subtitle="Every report below is fictional demo data. Duplicate candidates are reviewed by moderators before any points are recorded."
        actions={
          <Link className="btn btn-primary" to="/resident/issues/new">
            <Icon name="plus" size={16} /> Report an issue
          </Link>
        }
      />

      <Card>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search title, description, area or ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search issues"
          />
          <select value={cat} onChange={(e) => setCat(e.target.value as 'all' | IssueCategory)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | IssueStatus)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {issues.length === 0 ? (
          <EmptyState icon="search" title="No issues match these filters">
            <p>Try clearing the search or filters.</p>
          </EmptyState>
        ) : (
          <div>
            {issues.map((issue) => (
              <div className="issue-row" key={issue.id}>
                <span className="ir-icon" aria-hidden="true"><Icon name="flag" size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/resident/issues/${issue.id}`} className="ir-title">{issue.title}</Link>
                  <div className="ir-meta">
                    <span className="mono">{issue.id}</span>
                    <span>{issue.category}</span>
                    <span aria-hidden="true">·</span>
                    <span><Icon name="map-pin" size={11} /> {issue.area}</span>
                    <span aria-hidden="true">·</span>
                    <span>{timeAgo(issue.createdAt)}</span>
                    {issue.media && issue.media.length > 0 && (
                      <span className="badge neutral" title={`${issue.media.length} photo(s)/video(s) attached`}>
                        <Icon name="camera" size={11} /> {issue.media.length}
                      </span>
                    )}
                    {issue.duplicateReviewStatus === 'flagged' && (
                      <span className="badge amber" style={{ marginLeft: 4 }}>Duplicate review pending</span>
                    )}
                  </div>
                </div>
                <div className="ir-side">
                  <StatusPill status={issue.status} />
                  <span className="kbd-note">severity: {issue.severity}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
