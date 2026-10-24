import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EvidenceType } from '../types';
import { Icon } from '../components/Icon';
import { Badge, Card, EmptyState, PageHeader, StatusPill } from '../components/ui';
import { useAppVersion } from '../lib/hooks';
import { getCurrentUser } from '../services/auth';
import { addEvidence, confirmResolution, findIssue, findSimilarIssues, getIssueEvidence, reportRecurrence, requestReview } from '../services/issues';
import { getRules } from '../services/civicScore';
import { getEntryByEventId } from '../services/civicScore';
import { buildEventId } from '../data/defaults';
import { pushToast } from '../lib/toast';
import { AppError, AuthorizationError, ConflictError, ValidationError } from '../lib/errors';
import { formatDateTime, timeAgo } from '../lib/format';

function errMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return 'Something went wrong — please try again.';
}

export function IssueDetail() {
  useAppVersion();
  const { id = '' } = useParams();
  const issue = findIssue(id);
  const user = getCurrentUser();
  const rules = getRules();

  const [evidenceType, setEvidenceType] = useState<EvidenceType>('photo');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceMedia, setEvidenceMedia] = useState<{ name: string; url: string } | null>(null);
  const [onSite, setOnSite] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [recurrenceNote, setRecurrenceNote] = useState('');
  const [flash, setFlash] = useState<{ tone: 'teal' | 'amber' | 'red' | 'navy'; text: string } | null>(null);

  if (!issue) {
    return (
      <>
        <PageHeader title="Issue not found" />
        <Card>
          <EmptyState icon="search" title="This issue does not exist">
            <p>It may have been removed, or the link is incorrect.</p>
            <Link className="btn btn-primary btn-sm" to="/resident/issues">Back to issues</Link>
          </EmptyState>
        </Card>
      </>
    );
  }

  const isReporter = user.id === issue.reporterId;
  const evidence = getIssueEvidence(issue.id);
  const similar = findSimilarIssues({ category: issue.category, area: issue.area, excludeId: issue.id });
  const unresolved = ['submitted', 'acknowledged', 'in_progress'].includes(issue.status);
  const ageDays = Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / 86_400_000);
  const reviewEligible = unresolved && ageDays >= rules.limits.reviewRequestMinDaysUnresolved;

  const reportEntry = getEntryByEventId(buildEventId('issueReport', { issueId: issue.id, citizenId: issue.reporterId }));
  const myEvidenceEntry = getEntryByEventId(buildEventId('evidence', { issueId: issue.id, citizenId: user.id }));
  const resolutionConfirmed = issue.resolution?.confirmedByReporter;

  function guard(fn: () => void) {
    try {
      fn();
    } catch (err) {
      setFlash({ tone: 'red', text: errMessage(err) });
      if (err instanceof AuthorizationError || err instanceof ValidationError || err instanceof ConflictError) return;
      throw err;
    }
  }

  return (
    <>
      <PageHeader
        title={issue.title}
        subtitle={
          <>
            <span className="mono">{issue.id}</span> · {issue.category} · severity {issue.severity} · reported {timeAgo(issue.createdAt)} · last update {timeAgo(issue.updatedAt)}
          </>
        }
        actions={<StatusPill status={issue.status} />}
      />

      {flash && (
        <div className={`notice ${flash.tone}`} style={{ marginBottom: 14 }} role="status">
          <span className="n-icon" aria-hidden="true"><Icon name="info" size={16} /></span>
          <p>{flash.text}</p>
        </div>
      )}

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div>
          <Card title="Report details" icon="file-text">
            <p>{issue.description}</p>
            <div className="ir-meta" style={{ marginTop: 10 }}>
              <Badge tone="navy"><Icon name="map-pin" size={12} /> {issue.area}</Badge>
              {issue.landmark && <Badge tone="neutral">{issue.landmark}</Badge>}
              <Badge tone="neutral">Ward: {issue.ward}</Badge>
              {issue.recurrenceCount > 0 && <Badge tone="amber">Reopened ×{issue.recurrenceCount}</Badge>}
            </div>
            {issue.duplicateOfIssueId && (
              <div className="notice navy" style={{ marginTop: 12 }}>
                <span className="n-icon"><Icon name="copy" size={16} /></span>
                <p>
                  Closed as a confirmed duplicate of <Link to={`/resident/issues/${issue.duplicateOfIssueId}`}>{issue.duplicateOfIssueId}</Link>.
                  The reporter received a small credit and the original report keeps full attribution.
                </p>
              </div>
            )}
            {issue.adminNote && (
              <div className="notice" style={{ marginTop: 12 }}>
                <span className="n-icon"><Icon name="info" size={16} /></span>
                <p><strong>Moderator note:</strong> {issue.adminNote}</p>
              </div>
            )}

            {/* Attached Photos and Videos */}
            {issue.media && issue.media.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="camera" size={16} /> Attached photos &amp; videos ({issue.media.length})
                </h3>
                <div className="media-gallery-grid">
                  {issue.media.map((m) => (
                    <div key={m.id} className="media-gallery-item">
                      {m.type === 'photo' ? (
                        <img src={m.url} alt={m.name} loading="lazy" />
                      ) : (
                        <video src={m.url} controls preload="metadata" />
                      )}
                      <div className="media-gallery-caption">
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>
                          {m.name}
                        </span>
                        <Badge tone={m.type === 'photo' ? 'teal' : 'violet'}>
                          <Icon name={m.type === 'photo' ? 'image' : 'video'} size={11} /> {m.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ------------------------------ evidence ------------------------------ */}
          <Card title="Supporting evidence" icon="camera" subtitle={`First useful evidence per issue earns +${rules.points.evidence} pts (one award per contributor per issue).`}>
            {evidence.length === 0 ? (
              <EmptyState icon="camera" title="No evidence yet">
                <p>Photos or context from other residents help verification.</p>
              </EmptyState>
            ) : (
              <div className="feed" style={{ marginBottom: 12 }}>
                {evidence.map((ev) => (
                  <div className="feed-item" key={ev.id}>
                    <span className="feed-icon teal" aria-hidden="true"><Icon name={ev.type === 'photo' ? 'camera' : ev.type === 'video' ? 'video' : 'file-text'} size={15} /></span>
                    <div className="feed-body">
                      <div className="feed-sub" style={{ marginBottom: 2 }}>
                        <Badge tone="neutral">{ev.type}</Badge> {ev.submittedById === user.id ? 'You' : ev.submittedById === issue.reporterId ? 'Reporter' : 'Another resident'} · {timeAgo(ev.createdAt)}
                      </div>
                      <div>{ev.note}</div>
                      {ev.mediaUrl && (
                        <div style={{ marginTop: 8, maxWidth: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          {ev.type === 'video' ? (
                            <video src={ev.mediaUrl} controls style={{ width: '100%', maxHeight: 180, display: 'block' }} />
                          ) : (
                            <img src={ev.mediaUrl} alt={ev.mediaName || 'Evidence'} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!unresolved && issue.status !== 'resolved' ? null : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  guard(() => {
                    const res = addEvidence(
                      { id: user.id, role: user.role, kind: 'user' },
                      {
                        issueId: issue.id,
                        type: evidenceType,
                        note: evidenceNote,
                        mediaUrl: evidenceMedia?.url,
                        mediaName: evidenceMedia?.name,
                      },
                    );
                    setEvidenceNote('');
                    setEvidenceMedia(null);
                    setFlash({ tone: res.outcome === 'awarded' ? 'teal' : 'amber', text: res.message });
                    if (res.outcome === 'awarded') pushToast(`+${res.award?.pointsAdded} points recorded`, 'success');
                  });
                }}
              >
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="ev-type">Evidence type</label>
                    <select id="ev-type" value={evidenceType} onChange={(e) => { setEvidenceType(e.target.value as EvidenceType); setEvidenceMedia(null); }}>
                      <option value="photo">Photo</option>
                      <option value="video">Video</option>
                      <option value="document">Document</option>
                      <option value="description">Written description</option>
                    </select>
                  </div>
                </div>

                {(evidenceType === 'photo' || evidenceType === 'video') && (
                  <div className="field">
                    <label htmlFor="ev-file">Attach {evidenceType === 'photo' ? 'photo' : 'video'} file (optional)</label>
                    <input
                      id="ev-file"
                      type="file"
                      accept={evidenceType === 'photo' ? 'image/*' : 'video/*'}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setEvidenceMedia({ name: file.name, url: reader.result });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {evidenceMedia && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge tone="teal">{evidenceMedia.name}</Badge>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEvidenceMedia(null)}>Remove</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="ev-note">What does it show?</label>
                  <textarea id="ev-note" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Describe the evidence context (min. 15 characters to auto-validate as useful supporting evidence)." />
                </div>
                <button className="btn btn-secondary btn-sm" type="submit" disabled={issue.status === 'closed' || issue.status === 'closed_duplicate'}>
                  <Icon name="camera" size={15} /> Submit evidence
                </button>
                {myEvidenceEntry && <span className="kbd-note" style={{ marginLeft: 8 }}>Evidence points already recorded for you on this issue.</span>}
              </form>
            )}
          </Card>

          {/* ---------------------------- resolution ------------------------------ */}
          <Card title="Resolution" icon="check-circle" subtitle={`Reporter confirmation is worth +${rules.points.resolutionConfirmation} pts — only after checking on site.`}>
            {issue.resolution ? (
              <>
                <div className="notice teal" style={{ marginBottom: 12 }}>
                  <span className="n-icon"><Icon name="check-circle" size={16} /></span>
                  <p>
                    <strong>Resolution submitted {formatDateTime(issue.resolution.submittedAt)}:</strong> {issue.resolution.description}
                  </p>
                </div>
                {resolutionConfirmed ? (
                  <Badge tone="green"><Icon name="check" size={13} /> Confirmed by the reporter {timeAgo(issue.resolution.confirmedAt ?? '')}</Badge>
                ) : isReporter ? (
                  issue.status === 'resolved' ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        guard(() => {
                          const res = confirmResolution({ id: user.id, role: user.role, kind: 'user' }, { issueId: issue.id, verifiedOnSite: onSite });
                          setOnSite(false);
                          setFlash({ tone: 'teal', text: res.message });
                          if (res.award?.outcome === 'awarded') pushToast(`+${res.award.pointsAdded} points — resolution confirmation recorded`, 'success');
                          else if (res.award) pushToast('Confirmation recorded (no additional points for this event)', 'info');
                        });
                      }}
                    >
                      <div className="checkbox-row" style={{ marginBottom: 10 }}>
                        <input id="onsite" type="checkbox" checked={onSite} onChange={(e) => setOnSite(e.target.checked)} />
                        <label htmlFor="onsite">
                          I have visited the location and checked that the issue is actually resolved.
                        </label>
                      </div>
                      <button className="btn btn-primary btn-sm" type="submit">
                        <Icon name="check" size={15} /> Confirm resolution (+{rules.points.resolutionConfirmation} pts)
                      </button>
                    </form>
                  ) : (
                    <span className="kbd-note">This issue was closed before you could confirm. No points were deducted.</span>
                  )
                ) : (
                  <span className="kbd-note">Waiting for the original reporter to verify on site. “Resolution submitted” alone does not record citizen-confirmed points.</span>
                )}
              </>
            ) : (
              <EmptyState icon="clock" title="No resolution submitted yet">
                <p>The ward team submits a resolution when work is completed.</p>
              </EmptyState>
            )}
          </Card>

          {/* ------------------------- review & recurrence ------------------------ */}
          {unresolved && (
            <Card title="Unresolved after a while?" icon="search" subtitle={`Review requests open ${rules.limits.reviewRequestMinDaysUnresolved} days after reporting (+${rules.points.reviewRequest} pts after validation — never a penalty if the issue is genuine).`}>
              {reviewEligible ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    guard(() => {
                      const res = requestReview({ id: user.id, role: user.role, kind: 'user' }, { issueId: issue.id, note: reviewNote });
                      setReviewNote('');
                      setFlash({ tone: res.award?.outcome === 'awarded' ? 'teal' : 'navy', text: res.message });
                      if (res.award?.outcome === 'awarded') pushToast(`+${res.award.pointsAdded} points — validated review request`, 'success');
                    });
                  }}
                >
                  <div className="field">
                    <label htmlFor="rr-note">What should the re-check focus on? (optional)</label>
                    <input id="rr-note" type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="e.g. patch has washed away again" />
                  </div>
                  <button className="btn btn-secondary btn-sm" type="submit"><Icon name="search" size={15} /> Request a review</button>
                </form>
              ) : (
                <p className="kbd-note">
                  This issue was reported {ageDays} day(s) ago — review requests open after {rules.limits.reviewRequestMinDaysUnresolved} days.
                  {isReporter ? ' Your report stays valid and un-penalised in the meantime.' : ''}
                </p>
              )}
            </Card>
          )}

          {issue.status === 'resolved' && (
            <Card title="Problem came back?" icon="refresh-cw" subtitle={`Verified recurrence evidence earns +${rules.points.recurrenceEvidence} pts and reopens the issue — recorded only after moderator verification.`}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  guard(() => {
                    const res = reportRecurrence({ id: user.id, role: user.role, kind: 'user' }, { issueId: issue.id, note: recurrenceNote });
                    setRecurrenceNote('');
                    setFlash({ tone: 'amber', text: res.message });
                  });
                }}
              >
                <div className="field">
                  <label htmlFor="rec-note">What did you observe?</label>
                  <textarea id="rec-note" value={recurrenceNote} onChange={(e) => setRecurrenceNote(e.target.value)} placeholder="e.g. the light is off again since Monday night" />
                </div>
                <button className="btn btn-secondary btn-sm" type="submit"><Icon name="refresh-cw" size={15} /> Report recurrence</button>
              </form>
            </Card>
          )}
        </div>

        {/* ------------------------------- side rail ------------------------------ */}
        <div>
          <Card title="Score connections" icon="award">
            <div className="feed">
              <div className="feed-item">
                <span className={`feed-icon ${reportEntry?.status === 'awarded' ? 'green' : reportEntry?.status === 'pending' ? 'amber' : 'red'}`} aria-hidden="true"><Icon name="flag" size={15} /></span>
                <div className="feed-body">
                  <div className="feed-title">Reporter credit</div>
                  <div className="feed-sub">
                    {reportEntry?.status === 'awarded' && `Recorded (+${reportEntry.points} pts).`}
                    {reportEntry?.status === 'pending' && 'Awaiting duplicate review — no points recorded yet.'}
                    {reportEntry?.status === 'rejected' && reportEntry.reason}
                    {!reportEntry && (isReporter ? 'Points are recorded after validation.' : 'Only the report workflow can award this.')}
                  </div>
                </div>
              </div>
              <div className="feed-item">
                <span className="feed-icon teal" aria-hidden="true"><Icon name="camera" size={15} /></span>
                <div className="feed-body">
                  <div className="feed-title">Evidence credit</div>
                  <div className="feed-sub">{myEvidenceEntry ? `Recorded for you (+${myEvidenceEntry.points} pts).` : `+${rules.points.evidence} pts for your first useful evidence here.`}</div>
                </div>
              </div>
              <div className="feed-item">
                <span className="feed-icon teal" aria-hidden="true"><Icon name="check-circle" size={15} /></span>
                <div className="feed-body">
                  <div className="feed-title">Resolution confirmation</div>
                  <div className="feed-sub">
                    {resolutionConfirmed
                      ? `Confirmed (+${rules.points.resolutionConfirmation} pts to the reporter).`
                      : isReporter
                        ? `Check on site to confirm (+${rules.points.resolutionConfirmation} pts).`
                        : `Worth +${rules.points.resolutionConfirmation} pts to the reporter after on-site confirmation.`}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {similar.length > 0 && (
            <Card title="Similar in this area" icon="copy" subtitle="Same category and area (last 90 days). Moderators use this to catch duplicates.">
              <div className="feed">
                {similar.map((s) => (
                  <div className="feed-item" key={s.id}>
                    <span className="feed-icon" aria-hidden="true"><Icon name="flag" size={14} /></span>
                    <div className="feed-body">
                      <Link to={`/resident/issues/${s.id}`} className="feed-title" style={{ color: 'inherit' }}>{s.title}</Link>
                      <div className="feed-meta"><span className="mono">{s.id}</span> · {timeAgo(s.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Privacy" icon="lock">
            <p className="kbd-note">
              This page shows area-level location only. Exact residential coordinates and personal contact details are never
              stored or displayed. Reporter identity is shown as attribution, never as a public contact channel.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
