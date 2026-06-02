import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { friendlyError } from '../../utils/errorUtils';
import UploadRound from './UploadRound';
import ManageTeams from './ManageTeams';
import ManagePlayers from './ManagePlayers';
import ManageSchedule from './ManageSchedule';
import ManageDegens from './ManageDegens';
import RoundLog from './RoundLog';
import ManageAdmins from './ManageAdmins';
import ManagePractice from './ManagePractice';

export default function AdminPage() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const location = useLocation();

  const INACTIVITY_MS = 4 * 60 * 60 * 1000; // 4 hours

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null;
      if (s) {
        const last = parseInt(localStorage.getItem('adminLastActivity') || '0', 10);
        if (last && Date.now() - last > INACTIVITY_MS) {
          supabase.auth.signOut();
          localStorage.removeItem('adminLastActivity');
          setSession(null);
          return;
        }
        localStorage.setItem('adminLastActivity', String(Date.now()));
      }
      setSession(s);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) localStorage.setItem('adminLastActivity', String(Date.now()));
      else localStorage.removeItem('adminLastActivity');
      setSession(s ?? null);
    });

    const updateActivity = () => {
      if (localStorage.getItem('adminLastActivity')) {
        localStorage.setItem('adminLastActivity', String(Date.now()));
      }
    };
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e) {
    e.preventDefault();
    setLoggingIn(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(friendlyError(authError));
    } else {
      if (window.PasswordCredential) {
        const cred = new window.PasswordCredential({ id: email, password });
        await navigator.credentials.store(cred);
      }
      window.location.replace('/admin');
      return;
    }
    setLoggingIn(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
  }

  // Still loading session
  if (session === undefined) {
    return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  }

  if (!session) {
    return (
      <div className="row justify-content-center">
        <div className="col-12 col-sm-8 col-md-5">
          <div className="card shadow border-0 border-matador">
            <div className="card-header bg-matador-black text-white py-3">
              <h4 className="mb-0"><i className="bi bi-lock-fill me-2"></i>Admin Login</h4>
            </div>
            <div className="card-body p-4">
              <p className="text-muted mb-3">This page is for the league admin only.</p>
              <form onSubmit={handleLogin} action="" method="post">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <button type="submit" className="btn btn-matador w-100" disabled={loggingIn}>
                  {loggingIn ? <><span className="spinner-border spinner-border-sm me-2"></span>Logging in...</> : 'Login'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { path: '/admin',          label: 'Upload Round', icon: 'cloud-upload' },
    { path: '/admin/log',      label: 'Round Log',    icon: 'journal-text' },
    { path: '/admin/teams',    label: 'Teams',        icon: 'people' },
    { path: '/admin/players',  label: 'Players',      icon: 'person' },
    { path: '/admin/schedule', label: 'Schedule',     icon: 'calendar3' },
    { path: '/admin/degens',   label: 'Degens',       icon: 'dice-5' },
    { path: '/admin/settings', label: 'Settings',     icon: 'gear' },
    { path: '/admin/practice', label: 'Practice',     icon: 'golf' },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="fw-bold text-matador-red mb-0">
          <i className="bi bi-gear-fill me-2"></i>Admin Panel
        </h2>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small"><i className="bi bi-person-circle me-1"></i>{session.user.email}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right me-1"></i>Logout
          </button>
        </div>
      </div>

      <ul className="nav nav-pills flex-wrap gap-1 mb-4">
        {tabs.map(tab => (
          <li className="nav-item" key={tab.path}>
            <Link
              className={`nav-link ${location.pathname === tab.path ? 'active' : 'text-dark border'}`}
              to={tab.path}
            >
              <i className={`bi bi-${tab.icon} me-1`}></i>{tab.label}
            </Link>
          </li>
        ))}
      </ul>

      <Routes>
        <Route index element={<UploadRound />} />
        <Route path="log" element={<RoundLog />} />
        <Route path="teams" element={<ManageTeams />} />
        <Route path="players" element={<ManagePlayers />} />
        <Route path="schedule" element={<ManageSchedule />} />
        <Route path="degens" element={<ManageDegens />} />
        <Route path="settings" element={<ManageAdmins />} />
        <Route path="practice" element={<ManagePractice />} />
      </Routes>
    </div>
  );
}
