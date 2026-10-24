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
      <div className="login-container page-transition">
        {/* Branding */}
        <div className="login-brand">
          <div className="login-brand-mark">
            <Icon name="shield" size={26} />
          </div>
          <div>
            <div className="login-brand-name">CivicLens AI</div>
            <div className="login-brand-sub">Smart Civic Intelligence &amp; Community Recognition</div>
          </div>
        </div>

        <div className="login-card">
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

          <div key={mode} className="tab-transition">
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
                  const matched = DEMO_USERS.find((u) => u.email === e.target.value);
                  setSelectedUserId(matched?.id ?? null);
                }}
                placeholder="Select a demo user below or enter email"
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
              <div className="login-password-hint">
                <Icon name="info" size={13} />
                <span>Demo access password: <code>demo1234</code></span>
              </div>
            </div>

            {error && (
              <div className="notice red" style={{ marginBottom: 16 }}>
                <span className="n-icon"><Icon name="alert-triangle" size={16} /></span>
                <p>{error}</p>
              </div>
            )}

            <button type="submit" className="btn btn-primary login-submit">
              <Icon name="lock" size={16} />
              Sign in to Portal
            </button>
          </form>

          {/* Demo user cards */}
          <div className="login-users-section">
            <div className="login-users-label">
              <Icon name={mode === 'citizen' ? 'users' : 'shield'} size={14} />
              <span>{mode === 'citizen' ? 'Demo Resident Accounts' : 'Demo Administrator Accounts'} — Click to auto-fill</span>
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
        </div>

          {/* Disclaimer */}
          <div className="notice amber login-disclaimer">
            <span className="n-icon"><Icon name="alert-triangle" size={16} /></span>
            <p>
              <strong>Fictional demonstration.</strong> All accounts, issues, and civic score data are demo items. No personal data is stored externally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
