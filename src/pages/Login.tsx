import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DEMO_USERS, switchUser } from '../services/auth';

const DEMO_PASSWORD = 'demo1234';

type LoginMode = 'citizen' | 'admin';

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const filteredUsers = useMemo(
    () => DEMO_USERS.filter((u) => (mode === 'citizen' ? u.role === 'resident' : u.role === 'admin')),
    [mode],
  );

  function handleModeSwitch(newMode: LoginMode) {
    setMode(newMode);
    setEmail('');
    setPassword('');
    setSelectedUserId(null);
    setError('');
  }

  function handleUserSelect(userId: string) {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (!user) return;
    setSelectedUserId(userId);
    setEmail(user.email);
    setPassword(DEMO_PASSWORD);
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter an email address.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }

    const matchedUser = DEMO_USERS.find((u) => u.email === email.trim());
    if (!matchedUser) {
      setError('No account found with that email address.');
      return;
    }

    if (password !== DEMO_PASSWORD) {
      setError('Incorrect password. Hint: use "demo1234".');
      return;
    }

    // Verify role matches mode
    if (mode === 'citizen' && matchedUser.role !== 'resident') {
      setError('This account is an administrator. Switch to Administrator Login.');
      return;
    }
    if (mode === 'admin' && matchedUser.role !== 'admin') {
      setError('This account is a resident. Switch to Citizen Login.');
      return;
    }

    switchUser(matchedUser.id);
    navigate(matchedUser.role === 'admin' ? '/admin/review' : '/resident/dashboard');
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Branding */}
        <div className="login-brand">
          <div className="login-brand-mark">
            <Icon name="shield" size={22} />
          </div>
          <div>
            <div className="login-brand-name">CivicLens AI</div>
            <div className="login-brand-sub">Smart Civic Issue Platform</div>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'citizen' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('citizen')}
            type="button"
          >
            <Icon name="users" size={16} />
            Citizen Login
          </button>
          <button
            className={`login-tab ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('admin')}
            type="button"
          >
            <Icon name="shield" size={16} />
            Administrator Login
          </button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
                // Clear user selection if email is manually changed
                const matched = DEMO_USERS.find((u) => u.email === e.target.value);
                setSelectedUserId(matched?.id ?? null);
              }}
              placeholder="Select a user below or type an email"
              autoComplete="email"
              aria-invalid={!!error || undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                autoComplete="current-password"
                aria-invalid={!!error || undefined}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'x' : 'eye'} size={16} />
              </button>
            </div>
            <div className="hint">Demo password: <code>demo1234</code></div>
          </div>

          {error && (
            <div className="notice red" style={{ marginBottom: 14 }}>
              <span className="n-icon"><Icon name="alert-triangle" size={16} /></span>
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit">
            <Icon name="lock" size={16} />
            Sign in
          </button>
        </form>

        {/* Demo user cards */}
        <div className="login-users-section">
          <div className="login-users-label">
            <Icon name={mode === 'citizen' ? 'users' : 'shield'} size={14} />
            {mode === 'citizen' ? 'Demo Residents' : 'Demo Administrators'} — click to select
          </div>
          <div className="login-users-grid">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className={`login-user-card ${selectedUserId === user.id ? 'selected' : ''}`}
                onClick={() => handleUserSelect(user.id)}
              >
                <div className="login-user-avatar">{user.avatarInitials}</div>
                <div className="login-user-info">
                  <div className="login-user-name">{user.name}</div>
                  <div className="login-user-email">{user.email}</div>
                  {user.ward && (
                    <div className="login-user-ward">{user.ward}</div>
                  )}
                </div>
                {selectedUserId === user.id && (
                  <span className="login-user-check">
                    <Icon name="check-circle" size={18} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="notice amber login-disclaimer">
          <span className="n-icon"><Icon name="alert-triangle" size={16} /></span>
          <p>
            <strong>Fictional demo.</strong> All citizens, issues, and data shown are entirely fictional.
            No real personal data is collected. Sessions use localStorage only.
          </p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 32px 16px;
          background: linear-gradient(145deg, var(--navy-900) 0%, var(--navy-800) 40%, #132f3e 100%);
          position: relative;
          overflow: hidden;
        }
        .login-page::before {
          content: '';
          position: absolute;
          top: -40%;
          right: -20%;
          width: 700px;
          height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(20, 184, 166, 0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .login-page::after {
          content: '';
          position: absolute;
          bottom: -30%;
          left: -15%;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(20, 184, 166, 0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-container {
          width: 100%;
          max-width: 480px;
          background: var(--surface);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.06);
          padding: 32px;
          position: relative;
          z-index: 1;
        }

        /* Branding */
        .login-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .login-brand-mark {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--teal-500), var(--teal-700));
          display: grid;
          place-items: center;
          color: #fff;
          flex-shrink: 0;
        }
        .login-brand-name {
          font-size: 20px;
          font-weight: 750;
          color: var(--navy-900);
          letter-spacing: -0.02em;
        }
        .login-brand-sub {
          font-size: 12.5px;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Tabs */
        .login-tabs {
          display: flex;
          gap: 4px;
          background: var(--surface-2);
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .login-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 12px;
          font-family: var(--font);
          font-size: 13.5px;
          font-weight: 650;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }
        .login-tab:hover {
          color: var(--navy-800);
          background: rgba(255, 255, 255, 0.5);
        }
        .login-tab.active {
          background: var(--surface);
          color: var(--navy-900);
          box-shadow: 0 1px 3px rgba(14, 27, 44, 0.1), 0 0 0 1px rgba(14, 27, 44, 0.04);
        }

        /* Form */
        .login-form {
          margin-bottom: 20px;
        }

        .login-password-wrap {
          position: relative;
        }
        .login-password-wrap input {
          padding-right: 40px;
        }
        .login-password-toggle {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-faint);
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          display: grid;
          place-items: center;
        }
        .login-password-toggle:hover {
          color: var(--navy-700);
          background: var(--surface-2);
        }

        .login-submit {
          width: 100%;
          padding: 11px 16px;
          font-size: 15px;
          border-radius: 10px;
          margin-top: 4px;
        }

        /* User cards */
        .login-users-section {
          margin-bottom: 20px;
        }
        .login-users-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
          margin-bottom: 10px;
        }
        .login-users-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .login-user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          cursor: pointer;
          text-align: left;
          font-family: var(--font);
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
          position: relative;
        }
        .login-user-card:hover {
          border-color: var(--teal-400);
          background: var(--teal-50);
        }
        .login-user-card.selected {
          border-color: var(--teal-600);
          background: var(--teal-50);
          box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.18);
        }
        .login-user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--navy-700), var(--navy-500));
          color: #fff;
          font-size: 13px;
          font-weight: 750;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }
        .login-user-card.selected .login-user-avatar {
          background: linear-gradient(135deg, var(--teal-700), var(--teal-500));
        }
        .login-user-info {
          flex: 1;
          min-width: 0;
        }
        .login-user-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--navy-800);
        }
        .login-user-email {
          font-size: 12.5px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .login-user-ward {
          font-size: 11.5px;
          color: var(--text-faint);
          margin-top: 1px;
        }
        .login-user-check {
          color: var(--teal-600);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        /* Disclaimer */
        .login-disclaimer {
          margin-top: 0;
        }

        @media (max-width: 520px) {
          .login-container {
            padding: 24px 18px;
          }
          .login-tab {
            font-size: 12.5px;
            padding: 9px 8px;
          }
        }
      `}</style>
    </div>
  );
}
