import React, { useEffect } from 'react';
import type { IssueStatus, RecognitionLevel } from '../types';
import { Icon } from './Icon';

/* ---------------------------------- Card ----------------------------------- */

export function Card(props: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: string;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${props.className ?? ''}`} id={props.id} aria-label={typeof props.title === 'string' ? props.title : undefined}>
      {(props.title || props.actions) && (
        <div className="card-title-row">
          {props.icon && (
            <span className="stat-icon" aria-hidden="true">
              <Icon name={props.icon} />
            </span>
          )}
          <div>
            {props.title && <h2>{props.title}</h2>}
            {props.subtitle && <div className="card-sub">{props.subtitle}</div>}
          </div>
          <div className="spacer" />
          {props.actions}
        </div>
      )}
      {props.children}
    </section>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

export function Badge({ tone = 'neutral', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

const STATUS_META: Record<IssueStatus, { tone: string; label: string }> = {
  submitted: { tone: 'navy', label: 'Submitted' },
  acknowledged: { tone: 'amber', label: 'Acknowledged' },
  in_progress: { tone: 'teal', label: 'In progress' },
  resolved: { tone: 'green', label: 'Resolved' },
  closed_duplicate: { tone: 'violet', label: 'Closed — duplicate' },
  closed: { tone: 'neutral', label: 'Closed' },
};

export function StatusPill({ status }: { status: IssueStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* ------------------------------- Level badge -------------------------------- */

export function LevelBadge({ level, big }: { level: RecognitionLevel; big?: boolean }) {
  const icon =
    level.key === 'champion' ? 'star' : level.key === 'guardian' ? 'shield' : level.key === 'contributor' ? 'award' : 'eye';
  return (
    <Badge tone="teal" >
      <span className={big ? 'badge big teal' : ''}>
        <Icon name={icon} size={big ? 15 : 13} />
        {level.name}
      </span>
    </Badge>
  );
}

/* ------------------------------- Progress bar ------------------------------- */

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div className="progress-row">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-pct" aria-hidden="true">{clamped}%</span>
    </div>
  );
}

/* ----------------------------------- Stat ----------------------------------- */

export function Stat(props: { icon: string; label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card stat">
      <span className="stat-icon" aria-hidden="true"><Icon name={props.icon} /></span>
      <div>
        <div className="stat-value">{props.value}</div>
        <div className="stat-label">{props.label}</div>
        {props.hint && <div className="stat-hint">{props.hint}</div>}
      </div>
    </div>
  );
}

/* -------------------------------- Empty state -------------------------------- */

export function EmptyState({ icon = 'search', title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="e-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* ---------------------------------- Modal ----------------------------------- */

export function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props]);

  if (!props.open) return null;
  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title-row">
          <h2>{props.title}</h2>
          <button className="modal-close" onClick={props.onClose} aria-label="Close dialog">
            <Icon name="x" size={16} />
          </button>
        </div>
        {props.children}
        {props.footer && <div className="form-actions">{props.footer}</div>}
      </div>
    </div>
  );
}

/* -------------------------------- PageHeader --------------------------------- */

export function PageHeader(props: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div className="ph-text">
        <h1>{props.title}</h1>
        {props.subtitle && <div className="ph-sub">{props.subtitle}</div>}
      </div>
      {props.actions && <div className="ph-actions">{props.actions}</div>}
    </div>
  );
}
