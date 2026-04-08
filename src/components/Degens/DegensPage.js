import React from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import SkinsGame from './SkinsGame';
import WeeklyLowNet from './WeeklyLowNet';

export default function DegensPage() {
  const location = useLocation();

  const tabs = [
    { path: '/degens',         label: 'Skins Game',      icon: 'award' },
    { path: '/degens/low-net', label: 'Weekly Low Net',  icon: 'bar-chart-line' },
  ];

  return (
    <div>
      <h2 className="fw-bold text-matador-red mb-4">
        <i className="bi bi-dice-5 me-2"></i>Degens
      </h2>

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
        <Route index element={<SkinsGame />} />
        <Route path="low-net" element={<WeeklyLowNet />} />
      </Routes>
    </div>
  );
}
