import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  monthPlans,
  defaultHabitCategories,
  getDrillsByCategory,
  getDrillById,
  getPassBadgeText,
} from '../../data/practicePlans';

const DRILL_SLOTS = [
  { key: 'warmup', label: 'Warmup', category: 'warmup' },
  { key: 'wedge', label: 'Wedges', category: 'wedges' },
  { key: 'iron', label: 'Irons', category: 'irons' },
  { key: 'driver', label: 'Driver', category: 'driver' },
];

export default function ManagePractice() {
  const [categories, setCategories] = useState(defaultHabitCategories);
  const [planConfigs, setPlanConfigs] = useState({});
  const [activePlan, setActivePlan] = useState(1);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    const [settingsRes, planRes] = await Promise.all([
      supabase.from('practice_settings').select('setting_key, setting_value'),
      supabase.from('practice_plan_config').select('*'),
    ]);

    const settingsData = settingsRes.data || [];
    settingsData.forEach(s => {
      if (s.setting_key === 'habit_categories') setCategories(s.setting_value);
      if (s.setting_key === 'active_month_plan') setActivePlan(s.setting_value);
    });

    const configs = {};
    (planRes.data || []).forEach(row => {
      configs[row.plan_number] = {
        plan_name: row.plan_name || monthPlans[row.plan_number]?.name || `Month ${row.plan_number}`,
        warmup_drill_id: row.warmup_drill_id || monthPlans[row.plan_number]?.warmupDrillId || '',
        wedge_drill_id: row.wedge_drill_id || monthPlans[row.plan_number]?.wedgeDrillId || '',
        iron_drill_id: row.iron_drill_id || monthPlans[row.plan_number]?.ironDrillId || '',
        driver_drill_id: row.driver_drill_id || monthPlans[row.plan_number]?.driverDrillId || '',
      };
    });
    // Fill in defaults for plans without DB rows
    [1, 2, 3, 4].forEach(n => {
      if (!configs[n]) {
        configs[n] = {
          plan_name: monthPlans[n]?.name || `Month ${n}`,
          warmup_drill_id: monthPlans[n]?.warmupDrillId || '',
          wedge_drill_id: monthPlans[n]?.wedgeDrillId || '',
          iron_drill_id: monthPlans[n]?.ironDrillId || '',
          driver_drill_id: monthPlans[n]?.driverDrillId || '',
        };
      }
    });
    setPlanConfigs(configs);
    setLoading(false);
  }

  // ── Habit Categories ─────────────────────────────────────────────────────────

  async function saveCategories() {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('practice_settings').upsert(
      { setting_key: 'habit_categories', setting_value: categories, updated_at: new Date().toISOString() },
      { onConflict: 'setting_key' }
    );
    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: 'Habit categories saved.' });
    setSaving(false);
  }

  function addCategory() {
    setCategories(prev => [...prev, { id: `cat_${Date.now()}`, name: '', goal: 1 }]);
  }

  function updateCategory(idx, field, value) {
    setCategories(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function deleteCategory(idx) {
    if (!window.confirm('Remove this category? Historical check-in data is preserved.')) return;
    setCategories(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Plan Config ──────────────────────────────────────────────────────────────

  function updatePlanField(planNum, field, value) {
    setPlanConfigs(prev => ({
      ...prev,
      [planNum]: { ...prev[planNum], [field]: value },
    }));
  }

  async function savePlan(planNum) {
    setSaving(true);
    setMessage(null);
    const cfg = planConfigs[planNum];
    const { error } = await supabase.from('practice_plan_config').upsert(
      {
        plan_number: planNum,
        plan_name: cfg.plan_name,
        warmup_drill_id: cfg.warmup_drill_id || null,
        wedge_drill_id: cfg.wedge_drill_id || null,
        iron_drill_id: cfg.iron_drill_id || null,
        driver_drill_id: cfg.driver_drill_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_number' }
    );
    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: `Month ${planNum} plan saved.` });
    setSaving(false);
  }

  // ── Active Month ─────────────────────────────────────────────────────────────

  async function saveActivePlan(n) {
    setActivePlan(n);
    await supabase.from('practice_settings').upsert(
      { setting_key: 'active_month_plan', setting_value: n, updated_at: new Date().toISOString() },
      { onConflict: 'setting_key' }
    );
    setMessage({ type: 'success', text: `Active plan set to Month ${n}.` });
  }

  if (loading) {
    return <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>;
  }

  return (
    <div>
      <h5 className="fw-bold mb-3">
        <i className="bi bi-golf me-2 text-matador-red"></i>Practice Settings
      </h5>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {/* 1. Habit Categories */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Habit Categories &amp; Goals</div>
        <div className="card-body">
          <p className="text-muted small mb-3">
            Set the habit categories and weekly goals shown in the practice tracker. Deleting a category preserves all historical check-in data.
          </p>
          {categories.map((cat, idx) => (
            <div key={cat.id} className="d-flex gap-2 align-items-center mb-2 flex-wrap">
              <input
                type="text"
                className="form-control"
                style={{ maxWidth: 240 }}
                placeholder="Category name"
                value={cat.name}
                onChange={e => updateCategory(idx, 'name', e.target.value)}
              />
              <div className="d-flex align-items-center gap-1">
                <label className="form-label mb-0 small text-muted">Goal/wk:</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: 64 }}
                  min="1"
                  max="7"
                  value={cat.goal}
                  onChange={e => updateCategory(idx, 'goal', parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => deleteCategory(idx)}
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          ))}
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-outline-secondary btn-sm" onClick={addCategory}>
              <i className="bi bi-plus me-1"></i>Add category
            </button>
            <button className="btn btn-matador btn-sm" onClick={saveCategories} disabled={saving}>
              Save Categories
            </button>
          </div>
        </div>
      </div>

      {/* 2. Monthly Plan Management */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Monthly Plan Management</div>
        <div className="card-body p-0">
          {[1, 2, 3, 4].map(planNum => {
            const cfg = planConfigs[planNum] || {};
            const isOpen = expandedPlan === planNum;
            return (
              <div key={planNum} className="border-bottom">
                <button
                  className="btn btn-link w-100 text-start text-decoration-none d-flex justify-content-between align-items-center px-3 py-3"
                  onClick={() => setExpandedPlan(isOpen ? null : planNum)}
                  style={{ color: 'inherit' }}
                >
                  <span>
                    <span className="fw-bold me-2">Month {planNum}</span>
                    <span className="text-muted small">{cfg.plan_name || monthPlans[planNum]?.name}</span>
                    {activePlan === planNum && (
                      <span className="badge badge-matador ms-2" style={{ background: 'var(--matador-red)', color: 'white', fontSize: '0.7rem' }}>Active</span>
                    )}
                  </span>
                  <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} text-muted`}></i>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3">
                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Plan Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cfg.plan_name || ''}
                        onChange={e => updatePlanField(planNum, 'plan_name', e.target.value)}
                      />
                    </div>

                    {DRILL_SLOTS.map(slot => {
                      const fieldKey = `${slot.key}_drill_id`;
                      const selectedDrillId = cfg[fieldKey] || '';
                      const selectedDrill = getDrillById(selectedDrillId);
                      return (
                        <div key={slot.key} className="mb-3">
                          <label className="form-label fw-semibold small">{slot.label} Drill</label>
                          <select
                            className="form-select"
                            value={selectedDrillId}
                            onChange={e => updatePlanField(planNum, fieldKey, e.target.value)}
                          >
                            <option value="">— Default —</option>
                            {getDrillsByCategory(slot.category).map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          {selectedDrill && (
                            <div className="mt-1">
                              <div className="text-muted small">{selectedDrill.objective}</div>
                              <span className="badge border text-dark mt-1" style={{ fontSize: '0.7rem' }}>
                                {getPassBadgeText(selectedDrill)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      className="btn btn-matador btn-sm"
                      onClick={() => savePlan(planNum)}
                      disabled={saving}
                    >
                      Save Month {planNum}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Active Month Selector */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Active Month Plan</div>
        <div className="card-body">
          <p className="text-muted small mb-3">
            Sets the default month plan pre-selected when logging a new range session.
          </p>
          <div className="d-flex gap-2 flex-wrap">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                className={`btn ${activePlan === n ? 'btn-matador' : 'btn-outline-secondary'}`}
                style={{ minHeight: 44 }}
                onClick={() => saveActivePlan(n)}
              >
                Month {n}
                <div className="small opacity-75" style={{ fontSize: '0.7rem' }}>
                  {(planConfigs[n]?.plan_name || monthPlans[n]?.name || '')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
