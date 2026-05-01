import React from 'react';
import { isDrillPass } from '../../data/practicePlans';

export default function ScoreInput({ drill, score, onChange }) {
  if (!drill) return null;

  const pass = isDrillPass(drill, score);

  function update(fields) {
    onChange({ ...(score || {}), ...fields });
  }

  return (
    <div>
      {drill.scoringType === 'rating' && (
        <div>
          <label className="form-label small fw-semibold mb-1">Rating (1.0 – 5.0)</label>
          <input
            type="number"
            className="form-control form-control-lg"
            min="1"
            max="5"
            step="0.1"
            placeholder="e.g. 3.5"
            value={score?.value ?? ''}
            onChange={e => update({ value: e.target.value === '' ? null : parseFloat(e.target.value) })}
          />
          {drill.passThreshold != null && (
            <div className="text-muted small mt-1">Pass threshold: avg ≥ {drill.passThreshold}</div>
          )}
        </div>
      )}

      {drill.scoringType === 'percent' && (
        <div className="d-flex flex-column gap-2">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-semibold mb-1">Made</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.made ?? ''}
                onChange={e => update({ made: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-semibold mb-1">Total</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.total ?? ''}
                onChange={e => update({ total: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
          {score?.total > 0 && score?.made != null && (
            <div className="text-muted small">
              {Math.round(score.made / score.total * 100)}%
            </div>
          )}
          <div className="text-muted small">Pass threshold: ≥ {drill.passThreshold}%</div>
        </div>
      )}

      {drill.scoringType === 'fraction' && (
        <div className="d-flex flex-column gap-2">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small fw-semibold mb-1">Made</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.made ?? ''}
                onChange={e => update({ made: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-semibold mb-1">Total</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.total ?? ''}
                onChange={e => update({ total: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
          {score?.made != null && score?.total != null && (
            <div className="text-muted small">{score.made}/{score.total}</div>
          )}
          <div className="text-muted small">
            Pass threshold: ≥{' '}
            {drill.totalTarget
              ? `${drill.passThreshold}/${drill.totalTarget}`
              : `${drill.passThreshold} made`}
          </div>
        </div>
      )}

      {drill.scoringType === 'count' && (
        <div>
          <label className="form-label small fw-semibold mb-1">Count</label>
          <input
            type="number"
            className="form-control form-control-lg"
            min="0"
            placeholder="0"
            value={score?.value ?? ''}
            onChange={e => update({ value: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
          />
          <div className="text-muted small mt-1">Pass threshold: ≤ {drill.passThreshold}</div>
        </div>
      )}

      {drill.scoringType === 'level' && (
        <div className="d-flex flex-column gap-2">
          <label className="form-label small fw-semibold mb-1">Result</label>
          <div className="d-flex gap-2 flex-wrap">
            {[
              { value: 'fail', label: 'Fail' },
              { value: 'pass1', label: 'Pass Level 1' },
              { value: 'pass2', label: 'Pass Level 2' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`btn ${score?.level === opt.value
                  ? opt.value === 'fail' ? 'btn-danger' : 'btn-success'
                  : 'btn-outline-secondary'}`}
                style={{ minHeight: 44 }}
                onClick={() => update({ level: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {drill.scoringType === 'putt_distribution' && (
        <div className="d-flex flex-column gap-2">
          <div className="row g-2">
            <div className="col-4">
              <label className="form-label small fw-semibold mb-1">1-putts</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.one ?? ''}
                onChange={e => update({ one: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="col-4">
              <label className="form-label small fw-semibold mb-1">2-putts</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.two ?? ''}
                onChange={e => update({ two: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="col-4">
              <label className="form-label small fw-semibold mb-1">3+ putts</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                placeholder="0"
                value={score?.three ?? ''}
                onChange={e => update({ three: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
          <div className="text-muted small">Pass threshold: 0 three-putts</div>
        </div>
      )}

      {pass !== null && (
        <div className="mt-2">
          <span className={`badge ${pass ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.85rem' }}>
            {pass ? 'Pass' : 'Fail'}
          </span>
        </div>
      )}
    </div>
  );
}
