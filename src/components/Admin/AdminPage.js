import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import UploadRound from './UploadRound';
import ManageTeams from './ManageTeams';
import ManagePlayers from './ManagePlayers';
import ManageSchedule from './ManageSchedule';
import ManageDegens from './ManageDegens';
import RoundLog from './RoundLog';

// The admin password is hardcoded here (never stored in the database).
// To change it, edit this file and redeploy.
const ADMIN_PASSWORD = 'matador2025';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('adminAuth') === 'true'
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();

  function handleLogin(e) {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      setAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password.');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('adminAuth');
    setAuthenticated(false);
  }

  if (!authenticated) {
    return (
      <div className="row justify-content-center">
        <div className="col-12 col-sm-8 col-md-5">
          <div className="card shadow border-0 border-matador">
            <div className="card-header bg-matador-black text-white py-3">
              <h4 className="mb-0"><i className="bi bi-lock-fill me-2"></i>Admin Login</h4>
            </div>
            <div className="card-body p-4">
              <p className="text-muted mb-3">This page is for the league admin only.</p>
              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    autoFocus
                  />
                </div>
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <button type="submit" className="btn btn-matador w-100">
                  Login
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { path: '/admin',          label: 'Upload Round',   icon: 'cloud-upload' },
    { path: '/admin/log',      label: 'Round Log',      icon: 'journal-text' },
    { path: '/admin/teams',    label: 'Teams',          icon: 'people' },
    { path: '/admin/players',  label: 'Players',        icon: 'person' },
    { path: '/admin/schedule', label: 'Schedule',       icon: 'calendar3' },
    { path: '/admin/degens',   label: 'Degens',         icon: 'dice-5' },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="fw-bold text-matador-red mb-0">
          <i className="bi bi-gear-fill me-2"></i>Admin Panel
        </h2>
        <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right me-1"></i>Logout
        </button>
      </div>

      {/* Tab navigation */}
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
      </Routes>
    </div>
  );
}
