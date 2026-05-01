import React, { useState } from 'react';
import { drills, getPassBadgeText } from '../data/practicePlans';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'warmup', label: 'Warmup' },
  { id: 'wedges', label: 'Wedges' },
  { id: 'irons', label: 'Irons' },
  { id: 'driver', label: 'Driver' },
  { id: 'chipping', label: 'Chipping' },
  { id: 'putting', label: 'Putting' },
];

const CATEGORY_LABELS = {
  warmup: 'Warmup',
  wedges: 'Wedges',
  irons: 'Irons',
  driver: 'Driver',
  chipping: 'Chipping',
  putting: 'Putting',
};

const CATEGORY_ORDER = ['warmup', 'wedges', 'irons', 'driver', 'chipping', 'putting'];

const CATEGORY_COLORS = {
  warmup: 'bg-warning text-dark',
  wedges: 'bg-info text-dark',
  irons: 'bg-primary text-white',
  driver: 'bg-danger text-white',
  chipping: 'bg-success text-white',
  putting: 'bg-secondary text-white',
};

export default function PracticeDrills() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = activeFilter === 'all'
    ? drills
    : drills.filter(d => d.category === activeFilter);

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = filtered.filter(d => d.category === cat);
    if (items.length > 0) acc.push({ cat, items });
    return acc;
  }, []);

  function toggleDrill(id) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold text-matador-red mb-0">
          <i className="bi bi-journal-bookmark me-2"></i>Drill Library
        </h4>
        <span className="text-muted small">{filtered.length} drills</span>
      </div>

      {/* Filter pills — horizontal scroll */}
      <div
        className="d-flex gap-2 mb-4"
        style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}
      >
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`btn btn-sm flex-shrink-0 ${activeFilter === f.id ? 'btn-matador' : 'btn-outline-secondary'}`}
            style={{ minHeight: 40, whiteSpace: 'nowrap' }}
            onClick={() => {
              setActiveFilter(f.id);
              setExpandedId(null);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {grouped.map(({ cat, items }) => (
        <div key={cat} className="mb-4">
          <h6 className="fw-bold text-muted text-uppercase mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            {CATEGORY_LABELS[cat]}
          </h6>
          {items.map(drill => {
            const isExpanded = expandedId === drill.id;
            const passBadge = getPassBadgeText(drill);
            return (
              <div
                key={drill.id}
                className="card border-0 shadow-sm mb-2"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleDrill(drill.id)}
              >
                <div className="card-body py-3 px-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1 me-2">
                      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <span className="fw-bold">{drill.name}</span>
                        <span className={`badge ${CATEGORY_COLORS[drill.category]}`} style={{ fontSize: '0.7rem' }}>
                          {CATEGORY_LABELS[drill.category]}
                        </span>
                      </div>
                      <div className="text-muted small mb-1">{drill.objective}</div>
                      {passBadge && (
                        <span className="badge border text-dark" style={{ fontSize: '0.7rem' }}>{passBadge}</span>
                      )}
                    </div>
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted flex-shrink-0`}></i>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-top" onClick={e => e.stopPropagation()}>
                      <div className="mb-3">
                        <div className="fw-semibold small mb-1">How to execute</div>
                        <p className="small text-dark mb-0">{drill.description}</p>
                      </div>

                      {drill.advice && (
                        <div className="mb-3">
                          <div className="fw-semibold small mb-1">Tip</div>
                          <p className="small text-muted mb-0">{drill.advice}</p>
                        </div>
                      )}

                      <div className="mb-3">
                        <div className="fw-semibold small mb-1">What to track</div>
                        <p className="small text-muted mb-0">{drill.trackingNote}</p>
                      </div>

                      {passBadge && (
                        <div className="alert alert-light py-2 mb-0">
                          <i className="bi bi-check2-circle me-1 text-success"></i>
                          <span className="small fw-semibold">{passBadge}</span>
                        </div>
                      )}

                      <button
                        className="btn btn-link btn-sm text-muted p-0 mt-2"
                        onClick={() => setExpandedId(null)}
                      >
                        Collapse
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-muted">No drills found.</p>
      )}
    </div>
  );
}
