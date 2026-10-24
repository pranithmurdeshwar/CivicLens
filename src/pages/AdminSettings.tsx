import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppVersion } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Badge, Card, EmptyState, PageHeader } from '../components/ui';
import { currentUserActor, getCurrentUser } from '../services/auth';
import { getLevels, getRules, resetRulesToDefaults, updateLevels, updateRules, getConfigAudit } from '../services/civicScore';
import { SCORING_DISCLAIMER } from '../data/defaults';
import { formatDateTime } from '../lib/format';
import { pushToast } from '../lib/toast';
import { AppError } from '../lib/errors';
import type { RuleKey } from '../types';

function msg(err: unknown): string {
  return err instanceof AppError ? err.message : 'Action failed — please try again.';
}

const POINT_FIELDS: { key: RuleKey; label: string; desc: string }[] = [
  { key: 'issueReport', label: 'Issue report', desc: 'Valid, actionable issue report' },
  { key: 'evidence', label: 'Supporting evidence', desc: 'Useful evidence (once per issue per contributor)' },
  { key: 'resolutionConfirmation', label: 'Resolution confirmation', desc: 'Reporter confirms after checking on site' },
  { key: 'reviewRequest', label: 'Review request', desc: 'Supported review on an unresolved issue, post-validation' },
  { key: 'recurrenceEvidence', label: 'Recurrence evidence', desc: 'Verified recurrence, post-review' },
  { key: 'duplicateReport', label: 'Confirmed duplicate', desc: 'Small credit; attribution preserved' },
];

const LIMIT_FIELDS: { key: keyof ReturnType<typeof getRules>['limits']; label: string; desc: string }[] = [
  { key: 'maxPointsPerIssuePerCitizen', label: 'Max points per issue / citizen', desc: 'Anti-farming ceiling per issue' },
  { key: 'dailyPointCap', label: 'Daily point cap', desc: 'Hard ceiling per citizen per day' },
  { key: 'maxDuplicateCreditsPerWeek', label: 'Duplicate credits / week', desc: 'Rolling weekly limit' },
  { key: 'maxRecurrenceCreditsPerIssue', label: 'Recurrence credits / issue', desc: 'Per issue, verified only' },
  { key: 'minEvidenceNoteLength', label: 'Min evidence note length', desc: 'Auto-validation heuristic (demo)' },
  { key: 'reviewRequestMinDaysUnresolved', label: 'Review request window (days)', desc: 'Days unresolved before requesting review' },
];

export function AdminSettings() {
  useAppVersion();
  const me = getCurrentUser();
  const isAdmin = me.role === 'admin';
  const rules = getRules();
  const levels = getLevels();
  const audit = getConfigAudit();
  const [error, setError] = useState<string | null>(null);

  const [points, setPoints] = useState<Record<RuleKey, string>>(
    () => Object.fromEntries(POINT_FIELDS.map((f) => [f.key, String(rules.points[f.key])])) as Record<RuleKey, string>,
  );
  const [limits, setLimits] = useState<Record<string, string>>(
    () => Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, String(rules.limits[f.key])])),
  );
  const [policies, setPolicies] = useState(rules.policies);
  const [levelDraft, setLevelDraft] = useState(levels.map((l) => ({ ...l })));

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Score settings" />
        <Card>
          <EmptyState icon="lock" title="403 — authorised administrators only">
            <p>
              Scoring rules, thresholds and review policies can only be changed by authorised administrators. Residents can
              never edit their own points or the rules. Switch the demo session to <strong>Meera Iyer (admin)</strong> in the top bar.
            </p>
            <Link className="btn btn-secondary btn-sm" to="/resident/civic-score">View my Civic Score instead</Link>
          </EmptyState>
        </Card>
      </>
    );
  }

  function run(fn: () => void, okMsg: string) {
    setError(null);
    try {
      fn();
      pushToast(okMsg);
    } catch (err) {
      setError(msg(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Civic Score settings"
        subtitle="Configurable scoring rules, recognition thresholds and review policies. Every change is recorded in the configuration audit trail."
        actions={
          <button
            className="btn btn-secondary"
            onClick={() => run(() => { resetRulesToDefaults(currentUserActor()); pushToast('Scoring configuration reset to demo defaults'); }, 'Reset complete')}
          >
            <Icon name="refresh-cw" size={15} /> Reset to demo defaults
          </button>
        }
      />

      {error && <div className="notice red" role="alert" style={{ marginBottom: 12 }}><span className="n-icon"><Icon name="alert-triangle" size={16} /></span><p>{error}</p></div>}

      <div className="notice amber" style={{ marginBottom: 14 }}>
        <span className="n-icon" aria-hidden="true"><Icon name="alert-triangle" size={16} /></span>
        <p>{SCORING_DISCLAIMER}</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div>
          <Card title="Point rules" icon="award" subtitle="Provisional demo values — tune to your municipality's pilot.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => {
                  updateRules(
                    { points: Object.fromEntries(POINT_FIELDS.map((f) => [f.key, Number(points[f.key])])) as Record<RuleKey, number> },
                    currentUserActor(),
                  );
                }, 'Point rules saved — configuration change audited');
              }}
            >
              {POINT_FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`pts-${f.key}`}>{f.label} <span className="kbd-note">— {f.desc}</span></label>
                  <input id={`pts-${f.key}`} type="number" min={0} max={100} value={points[f.key]} onChange={(e) => setPoints((p) => ({ ...p, [f.key]: e.target.value }))} style={{ maxWidth: 140 }} />
                </div>
              ))}
              <button className="btn btn-primary btn-sm" type="submit"><Icon name="check" size={15} /> Save point rules</button>
            </form>
          </Card>

          <Card title="Limits & anti-farming thresholds" icon="shield">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => {
                  updateRules(
                    { limits: Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, Number(limits[f.key])])) as typeof rules.limits },
                    currentUserActor(),
                  );
                }, 'Limits saved — configuration change audited');
              }}
            >
              {LIMIT_FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`lim-${f.key}`}>{f.label} <span className="kbd-note">— {f.desc}</span></label>
                  <input id={`lim-${f.key}`} type="number" min={0} max={1000} value={limits[f.key]} onChange={(e) => setLimits((l) => ({ ...l, [f.key]: e.target.value }))} style={{ maxWidth: 140 }} />
                </div>
              ))}
              <button className="btn btn-primary btn-sm" type="submit"><Icon name="check" size={15} /> Save limits</button>
            </form>
          </Card>
        </div>

        <div>
          <Card title="Review policies" icon="search" subtitle="Which events settle automatically vs. require moderator review.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => { updateRules({ policies }, currentUserActor()); }, 'Review policies saved — configuration change audited');
              }}
            >
              {(
                [
                  ['newIssueValidation', 'New issue reports', 'Manual = every report queues for validation before points.'],
                  ['evidenceValidation', 'Supporting evidence', 'Manual = evidence waits for a moderator decision.'],
                  ['reviewRequestValidation', 'Review requests', 'Manual = points only after a moderator validates the request.'],
                ] as [keyof typeof policies, string, string][]
              ).map(([key, label, hint]) => (
                <div className="field" key={key}>
                  <label htmlFor={`pol-${key}`}>{label}</label>
                  <select id={`pol-${key}`} value={policies[key]} onChange={(e) => setPolicies((p) => ({ ...p, [key]: e.target.value as 'auto' | 'manual' }))}>
                    <option value="auto">Automatic (system validates)</option>
                    <option value="manual">Manual (moderator review required)</option>
                  </select>
                  <div className="hint">{hint}</div>
                </div>
              ))}
              <button className="btn btn-primary btn-sm" type="submit"><Icon name="check" size={15} /> Save policies</button>
            </form>
          </Card>

          <Card title="Recognition levels" icon="star" subtitle="Thresholds must be strictly increasing. Top level is open-ended.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => {
                  updateLevels(levelDraft, currentUserActor());
                }, 'Recognition levels saved — configuration change audited');
              }}
            >
              {levelDraft.map((lvl, i) => (
                <div className="form-row" key={lvl.key} style={{ alignItems: 'end' }}>
                  <div className="field">
                    <label htmlFor={`lvl-name-${i}`}>Name</label>
                    <input id={`lvl-name-${i}`} type="text" value={lvl.name} onChange={(e) => setLevelDraft((ls) => ls.map((l, j) => (j === i ? { ...l, name: e.target.value } : l)))} />
                  </div>
                  <div className="field" style={{ flex: '0 0 110px' }}>
                    <label htmlFor={`lvl-min-${i}`}>Min pts</label>
                    <input id={`lvl-min-${i}`} type="number" min={0} max={100000} value={lvl.min} onChange={(e) => setLevelDraft((ls) => ls.map((l, j) => (j === i ? { ...l, min: Number(e.target.value) } : l)))} />
                  </div>
                </div>
              ))}
              <button className="btn btn-primary btn-sm" type="submit"><Icon name="check" size={15} /> Save levels</button>
            </form>
          </Card>

          <Card title="Configuration audit" icon="list" subtitle="Who changed what, and when.">
            {audit.length === 0 ? (
              <EmptyState icon="list" title="No configuration changes yet" />
            ) : (
              <div className="feed">
                {audit.slice(0, 8).map((a) => (
                  <div className="feed-item" key={a.id}>
                    <span className="feed-icon" aria-hidden="true"><Icon name="settings" size={15} /></span>
                    <div className="feed-body">
                      <div style={{ fontSize: 13 }}>{a.summary}</div>
                      <div className="feed-meta">{formatDateTime(a.createdAt)} · by {a.actorId === 'u-meera' ? 'Meera Iyer (admin)' : a.actorId}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="notice" style={{ marginTop: 10 }}>
              <span className="n-icon" aria-hidden="true"><Icon name="lock" size={16} /></span>
              <p>Residents have no route to these settings — the UI, services and tests all enforce admin-only access.</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="footer-note">
        <p className="kbd-note"><Badge tone="teal">Guardrail</Badge> Point balances can never be edited by residents, and the ledger is append-only — corrections appear as audited adjustments, never silent edits.</p>
      </div>
    </>
  );
}
