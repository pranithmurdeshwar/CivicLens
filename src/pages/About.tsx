import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, PageHeader } from '../components/ui';
import { getRules } from '../services/civicScore';
import { SCORING_DISCLAIMER } from '../data/defaults';
import { useAppVersion } from '../lib/hooks';

export function About() {
  useAppVersion();
  const rules = getRules();
  return (
    <>
      <PageHeader
        title="About Civic Score & Citizen Recognition"
        subtitle="How this CivicLens AI feature works, what is simulated, and the fairness principles behind it."
      />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card title="What this feature does" icon="info">
          <p>
            Civic Score records <strong>verified community contributions</strong> — reports that proved actionable, useful
            evidence, on-site resolution confirmations, validated review requests, verified recurrences and confirmed
            duplicates — in an append-only contribution ledger.
          </p>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>Every point entry references a real application event and, where applicable, an issue ID.</li>
            <li>Duplicate awards are prevented with deterministic idempotency keys.</li>
            <li>Points settle only after the underlying action succeeds and passes configured validation.</li>
            <li>Residents can never edit their own points; administrators act through an audited console.</li>
          </ul>
        </Card>

        <Card title="Fairness principles" icon="shield">
          <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
            <li>No unlimited farming: repeated submissions about the same issue stop earning.</li>
            <li>Attribution preserved: independent reporters keep full credit; duplicates earn a small courtesy credit.</li>
            <li>No punishment for persistence: unresolved genuine issues never deduct points — rejections award zero, never negative.</li>
            <li>Opt-in public recognition; no contact details or exact coordinates anywhere.</li>
            <li>No complaint-volume leaderboard — recognition spotlight, not popularity ranking.</li>
          </ul>
          <div className="notice amber">
            <span className="n-icon"><Icon name="alert-triangle" size={16} /></span>
            <p>{SCORING_DISCLAIMER}</p>
          </div>
        </Card>

        <Card title="Demo values in use" icon="award">
          <div className="rule-grid">
            {(
              [
                ['Issue report', rules.points.issueReport],
                ['Supporting evidence', rules.points.evidence],
                ['Resolution confirmation', rules.points.resolutionConfirmation],
                ['Review request (validated)', rules.points.reviewRequest],
                ['Recurrence evidence (verified)', rules.points.recurrenceEvidence],
                ['Confirmed duplicate', rules.points.duplicateReport],
              ] as [string, number][]
            ).map(([label, pts]) => (
              <div className="rule-card" key={label}>
                <div className="rc-head"><span className="rc-label">{label}</span><span className="rc-pts">+{pts}</span></div>
              </div>
            ))}
          </div>
          <p className="kbd-note" style={{ marginTop: 10 }}>
            Admins tune these in <Link to="/admin/civic-score">Score settings</Link>; changes are audited.
          </p>
        </Card>

        <Card title="What is simulated" icon="file-text">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>All citizens, issues, evidence and scores are <strong>fictional demo data</strong>.</li>
            <li>Photo/video uploads are simulated (no files are stored).</li>
            <li>Storage uses the prototype mechanism (localStorage with in-memory fallback) — a real deployment would use a backend with true authentication.</li>
            <li>Validation heuristics (note length, area matching) are demo stand-ins for moderation.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
