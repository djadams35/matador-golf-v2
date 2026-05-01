import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import ScoreInput from './ScoreInput';
import {
  monthPlans,
  getDrillById,
  getDrillsByCategory,
  isDrillPass,
  scoreSummary,
  formatDateISO,
} from '../../data/practicePlans';

const SECTIONS = [
  { key: 'warmup', label: 'Warmup', category: 'warmup' },
  { key: 'wedge', label: 'Wedges', category: 'wedges' },
  { key: 'iron', label: 'Irons', category: 'irons' },
  { key: 'driver', label: 'Driver', category: 'driver' },
];

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function emptyForm(planNum, planConfig, activePlan) {
  const num = planNum || activePlan || 1;
  const plan = planConfig[num] || monthPlans[num] || monthPlans[1];
  return {
    month_plan: num,
    session_date: formatDateISO(new Date()),
    warmup_drill: plan.warmupDrillId,
    warmup_score: null,
    wedge_drill: plan.wedgeDrillId,
    wedge_score: null,
    iron_drill: plan.ironDrillId,
    iron_score: null,
    driver_drill: plan.driverDrillId,
    driver_score: null,
    driver_fairways_pct: '',
    session_feel: null,
    notes: '',
  };
}

export default function RangeSessions() {
  const [sessions, setSessions] = useState([]);
  const [planConfig, setPlanConfig] = useState({});
  const [activePlan, setActivePlan] = useState(1);
  const [summaryPlan, setSummaryPlan] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    const [configRes, settingsRes, sessionsRes] = await Promise.all([
      supabase.from('practice_plan_config').select('*'),
      supabase.from('practice_settings').select('setting_key, setting_value')
        .in('setting_key', ['active_month_plan']),
      supabase.from('practice_range_sessions')
        .select('*')
        .eq('user_id', 'primary')
        .order('session_date', { ascending: false }),
    ]);

    const config = {};
    (configRes.data || []).forEach(row => {
      config[row.plan_number] = {
        name: row.plan_name,
        warmupDrillId: row.warmup_drill_id,
        wedgeDrillId: row.wedge_drill_id,
        ironDrillId: row.iron_drill_id,
        driverDrillId: row.driver_drill_id,
      };
    });
    setPlanConfig(config);

    let active = 1;
    (settingsRes.data || []).forEach(s => {
      if (s.setting_key === 'active_month_plan') active = s.setting_value;
    });
    setActivePlan(active);
    setSummaryPlan(active);
    setSessions(sessionsRes.data || []);
    setLoading(false);
  }

  function getResolvedPlan(planNum) {
    return planConfig[planNum] || monthPlans[planNum] || monthPlans[1];
  }

  function openForm() {
    setForm(emptyForm(activePlan, planConfig, activePlan));
    setOverrides({});
    setMessage(null);
    setShowForm(true);
  }

  function handlePlanChange(num) {
    const plan = getResolvedPlan(num);
    setForm(f => ({
      ...f,
      month_plan: num,
      warmup_drill: overrides.warmup ? f.warmup_drill : plan.warmupDrillId,
      wedge_drill: overrides.wedge ? f.wedge_drill : plan.wedgeDrillId,
      iron_drill: overrides.iron ? f.iron_drill : plan.ironDrillId,
      driver_drill: overrides.driver ? f.driver_drill : plan.driverDrillId,
    }));
  }

  function setScore(section, score) {
    setForm(f => ({ ...f, [`${section}_score`]: score }));
  }

  function setDrillOverride(section, drillId) {
    setForm(f => ({ ...f, [`${section}_drill`]: drillId, [`${section}_score`]: null }));
  }

  async function saveSession() {
    if (!form.session_date) {
      setMessage({ type: 'error', text: 'Please select a date.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('practice_range_sessions').insert({
      user_id: 'primary',
      session_date: form.session_date,
      month_plan: form.month_plan,
      warmup_drill: form.warmup_drill || null,
      warmup_score: form.warmup_score || null,
      wedge_drill: form.wedge_drill || null,
      wedge_score: form.wedge_score || null,
      iron_drill: form.iron_drill || null,
      iron_score: form.iron_score || null,
      driver_drill: form.driver_drill || null,
      driver_score: form.driver_score || null,
      driver_fairways_pct: form.driver_fairways_pct !== '' ? parseInt(form.driver_fairways_pct, 10) : null,
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
    await supabase.from('practice_range_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  function getSummaryStats(planNum) {
    const plan = getResolvedPlan(planNum);
    const planSessions = sessions.filter(s => s.month_plan === planNum);
    return SECTIONS.filter(sec => sec.key !== 'warmup').map(sec => {
      const drillId = plan[`${sec.key}DrillId`];
      const drill = getDrillById(drillId);
      if (!drill) return null;
      const matching = planSessions.filter(s => s[`${sec.key}_drill`] === drillId && s[`${sec.key}_score`]);
      const passed = matching.filter(s => isDrillPass(drill, s[`${sec.key}_score`])).length;
      return { label: sec.label, drillName: drill.name, passed, total: matching.length };
    }).filter(Boolean);
  }

  const summaryStats = getSummaryStats(summaryPlan);

  if (loading) {
    return <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>;
  }

  return (
    <div>
      {/* Monthly summary */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center">
          <span><i className="bi bi-bar-chart me-2"></i>Plan Summary</span>
          <select
            className="form-select form-select-sm w-auto text-white border-0"
            style={{ background: 'transparent', color: 'white' }}
            value={summaryPlan}
            onChange={e => setSummaryPlan(parseInt(e.target.value, 10))}
          >
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n} style={{ color: '#000' }}>
                Month {n} — {(planConfig[n] || monthPlans[n])?.name}
              </option>
            ))}
          </select>
        </div>
        <div className="card-body">
          {summaryStats.length === 0 ? (
            <p className="text-muted small mb-0">No sessions logged for this plan yet.</p>
          ) : (
            summaryStats.map((stat, i) => (
              <div key={i} className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span>
                    <span className="text-muted me-1">{stat.label}:</span>
                    <span className="fw-semibold">{stat.drillName}</span>
                  </span>
                  <span className={stat.total === 0 ? 'text-muted' : stat.passed === stat.total ? 'text-success fw-bold' : 'text-dark'}>
                    {stat.passed}/{stat.total} passed
                  </span>
                </div>
                {stat.total > 0 && (
                  <div className="progress" style={{ height: 6 }}>
                    <div
                      className={`progress-bar ${stat.passed === stat.total ? 'bg-success' : 'bg-secondary'}`}
                      style={{ width: `${Math.round(stat.passed / stat.total * 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Log session button */}
      {!showForm && (
        <button className="btn btn-matador w-100 mb-4" style={{ minHeight: 48 }} onClick={openForm}>
          <i className="bi bi-plus-circle me-2"></i>Log Range Session
        </button>
      )}

      {/* Session form */}
      {showForm && form && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-matador-black text-white d-flex justify-content-between">
            <span><i className="bi bi-pencil-square me-2"></i>Log Range Session</span>
            <button className="btn-close btn-close-white" onClick={() => setShowForm(false)}></button>
          </div>
          <div className="card-body">
            {/* Month plan selector */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Month Plan</label>
              <div className="d-flex gap-2 flex-wrap">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`btn ${form.month_plan === n ? 'btn-matador' : 'btn-outline-secondary'}`}
                    style={{ minHeight: 44 }}
                    onClick={() => handlePlanChange(n)}
                  >
                    Month {n}
                  </button>
                ))}
              </div>
              <div className="text-muted small mt-1">
                {(planConfig[form.month_plan] || monthPlans[form.month_plan])?.name}
              </div>
            </div>

            {/* Drill sections */}
            {SECTIONS.map(sec => {
              const drillId = form[`${sec.key}_drill`];
              const drill = getDrillById(drillId);
              const score = form[`${sec.key}_score`];
              const isOverride = overrides[sec.key];
              return (
                <div key={sec.key} className="mb-4 pb-4 border-bottom">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="fw-bold">{sec.label}</div>
                    {!isOverride ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted"
                        onClick={() => setOverrides(o => ({ ...o, [sec.key]: true }))}
                      >
                        override
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted"
                        onClick={() => {
                          setOverrides(o => ({ ...o, [sec.key]: false }));
                          const plan = getResolvedPlan(form.month_plan);
                          setDrillOverride(sec.key, plan[`${sec.key}DrillId`]);
                        }}
                      >
                        reset
                      </button>
                    )}
                  </div>

                  {isOverride ? (
                    <div className="mb-2">
                      <select
                        className="form-select form-select-lg"
                        value={drillId || ''}
                        onChange={e => setDrillOverride(sec.key, e.target.value)}
                      >
                        <option value="">Select drill…</option>
                        {getDrillsByCategory(sec.category).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="fw-semibold mb-1">{drill?.name || '—'}</div>
                  )}

                  {drill && (
                    <div className="text-muted small mb-3">{drill.objective}</div>
                  )}

                  {drill && sec.key !== 'warmup' && (
                    <ScoreInput
                      drill={drill}
                      score={score}
                      onChange={s => setScore(sec.key, s)}
                    />
                  )}
                </div>
              );
            })}

            {/* Session details */}
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
              <label className="form-label fw-semibold">Driver Fairways %</label>
              <input
                type="number"
                className="form-control form-control-lg"
                min="0"
                max="100"
                placeholder="e.g. 72"
                value={form.driver_fairways_pct}
                onChange={e => setForm(f => ({ ...f, driver_fairways_pct: e.target.value }))}
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
        <p className="text-muted small">No range sessions logged yet.</p>
      ) : (
        sessions.map(s => {
          const scorableSections = SECTIONS.filter(sec => sec.key !== 'warmup');
          const passCount = scorableSections.reduce((acc, sec) => {
            const drill = getDrillById(s[`${sec.key}_drill`]);
            const score = s[`${sec.key}_score`];
            if (drill && score && isDrillPass(drill, score)) return acc + 1;
            return acc;
          }, 0);
          const scoredCount = scorableSections.filter(sec => {
            const drill = getDrillById(s[`${sec.key}_drill`]);
            return drill && s[`${sec.key}_score`];
          }).length;
          const planName = (planConfig[s.month_plan] || monthPlans[s.month_plan])?.name || `Month ${s.month_plan}`;

          return (
            <div key={s.id} className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <div>
                  <span className="fw-semibold me-2">{formatDisplayDate(s.session_date)}</span>
                  <span className="badge bg-secondary me-1">Month {s.month_plan}</span>
                  {scoredCount > 0 && (
                    <span className={`badge ${passCount === scoredCount ? 'bg-success' : passCount > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                      {passCount}/{scoredCount} Pass
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
              <div className="card-body py-2 px-3">
                <div className="text-muted small mb-1">{planName}</div>
                {SECTIONS.map(sec => {
                  const drill = getDrillById(s[`${sec.key}_drill`]);
                  const score = s[`${sec.key}_score`];
                  if (!drill) return null;
                  const isWarmup = sec.key === 'warmup';
                  const pass = isWarmup ? null : isDrillPass(drill, score);
                  return (
                    <div key={sec.key} className="d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <span className="text-muted small me-1">{sec.label}:</span>
                        <span className="small">{drill.name}</span>
                        {!isWarmup && score && <span className="text-muted small ms-2">{scoreSummary(drill, score)}</span>}
                      </div>
                      {pass !== null && (
                        <span className={`badge ${pass ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                          {pass ? 'Pass' : 'Fail'}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="d-flex gap-3 mt-2 small text-muted flex-wrap">
                  {s.driver_fairways_pct != null && <span>Fairways: {s.driver_fairways_pct}%</span>}
                  {s.session_feel && <span>Feel: {s.session_feel}/5</span>}
                </div>
                {s.notes && <div className="small text-muted mt-1 fst-italic">{s.notes}</div>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
