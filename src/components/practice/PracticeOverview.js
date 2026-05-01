import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  defaultHabitCategories,
  getDrillById,
  isDrillPass,
  scoreSummary,
  formatDateISO,
  getWeekStart,
} from '../../data/practicePlans';

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PracticeOverview() {
  const [categories, setCategories] = useState(defaultHabitCategories);
  const [weekCheckins, setWeekCheckins] = useState([]);
  const [rangeSessions, setRangeSessions] = useState([]);
  const [shortSessions, setShortSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekStartISO = formatDateISO(weekStart);
    const weekEndISO = formatDateISO(new Date(weekStart.getTime() + 6 * 86400000));

    const [settingsRes, checkinsRes, rangeRes, shortRes] = await Promise.all([
      supabase.from('practice_settings').select('setting_value').eq('setting_key', 'habit_categories').maybeSingle(),
      supabase.from('practice_habit_checkins')
        .select('checkin_date, category')
        .eq('user_id', 'primary')
        .gte('checkin_date', weekStartISO)
        .lte('checkin_date', weekEndISO),
      supabase.from('practice_range_sessions')
        .select('*')
        .eq('user_id', 'primary')
        .order('session_date', { ascending: false })
        .limit(3),
      supabase.from('practice_short_game_sessions')
        .select('*')
        .eq('user_id', 'primary')
        .order('session_date', { ascending: false })
        .limit(3),
    ]);

    if (settingsRes.data?.setting_value) setCategories(settingsRes.data.setting_value);
    setWeekCheckins(checkinsRes.data || []);
    setRangeSessions(rangeRes.data || []);
    setShortSessions(shortRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  }

  function weekCount(catId) {
    return weekCheckins.filter(c => c.category === catId).length;
  }

  const goalsMetCount = categories.filter(cat => weekCount(cat.id) >= cat.goal).length;

  function rangePassCount(session) {
    const sections = ['warmup', 'wedge', 'iron', 'driver'];
    let passed = 0, total = 0;
    sections.forEach(s => {
      const drill = getDrillById(session[`${s}_drill`]);
      const score = session[`${s}_score`];
      if (drill && score) {
        total++;
        if (isDrillPass(drill, score)) passed++;
      }
    });
    return { passed, total };
  }

  function rangeDrillTags(session) {
    return ['warmup', 'wedge', 'iron', 'driver']
      .map(s => getDrillById(session[`${s}_drill`])?.name)
      .filter(Boolean);
  }

  return (
    <div>
      {/* Weekly Habit Summary */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check2-circle me-2"></i>This Week</span>
          <span className="badge bg-matador-red">{goalsMetCount}/{categories.length} goals met</span>
        </div>
        <div className="card-body">
          {categories.map(cat => {
            const count = weekCount(cat.id);
            const pct = Math.min(100, Math.round(count / cat.goal * 100));
            const exceeded = count > cat.goal;
            const met = count >= cat.goal;
            return (
              <div key={cat.id} className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="fw-semibold">{cat.name}</span>
                  <span className={exceeded ? 'text-primary fw-bold' : met ? 'text-success fw-bold' : 'text-muted'}>
                    {count}/{cat.goal}
                  </span>
                </div>
                <div className="progress" style={{ height: 8 }}>
                  <div
                    className={`progress-bar ${exceeded ? 'bg-primary' : met ? 'bg-success' : 'bg-secondary'}`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last 3 Range Sessions */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">
          <i className="bi bi-dribbble me-2"></i>Recent Range Sessions
        </div>
        {rangeSessions.length === 0 ? (
          <div className="card-body text-muted small">No range sessions logged yet.</div>
        ) : (
          <div className="card-body p-0">
            {rangeSessions.map((s, i) => {
              const { passed, total } = rangePassCount(s);
              const tags = rangeDrillTags(s);
              return (
                <div key={s.id} className={`p-3 ${i < rangeSessions.length - 1 ? 'border-bottom' : ''}`}>
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <span className="fw-semibold">{formatDisplayDate(s.session_date)}</span>
                    <div className="d-flex gap-1 align-items-center">
                      {total > 0 && (
                        <span className={`badge ${passed === total ? 'bg-success' : passed > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                          {passed}/{total} Pass
                        </span>
                      )}
                      {s.session_feel && (
                        <span className="badge bg-secondary">Feel {s.session_feel}/5</span>
                      )}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-1 mb-1">
                    {tags.map((t, idx) => (
                      <span key={idx} className="badge border text-dark" style={{ fontSize: '0.75rem' }}>{t}</span>
                    ))}
                  </div>
                  {s.driver_fairways_pct != null && (
                    <div className="text-muted small">Fairways: {s.driver_fairways_pct}%</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last 3 Short Game Sessions */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">
          <i className="bi bi-flag me-2"></i>Recent Short Game Sessions
        </div>
        {shortSessions.length === 0 ? (
          <div className="card-body text-muted small">No short game sessions logged yet.</div>
        ) : (
          <div className="card-body p-0">
            {shortSessions.map((s, i) => {
              const drill = getDrillById(s.drill);
              const pass = isDrillPass(drill, s.score);
              return (
                <div key={s.id} className={`p-3 ${i < shortSessions.length - 1 ? 'border-bottom' : ''}`}>
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div>
                      <span className="fw-semibold me-2">{formatDisplayDate(s.session_date)}</span>
                      <span className="badge bg-secondary text-capitalize">{s.session_type}</span>
                    </div>
                    <div className="d-flex gap-1 align-items-center">
                      {pass !== null && (
                        <span className={`badge ${pass ? 'bg-success' : 'bg-danger'}`}>
                          {pass ? 'Pass' : 'Fail'}
                        </span>
                      )}
                      {s.session_feel && (
                        <span className="badge bg-secondary">Feel {s.session_feel}/5</span>
                      )}
                    </div>
                  </div>
                  {drill && (
                    <div className="text-muted small">
                      {drill.name}
                      {s.score && <span className="ms-2">{scoreSummary(drill, s.score)}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
