import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PracticeOverview from '../components/practice/PracticeOverview';
import WeeklyLog from '../components/practice/WeeklyLog';
import RangeSessions from '../components/practice/RangeSessions';
import ShortGameSessions from '../components/practice/ShortGameSessions';
import WeeklyResults from '../components/practice/WeeklyResults';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'house' },
  { id: 'weekly', label: 'Weekly', icon: 'calendar3-week' },
  { id: 'range', label: 'Range', icon: 'dribbble' },
  { id: 'short-game', label: 'Short Game', icon: 'flag' },
  { id: 'results', label: 'Results', icon: 'graph-up' },
];

export default function Practice() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold text-matador-red mb-0">
          <i className="bi bi-golf me-2"></i>Practice
        </h4>
        <Link to="/practice/drills" className="text-muted small text-decoration-none">
          Drill library <i className="bi bi-arrow-right-short"></i>
        </Link>
      </div>

      <ul className="nav nav-pills flex-wrap gap-1 mb-4">
        {TABS.map(tab => (
          <li className="nav-item" key={tab.id}>
            <button
              className={`nav-link ${activeTab === tab.id ? 'active' : 'text-dark border'}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ minHeight: 44 }}
            >
              <i className={`bi bi-${tab.icon} me-1`}></i>{tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'overview' && <PracticeOverview />}
      {activeTab === 'weekly' && <WeeklyLog />}
      {activeTab === 'range' && <RangeSessions />}
      {activeTab === 'short-game' && <ShortGameSessions />}
      {activeTab === 'results' && <WeeklyResults />}
    </div>
  );
}
