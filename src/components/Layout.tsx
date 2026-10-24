import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { getCurrentUser, listAllUsers, switchUser, logout } from '../services/auth';
import { listNotifications, markAllRead, markRead, unreadCount } from '../services/notifications';
import { storageMode } from '../lib/store';
import { useAppVersion } from '../lib/hooks';
import { getValidations } from '../services/validations';
import { getFlagsRaw } from '../services/db';
import { timeAgo } from '../lib/format';
import { Icon } from './Icon';
import { pushToast, subscribeToasts, dismissToast, getToasts } from '../lib/toast';

/* ---------------------------------- toaster ---------------------------------- */

export function Toaster() {
  const [, setV] = useState(0);
  useEffect(() => subscribeToasts(() => setV((x) => x + 1)), []);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {getToasts().map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span aria-hidden="true">
            <Icon name={t.tone === 'warning' ? 'alert-triangle' : t.tone === 'info' ? 'info' : 'check-circle'} size={16} />
          </span>
          <span>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

void pushToast;

/* ------------------------------ notification bell ---------------------------- */

function NotificationBell({ user }: { user: User }) {
  useAppVersion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const items = listNotifications(user.id);
  const unread = unreadCount(user.id);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        className="bell-btn"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <h3>Notifications</h3>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => markAllRead(user.id)}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 && <div className="empty" style={{ padding: 22 }}>No notifications yet.</div>}
            {items.slice(0, 12).map((n) => (
              <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`}>
                <span className="n-dot" aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 13.5 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {timeAgo(n.createdAt)}
                    {n.link && (
                      <>
                        {' · '}
                        <Link to={n.link} onClick={() => { markRead(n.id); setOpen(false); }}>
                          Open
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- layout ----------------------------------- */

const RESIDENT_NAV = [
  { to: '/resident/dashboard', label: 'Dashboard', icon: 'home', end: true },
  { to: '/resident/issues', label: 'Issues', icon: 'flag' },
  { to: '/resident/issues/new', label: 'Report an issue', icon: 'plus', end: true },
  { to: '/resident/civic-score', label: 'Civic Score', icon: 'award' },
  { to: '/resident/community', label: 'Community recognition', icon: 'users' },
  { to: '/resident/profile', label: 'My profile', icon: 'user' },
];

const ADMIN_NAV = [
  { to: '/admin/review', label: 'Review console', icon: 'shield' },
  { to: '/admin/civic-score', label: 'Score settings', icon: 'settings' },
];

export function Layout() {
  useAppVersion();
  const user = getCurrentUser();
  const users = listAllUsers();
  const location = useLocation();
  const navigate = useNavigate();
  const mode = storageMode();
  const isAdmin = user.role === 'admin';
  const pendingValidations = isAdmin ? getValidations('pending').length : 0;
  const openFlags = isAdmin ? getFlagsRaw().filter((f) => f.status === 'open').length : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Icon name="eye" size={19} /></span>
          <span>
            <span className="brand-name">CivicLens AI</span>
            <br />
            <span className="brand-sub">Civic Score &amp; Recognition</span>
          </span>
        </div>
        <span className="demo-chip">Fictional demo</span>

        <nav className="nav-section" aria-label="Resident navigation">
          <div className="nav-label">Resident</div>
          {RESIDENT_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nl-icon"><Icon name={item.icon} size={16} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <nav className="nav-section" aria-label="Administrator navigation">
          <div className="nav-label">Administrator</div>
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nl-icon"><Icon name={item.icon} size={16} /></span>
              {item.label}
              {item.to === '/admin/review' && pendingValidations + openFlags > 0 && (
                <span className="nav-badge">{pendingValidations + openFlags}</span>
              )}
            </NavLink>
          ))}
          {!isAdmin && (
            <div style={{ padding: '2px 10px 6px', fontSize: 11.5, color: 'var(--navy-300)' }}>
              Switch to Meera Iyer to access admin tools.
            </div>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="storage-line">
            <span className="storage-dot" aria-hidden="true" />
            Prototype storage: {mode === 'local' ? 'this browser (localStorage)' : 'in-memory (preview)'}
          </div>
          <div>All people, issues and scores are fictional demo data.</div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <span className="crumb" aria-hidden="true">
            {location.pathname.startsWith('/admin') ? 'Admin console' : 'Resident portal'}
          </span>
          <div className="topbar-actions">
            <NotificationBell user={user} />
            <div className="user-switch">
              <label className="sr-only" htmlFor="user-switcher">Signed in as</label>
              <select
                id="user-switcher"
                value={user.id}
                onChange={(e) => {
                  switchUser(e.target.value);
                  pushToast(`Switched demo session to ${users.find((u) => u.id === e.target.value)?.name ?? 'user'}`, 'info');
                }}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role === 'admin' ? '(admin)' : ''}
                  </option>
                ))}
              </select>
              <span className={`role-chip ${user.role}`}>{user.role}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate('/login');
                  pushToast('Signed out', 'info');
                }}
                aria-label="Sign out"
                style={{ marginLeft: 4 }}
              >
                <Icon name="lock" size={14} /> Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="page" id="main">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
