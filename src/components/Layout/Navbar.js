import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="navbar navbar-expand-md navbar-matador">
      <div className="container">
        {/* Logo / brand */}
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <img
            src="https://image-cdn.carrot.com/uploads/sites/54674/2020/12/unnamed-1.jpg"
            alt="Matador"
            style={{ height: 36, objectFit: 'contain' }}
          />
          <span className="fw-bold text-white d-none d-sm-inline">Golf League</span>
        </Link>

        {/* Mobile toggle */}
        <button
          className="navbar-toggler border-secondary"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          <i className="bi bi-list text-white fs-4"></i>
        </button>

        {/* Nav links */}
        <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav ms-auto gap-1">
            <li className="nav-item">
              <Link
                className={`nav-link px-3 py-2 rounded ${isActive('/league') ? 'bg-matador-red text-white' : 'text-white'}`}
                to="/league"
                onClick={() => setMenuOpen(false)}
              >
                <i className="bi bi-trophy me-1"></i>League
              </Link>
            </li>
            <li className="nav-item">
              <Link
                className={`nav-link px-3 py-2 rounded ${isActive('/degens') ? 'bg-matador-red text-white' : 'text-white'}`}
                to="/degens"
                onClick={() => setMenuOpen(false)}
              >
                <i className="bi bi-dice-5 me-1"></i>Degens
              </Link>
            </li>
            <li className="nav-item">
              <Link
                className={`nav-link px-3 py-2 rounded ${isActive('/admin') ? 'bg-matador-red text-white' : 'text-white'}`}
                to="/admin"
                onClick={() => setMenuOpen(false)}
              >
                <i className="bi bi-gear me-1"></i>Admin
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
