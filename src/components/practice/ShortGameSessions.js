import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import ScoreInput from './ScoreInput';
import {
  drills as allDrills,
  getDrillById,
  isDrillPass,
  scoreSummary,
  formatDateISO,
} from '../../data/practicePlans';

const SESSION_TYPES = [
  { value: 'chipping', label: 'Chipping' },
  { value: 'putting', label: 'Putting' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'bunker', label: 'Bunker' },
];

function drillsForType(type) {
  if (type === 'chipping' || type === 'bunker') return allDrills.filter(d => d.category === 'chipping');
  if (type === 'putting') return allDrills.filter(d => d.category === 'putting');
  if (type === 'mixed') return allDrills.filter(d => d.category === 'chipping' || d.category === 'putting');
  return [];
}

function pickRandomDrill(type, excludeId = null) {
  const available = drillsForType(type);
  if (available.length === 0) return '';
  const pool = available.length > 1 ? available.filter(d => d.id !== excludeId) : available;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function emptyForm() {
  return {
    session_date: formatDateISO(new Date()),
    session_type: 'chipping',
    drill: '',
    score: null,
    session_feel: null,
    notes: '',
  };
}

export default function ShortGameSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(null);
  const [manualPick, setManualPick] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('practice_short_game_sessions')
      .select('*')
      .eq('user_id', 'primary')
      .order('session_date', { ascending: false });
    setSessions(data || []);
    setLoading(false);
  }

  const shuffle = useCallback((type, currentId = null) => {
    const drillId = pickRandomDrill(type, currentId);
    setForm(f => ({ ...f, drill: drillId, score: null }));
  }, []);

  function openForm() {
    const type = 'chipping';
    const drillId = pickRandomDrill(type);
    setForm({ ...emptyForm(), drill: drillId });
    setManualPick(false);
    setMessage(null);
    setShowForm(true);
  }

  function handleTypeChange(type) {
    const drillId = pickRandomDrill(type);
    setForm(f => ({ ...f, session_type: type, drill: drillId, score: null }));
    setManualPick(false);
  }

  function handleDrillChange(drillId) {
    setForm(f => ({ ...f, drill: drillId, score: null }));
  }

  async function saveSession() {
    if (!form.session_date) {
      setMessage({ type: 'error', text: 'Please select a date.' });
      return;
    }
    if (!form.drill) {
      setMessage({ type: 'error', text: 'Please select a drill.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('practice_short_game_sessions').insert({
      user_id: 'primary',
      session_date: form.session_date,
      session_type: form.session_type,
      drill: form.drill,
      score: form.score || null,
      session_feel: form.session_feel || null,
      notes: form.notes || null,
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setShowForm(false);
      setForm(null);
      fetchData();
    }
    setSaving(false);
  }

  async function deleteSession(id) {
    if (!window.confirm('Delete this session?')) return;
    await supabase.from('practice_short_game_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  if (loading) {
    return <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>;
  }

  const availableDrills = form ? drillsForType(form.session_type) : [];
  const selectedDrill = form ? getDrillById(form.drill) : null;

  return (
    <div>
      {!showForm && (
        <button className="btn btn-matador w-100 mb-4" style={{ minHeight: 48 }} onClick={openForm}>
          <i className="bi bi-plus-circle me-2"></i>Log Short Game Session
        </button>
      )}

      {showForm && form && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-matador-black text-white d-flex justify-content-between">
            <span><i className="bi bi-pencil-square me-2"></i>Log Short Game Session</span>
            <button className="btn-close btn-close-white" onClick={() => setShowForm(false)}></button>
          </div>
          <div className="card-body">
            {/* Session type */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Session Type</label>
              <div className="d-flex gap-2 flex-wrap">
                {SESSION_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`btn ${form.session_type === t.value ? 'btn-matador' : 'btn-outline-secondary'}`}
                    style={{ minHeight: 44 }}
                    onClick={() => handleTypeChange(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drill selector */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label fw-semibold mb-0">Drill</label>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-muted"
                  onClick={() => setManualPick(m => !m)}
                >
                  {manualPick ? 'random' : 'pick manually'}
                </button>
              </div>

              {!manualPick ? (
                <div className="d-flex gap-2 align-items-center">
                  <div className="flex-grow-1 border rounded px-3 py-2 bg-light fw-semibold" style={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>
                    {selectedDrill?.name || '—'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    style={{ minHeight: 48, minWidth: 48 }}
                    title="Shuffle drill"
                    onClick={() => shuffle(form.session_type, form.drill)}
                  >
                    <i className="bi bi-shuffle"></i>
                  </button>
                </div>
              ) : (
                <select
                  className="form-select form-select-lg"
                  value={form.drill}
                  onChange={e => handleDrillChange(e.target.value)}
                >
                  <option value="">Select drill…</option>
                  {availableDrills.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>

            {selectedDrill && (
              <div className="mb-4">
                <div className="text-muted small mb-3">{selectedDrill.objective}</div>
                <ScoreInput
                  drill={selectedDrill}
                  score={form.score}
                  onChange={s => setForm(f => ({ ...f, score: s }))}
                />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-semibold">Date</label>
              <input
                type="date"
                className="form-control form-control-lg"
                value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Session Feel</label>
              <div className="d-flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`btn rounded-circle fw-bold ${form.session_feel === n ? 'btn-matador' : 'btn-outline-secondary'}`}
                    style={{ width: 48, height: 48, padding: 0 }}
                    onClick={() => setForm(f => ({ ...f, session_feel: n }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">Notes</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Optional notes…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {message && (
              <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
                {message.text}
              </div>
            )}

            <div className="d-flex gap-2">
              <button
                className="btn btn-matador flex-fill"
                style={{ minHeight: 48 }}
                onClick={saveSession}
                disabled={saving}
              >
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</> : 'Save Session'}
              </button>
              <button
                className="btn btn-outline-secondary"
                style={{ minHeight: 48 }}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session history */}
      <h6 className="fw-bold text-muted mb-3">Session History</h6>
      {sessions.length === 0 ? (
        <p className="text-muted small">No short game sessions logged yet.</p>
      ) : (
        sessions.map(s => {
          const drill = getDrillById(s.drill);
          const pass = isDrillPass(drill, s.score);
          const typeLabel = SESSION_TYPES.find(t => t.value === s.session_type)?.label || s.session_type;
          return (
            <div key={s.id} className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <div>
                  <span className="fw-semibold me-2">{formatDisplayDate(s.session_date)}</span>
                  <span className="badge bg-secondary me-1">{typeLabel}</span>
                  {pass !== null && (
                    <span className={`badge ${pass ? 'bg-success' : 'bg-danger'}`}>
                      {pass ? 'Pass' : 'Fail'}
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => deleteSession(s.id)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
              {drill && (
                <div className="card-body py-2 px-3">
                  <div className="fw-semibold small mb-1">{drill.name}</div>
                  {s.score && (
                    <div className="text-muted small">{scoreSummary(drill, s.score)}</div>
                  )}
                  <div className="d-flex gap-3 mt-1 small text-muted flex-wrap">
                    {s.session_feel && <span>Feel: {s.session_feel}/5</span>}
                  </div>
                  {s.notes && <div className="small text-muted mt-1 fst-italic">{s.notes}</div>}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
