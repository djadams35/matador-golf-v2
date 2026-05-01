import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  defaultHabitCategories,
  getDrillById,
  isDrillPass,
  scoreSummary,
  getWeekStart,
  formatDateISO,
  addDays,
} from '../../data/practicePlans';

const SCORED_SECTIONS = ['wedge', 'iron', 'driver'];

function getWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(+y, +m - 1, +d);
  return formatDateISO(getWeekStart(date));
}

function formatWeekLabel(weekStartStr) {
  const [y, m, d] = weekStartStr.split('-');
  const start = new Date(+y, +m - 1, +d);
  const end = addDays(start, 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function WeeklyResults() {
  const [categories, setCategories] = useState(defaultHabitCategories);
  const [checkins, setCheckins] = useState([]);
  const [rangeSessions, setRangeSessions] = useState([]);
  const [shortSessions, setShortSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    // Load last 12 weeks of data
    const cutoff = formatDateISO(addDays(new Date(), -84));

    const [settingsRes, checkinsRes, rangeRes, shortRes] = await Promise.all([
      supabase.from('practice_settings').select('setting_value').eq('setting_key', 'habit_categories').maybeSingle(),
      supabase.from('practice_habit_checkins')
        .select('checkin_date, category')
        .eq('user_id', 'primary')
        .gte('checkin_date', cutoff),
      supabase.from('practice_range_sessions')
        .select('*')
        .eq('user_id', 'primary')
        .gte('session_date', cutoff)
        .order('session_date', { ascending: false }),
      supabase.from('practice_short_game_sessions')
        .select('*')
        .eq('user_id', 'primary')
        .gte('session_date', cutoff)
        .order('session_date', { ascending: false }),
    ]);

    if (settingsRes.data?.setting_value) setCategories(settingsRes.data.setting_value);
    setCheckins(checkinsRes.data || []);
    setRangeSessions(rangeRes.data || []);
    setShortSessions(shortRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>;
  }

  // Group everything by week start date
  const weekMap = {};

  function ensureWeek(key) {
    if (!weekMap[key]) weekMap[key] = { checkins: [], range: [], short: [] };
  }

  checkins.forEach(c => {
    const key = getWeekKey(c.checkin_date);
    ensureWeek(key);
    weekMap[key].checkins.push(c);
  });

  rangeSessions.forEach(s => {
    const key = getWeekKey(s.session_date);
    ensureWeek(key);
    weekMap[key].range.push(s);
  });

  shortSessions.forEach(s => {
    const key = getWeekKey(s.session_date);
    ensureWeek(key);
    weekMap[key].short.push(s);
  });

  const sortedWeeks = Object.keys(weekMap).sort((a, b) => b.localeCompare(a));

  if (sortedWeeks.length === 0) {
    return <p className="text-muted">No practice data logged yet.</p>;
  }

  const todayWeekKey = formatDateISO(getWeekStart(new Date()));

  return (
    <div>
      {sortedWeeks.map(weekKey => {
        const { checkins: wCheckins, range: wRange, short: wShort } = weekMap[weekKey];
        const isCurrentWeek = weekKey === todayWeekKey;
        const isExpanded = expandedWeek === weekKey;

        // Habit summary
        const goalsMetCount = categories.filter(cat => {
          const count = wCheckins.filter(c => c.category === cat.id).length;
          return count >= cat.goal;
        }).length;
        const totalCheckins = wCheckins.length;

        // Range pass summary (excluding warmup)
        let rangePassTotal = 0, rangeScoredTotal = 0;
        wRange.forEach(s => {
          SCORED_SECTIONS.forEach(sec => {
            const drill = getDrillById(s[`${sec}_drill`]);
            const score = s[`${sec}_score`];
            if (drill && score) {
              rangeScoredTotal++;
              if (isDrillPass(drill, score)) rangePassTotal++;
            }
          });
        });

        // Short game pass summary
        let shortPassTotal = 0, shortScoredTotal = 0;
        wShort.forEach(s => {
          const drill = getDrillById(s.drill);
          if (drill && s.score) {
            shortScoredTotal++;
            if (isDrillPass(drill, s.score)) shortPassTotal++;
          }
        });

        return (
          <div key={weekKey} className="card border-0 shadow-sm mb-3">
            <div
              className={`card-header d-flex justify-content-between align-items-center ${isCurrentWeek ? 'bg-matador-black text-white' : 'bg-light'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
            >
              <div>
                <span className="fw-semibold me-2">{formatWeekLabel(weekKey)}</span>
                {isCurrentWeek && <span className="badge bg-matador-red ms-1">This week</span>}
              </div>
              <div className="d-flex align-items-center gap-2">
                {/* Habit pill */}
                {totalCheckins > 0 && (
                  <span className={`badge ${goalsMetCount === categories.length ? 'bg-success' : goalsMetCount > 0 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                    {goalsMetCount}/{categories.length} goals
                  </span>
                )}
                {/* Range pill */}
                {wRange.length > 0 && rangeScoredTotal > 0 && (
                  <span className={`badge ${rangePassTotal === rangeScoredTotal ? 'bg-success' : rangePassTotal > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                    Range {rangePassTotal}/{rangeScoredTotal}
                  </span>
                )}
                {wRange.length > 0 && rangeScoredTotal === 0 && (
                  <span className="badge bg-secondary">{wRange.length} range</span>
                )}
                {/* Short game pill */}
                {wShort.length > 0 && shortScoredTotal > 0 && (
                  <span className={`badge ${shortPassTotal === shortScoredTotal ? 'bg-success' : shortPassTotal > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                    SG {shortPassTotal}/{shortScoredTotal}
                  </span>
                )}
                {wShort.length > 0 && shortScoredTotal === 0 && (
                  <span className="badge bg-secondary">{wShort.length} short</span>
                )}
                <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} ${isCurrentWeek ? 'text-white' : 'text-muted'}`}></i>
              </div>
            </div>

            {isExpanded && (
              <div className="card-body p-0">
                {/* Habit breakdown */}
                {wCheckins.length > 0 && (
                  <div className="px-3 pt-3 pb-2 border-bottom">
                    <div className="fw-semibold small mb-2">
                      <i className="bi bi-check2-circle me-1 text-matador-red"></i>Habits
                    </div>
                    {categories.map(cat => {
                      const count = wCheckins.filter(c => c.category === cat.id).length;
                      if (count === 0) return null;
                      const met = count >= cat.goal;
                      const exceeded = count > cat.goal;
                      return (
                        <div key={cat.id} className="d-flex justify-content-between small mb-1">
                          <span>{cat.name}</span>
                          <span className={exceeded ? 'text-primary fw-bold' : met ? 'text-success fw-bold' : 'text-muted'}>
                            {count}/{cat.goal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Range sessions */}
                {wRange.length > 0 && (
                  <div className="px-3 pt-3 pb-2 border-bottom">
                    <div className="fw-semibold small mb-2">
                      <i className="bi bi-dribbble me-1 text-matador-red"></i>Range ({wRange.length} session{wRange.length > 1 ? 's' : ''})
                    </div>
                    {wRange.map(s => {
                      const sessionPass = SCORED_SECTIONS.reduce((acc, sec) => {
                        const drill = getDrillById(s[`${sec}_drill`]);
                        const score = s[`${sec}_score`];
                        if (drill && score && isDrillPass(drill, score)) return acc + 1;
                        return acc;
                      }, 0);
                      const sessionScored = SCORED_SECTIONS.filter(sec => {
                        const drill = getDrillById(s[`${sec}_drill`]);
                        return drill && s[`${sec}_score`];
                      }).length;

                      return (
                        <div key={s.id} className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="small fw-semibold">{formatDate(s.session_date)} — Month {s.month_plan}</span>
                            <div className="d-flex gap-1">
                              {sessionScored > 0 && (
                                <span className={`badge ${sessionPass === sessionScored ? 'bg-success' : sessionPass > 0 ? 'bg-warning text-dark' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                                  {sessionPass}/{sessionScored} Pass
                                </span>
                              )}
                              {s.session_feel && (
                                <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>Feel {s.session_feel}/5</span>
                              )}
                            </div>
                          </div>
                          {SCORED_SECTIONS.map(sec => {
                            const drill = getDrillById(s[`${sec}_drill`]);
                            const score = s[`${sec}_score`];
                            if (!drill) return null;
                            const pass = isDrillPass(drill, score);
                            return (
                              <div key={sec} className="d-flex justify-content-between align-items-center ms-2 mb-1">
                                <div>
                                  <span className="text-muted small me-1 text-capitalize">{sec}:</span>
                                  <span className="small">{drill.name}</span>
                                  {score && <span className="text-muted small ms-1">({scoreSummary(drill, score)})</span>}
                                </div>
                                {pass !== null && (
                                  <span className={`badge ${pass ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.65rem' }}>
                                    {pass ? 'Pass' : 'Fail'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {s.driver_fairways_pct != null && (
                            <div className="text-muted small ms-2">Fairways: {s.driver_fairways_pct}%</div>
                          )}
                          {s.notes && <div className="text-muted small ms-2 fst-italic">{s.notes}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short game sessions */}
                {wShort.length > 0 && (
                  <div className="px-3 pt-3 pb-2">
                    <div className="fw-semibold small mb-2">
                      <i className="bi bi-flag me-1 text-matador-red"></i>Short Game ({wShort.length} session{wShort.length > 1 ? 's' : ''})
                    </div>
                    {wShort.map(s => {
                      const drill = getDrillById(s.drill);
                      const pass = isDrillPass(drill, s.score);
                      return (
                        <div key={s.id} className="d-flex justify-content-between align-items-center mb-2">
                          <div>
                            <span className="small fw-semibold me-2">{formatDate(s.session_date)}</span>
                            <span className="badge bg-secondary me-1" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>{s.session_type}</span>
                            {drill && <span className="small text-muted me-1">{drill.name}</span>}
                            {drill && s.score && <span className="small text-muted">({scoreSummary(drill, s.score)})</span>}
                          </div>
                          <div className="d-flex gap-1">
                            {pass !== null && (
                              <span className={`badge ${pass ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                                {pass ? 'Pass' : 'Fail'}
                              </span>
                            )}
                            {s.session_feel && (
                              <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>Feel {s.session_feel}/5</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {wCheckins.length === 0 && wRange.length === 0 && wShort.length === 0 && (
                  <div className="p-3 text-muted small">No activity this week.</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
