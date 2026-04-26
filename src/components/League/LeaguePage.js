import React from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import LeagueStandings from './LeagueStandings';
import MatchResults from './MatchResults';
import PlayerLeaderboards from './PlayerLeaderboards';
import LeagueSchedule from './LeagueSchedule';

export default function LeaguePage() {
  const location = useLocation();

  const tabs = [
    { path: '/league',             label: 'Standings',     icon: 'trophy' },
    { path: '/league/matches',     label: 'Match Results', icon: 'people-fill' },
    { path: '/league/leaderboards',label: 'Leaderboards',  icon: 'bar-chart-line' },
    { path: '/league/schedule',    label: 'Schedule',      icon: 'calendar3' },
  ];

  return (
    <div>
      <h2 className="fw-bold text-matador-red mb-4">
        <i className="bi bi-trophy me-2"></i>League
      </h2>

      <ul className="nav nav-pills flex-wrap gap-1 mb-4" style={{ overflowX: 'auto', flexWrap: 'wrap' }}>
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
        <Route index element={<LeagueStandings />} />
        <Route path="matches" element={<MatchResults />} />
        <Route path="leaderboards" element={<PlayerLeaderboards />} />
        <Route path="schedule" element={<LeagueSchedule />} />
      </Routes>
    </div>
  );
}
