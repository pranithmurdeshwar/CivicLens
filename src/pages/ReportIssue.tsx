import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { IssueCategory, Severity } from '../types';
import { Icon } from '../components/Icon';
import { Badge, Card, PageHeader } from '../components/ui';
import { currentUserActor } from '../services/auth';
import { reportIssue } from '../services/issues';
import { getRules } from '../services/civicScore';
import { useAppVersion } from '../lib/hooks';
import { pushToast } from '../lib/toast';
import { ValidationError } from '../lib/errors';

const CATEGORIES: { value: IssueCategory; label: string; icon: string }[] = [
  { value: 'roads', label: 'Roads & footpaths', icon: 'road' },
  { value: 'water', label: 'Water supply', icon: 'droplet' },
  { value: 'electricity', label: 'Electricity', icon: 'zap' },
  { value: 'sanitation', label: 'Sanitation & waste', icon: 'trash' },
  { value: 'streetlight', label: 'Streetlights', icon: 'lamp' },
  { value: 'drainage', label: 'Drainage', icon: 'droplet' },
  { value: 'parks', label: 'Parks & public spaces', icon: 'star' },
  { value: 'other', label: 'Other', icon: 'info' },
];

interface UploadedMedia {
  id: string;
  name: string;
  type: 'photo' | 'video';
  url: string;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReportIssue() {
  useAppVersion();
  const navigate = useNavigate();
  const rules = getRules();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'roads' as IssueCategory,
    severity: 'medium' as Severity,
    area: '',
    landmark: '',
  });

  const [mediaFiles, setMediaFiles] = useState<UploadedMedia[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; message: string; duplicateSuspected: boolean; mediaCount: number } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const processFiles = (files: FileList | File[]) => {
    setUploadError(null);
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit

    Array.from(files).forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');

      if (!isImg && !isVid) {
        setUploadError(`"${file.name}" is not a supported image or video file.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`"${file.name}" exceeds the 15 MB size limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setMediaFiles((prev) => [
            ...prev,
            {
              id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              type: isVid ? 'video' : 'photo',
              url: reader.result as string,
              size: file.size,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value to allow re-uploading the same file if needed
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeMedia = (id: string) => {
    setMediaFiles((prev) => prev.filter((m) => m.id !== id));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = reportIssue(currentUserActor(), {
        title: form.title,
        description: form.description,
        category: form.category,
        severity: form.severity,
        area: form.area,
        landmark: form.landmark,
        media: mediaFiles.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          url: m.url,
          size: m.size,
        })),
      });

      setResult({
        id: res.issue.id,
        message: res.message,
        duplicateSuspected: res.duplicateSuspected,
        mediaCount: mediaFiles.length,
      });

      pushToast(
        res.duplicateSuspected
          ? 'Report submitted — queued for duplicate review'
          : mediaFiles.length > 0
          ? `Report submitted with ${mediaFiles.length} photo/video attachment(s)`
          : 'Report submitted',
        'success',
      );
    } catch (err) {
      if (err instanceof ValidationError) setError(err.message);
      else throw err;
    }
  }

  if (result) {
    return (
      <>
        <PageHeader title="Report submitted" />
        <Card
          icon="check-circle"
          title={<span>Report <span className="mono">{result.id}</span> received</span>}
          subtitle="A copy of this report now lives in your issues list."
        >
          <div className={`notice ${result.duplicateSuspected ? 'amber' : 'teal'}`} style={{ marginBottom: 14 }}>
            <span className="n-icon" aria-hidden="true"><Icon name={result.duplicateSuspected ? 'clock' : 'check-circle'} size={16} /></span>
            <p>{result.message}</p>
          </div>

          {result.mediaCount > 0 && (
            <div className="notice teal" style={{ marginBottom: 14 }}>
              <span className="n-icon" aria-hidden="true"><Icon name="camera" size={16} /></span>
              <p>
                <strong>{result.mediaCount} media attachment{result.mediaCount > 1 ? 's' : ''} saved:</strong> Your uploaded photos/videos are attached as visual evidence to support swift verification by municipal workers.
              </p>
            </div>
          )}

          {result.duplicateSuspected && (
            <div className="notice navy" style={{ marginBottom: 14 }}>
              <span className="n-icon" aria-hidden="true"><Icon name="info" size={16} /></span>
              <p>
                Why review? Repeated submissions about the same issue should not earn unlimited points — but independent
                reports keep their full attribution. A moderator confirms which case this is, and either way your
                contribution is recorded fairly.
              </p>
            </div>
          )}
          <div className="form-actions">
            <Link className="btn btn-primary" to={`/resident/issues/${result.id}`}>Open report</Link>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setResult(null);
                setForm({ title: '', description: '', category: 'roads', severity: 'medium', area: '', landmark: '' });
                setMediaFiles([]);
              }}
            >
              Report another issue
            </button>
            <Link className="btn btn-ghost" to="/resident/civic-score">View Civic Score</Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Report an issue"
        subtitle={`A valid, actionable report earns +${rules.points.issueReport} points after validation under the demo rules. If it looks like an existing report, a moderator reviews it first (+${rules.points.duplicateReport} pts as a confirmed duplicate, full credit if independent).`}
      />
      <Card>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="ri-title">Title</label>
            <input id="ri-title" type="text" value={form.title} onChange={set('title')} placeholder="Short, specific summary of the issue" aria-invalid={!!error && !form.title} />
          </div>
          <div className="field">
            <label htmlFor="ri-desc">Description</label>
            <textarea id="ri-desc" value={form.description} onChange={set('description')} placeholder="What is happening, since when, and who is affected? (min. 20 characters)" />
            <div className="hint">Area-level location only — never share exact home coordinates or personal contact details.</div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="ri-cat">Category</label>
              <select id="ri-cat" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ri-sev">Severity</label>
              <select id="ri-sev" value={form.severity} onChange={set('severity')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="ri-area">Area / street</label>
              <input id="ri-area" type="text" value={form.area} onChange={set('area')} placeholder="e.g. Jayanagar 4th Block" />
            </div>
            <div className="field">
              <label htmlFor="ri-landmark">Nearest landmark (optional)</label>
              <input id="ri-landmark" type="text" value={form.landmark} onChange={set('landmark')} placeholder="e.g. near the bus stop" />
            </div>
          </div>

          {/* ----------------- Photos & Videos Upload Area ----------------- */}
          <div className="media-upload-area">
            <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#f1f5f9', marginBottom: 6 }}>
              Photos & Videos of the problem (optional)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              id="ri-media-file-input"
            />

            <div
              className={`media-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload photos or videos. Click to browse or drag and drop files."
            >
              <div className="media-dropzone-icon">
                <Icon name="upload" size={24} />
              </div>
              <div>
                <div className="media-dropzone-title">Upload photos or videos of the problem</div>
                <div className="media-dropzone-sub">
                  Drag and drop files here, or <span style={{ color: 'var(--teal-400)', textDecoration: 'underline' }}>browse files</span> from your device
                </div>
              </div>
              <div className="kbd-note">
                Supports JPG, PNG, WEBP, MP4, WEBM (up to 15 MB per file)
              </div>
            </div>

            {uploadError && (
              <div className="notice red" style={{ marginTop: 8 }}>
                <span className="n-icon" aria-hidden="true"><Icon name="alert-triangle" size={16} /></span>
                <p>{uploadError}</p>
              </div>
            )}

            {mediaFiles.length > 0 && (
              <div className="media-previews">
                {mediaFiles.map((item) => (
                  <div key={item.id} className="media-preview-card">
                    {item.type === 'photo' ? (
                      <img src={item.url} alt={item.name} className="media-preview-thumb" />
                    ) : (
                      <video src={item.url} controls className="media-preview-video" />
                    )}
                    <button
                      type="button"
                      className="media-preview-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMedia(item.id);
                      }}
                      aria-label={`Remove ${item.name}`}
                      title="Remove file"
                    >
                      <Icon name="x" size={14} />
                    </button>
                    <div className="media-preview-info">
                      <div className="media-preview-name" title={item.name}>{item.name}</div>
                      <div className="media-preview-meta">
                        <Badge tone={item.type === 'photo' ? 'teal' : 'violet'}>
                          <Icon name={item.type === 'photo' ? 'image' : 'video'} size={11} /> {item.type}
                        </Badge>
                        <span>{formatBytes(item.size)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="notice red" role="alert"><span className="n-icon"><Icon name="alert-triangle" size={16} /></span><p>{error}</p></div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary"><Icon name="flag" size={16} /> Submit report</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/resident/issues')}>Cancel</button>
            <span style={{ marginLeft: 'auto' }}><Badge tone="teal">Demo rules · +{rules.points.issueReport} pts on validation</Badge></span>
          </div>
        </form>
      </Card>
    </>
  );
}
