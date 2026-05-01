import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  defaultHabitCategories,
  formatDateISO,
  getWeekStart,
  addDays,
} from '../../data/practicePlans';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export default function WeeklyLog() {
  const [categories, setCategories] = useState(defaultHabitCategories);
  const [weekOffset, setWeekOffset] = useState(0);
  const [checkins, setCheckins] = useState([]);
  const [monthCheckins, setMonthCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const today = new Date();
  const baseWeekStart = getWeekStart(today);
  const weekStart = new Date(baseWeekStart);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => formatDateISO(addDays(weekStart, i)));

  const todayISO = formatDateISO(today);
  const monthStartISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthEndISO = formatDateISO(new Date(nextMonth.getTime() - 1));

  const fetchCheckins = useCallback(async () => {
    setLoading(true);
    const [settingsRes, weekRes, monthRes] = await Promise.all([
      supabase.from('practice_settings').select('setting_value').eq('setting_key', 'habit_categories').maybeSingle(),
      supabase.from('practice_habit_checkins')
        .select('checkin_date, category')
        .eq('user_id', 'primary')
        .gte('checkin_date', weekDays[0])
        .lte('checkin_date', weekDays[6]),
      supabase.from('practice_habit_checkins')
        .select('checkin_date, category')
        .eq('user_id', 'primary')
        .gte('checkin_date', monthStartISO)
        .lte('checkin_date', monthEndISO),
    ]);
    if (settingsRes.data?.setting_value) setCategories(settingsRes.data.setting_value);
    setCheckins(weekRes.data || []);
    setMonthCheckins(monthRes.data || []);
    setLoading(false);
  }, [weekDays, monthStartISO, monthEndISO]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCheckins(); }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkinSet = new Set(checkins.map(c => `${c.checkin_date}|${c.category}`));

  async function toggleCheckin(dateISO, categoryId) {
    const key = `${dateISO}|${categoryId}`;
    setToggling(key);
    if (checkinSet.has(key)) {
      await supabase.from('practice_habit_checkins')
        .delete()
        .eq('user_id', 'primary')
        .eq('checkin_date', dateISO)
        .eq('category', categoryId);
      setCheckins(prev => prev.filter(c => !(c.checkin_date === dateISO && c.category === categoryId)));
    } else {
      await supabase.from('practice_habit_checkins')
        .insert({ user_id: 'primary', checkin_date: dateISO, category: categoryId });
      setCheckins(prev => [...prev, { checkin_date: dateISO, category: categoryId }]);
    }
    setToggling(null);
  }

  function weekCountForCat(catId) {
    return checkins.filter(c => c.category === catId).length;
  }

  function monthCountForCat(catId) {
    return monthCheckins.filter(c => c.category === catId).length;
  }

  const totalWeekSessions = checkins.length;
  const goalsMetCount = categories.filter(cat => weekCountForCat(cat.id) >= cat.goal).length;
  const exceededCount = categories.filter(cat => weekCountForCat(cat.id) > cat.goal).length;

  const isCurrentWeek = weekOffset === 0;
  const isFuture = weekOffset > 0;

  return (
    <div>
      {/* Week navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setWeekOffset(o => o - 1)}
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        <div className="text-center">
          <div className="fw-semibold small">{formatWeekLabel(weekStart)}</div>
          {isCurrentWeek && <div className="text-muted" style={{ fontSize: '0.75rem' }}>This week</div>}
        </div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setWeekOffset(o => o + 1)}
          disabled={isCurrentWeek}
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {/* Summary strip */}
      <div className="d-flex gap-3 mb-3 flex-wrap">
        <div className="card border-0 bg-light flex-fill text-center p-2">
          <div className="fw-bold fs-5">{goalsMetCount}/{categories.length}</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Goals met</div>
        </div>
        <div className="card border-0 bg-light flex-fill text-center p-2">
          <div className="fw-bold fs-5">{totalWeekSessions}</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Total sessions</div>
        </div>
        <div className="card border-0 bg-light flex-fill text-center p-2">
          <div className="fw-bold fs-5 text-primary">{exceededCount}</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Exceeded</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <>
          {/* Day grid */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="table-dark">
                      <th style={{ width: '30%', fontSize: '0.8rem' }}>Activity</th>
                      {DAY_LABELS.map((label, i) => {
                        const isToday = weekDays[i] === todayISO;
                        return (
                          <th
                            key={i}
                            className={`text-center ${isToday ? 'text-matador-red' : ''}`}
                            style={{ fontSize: '0.8rem', padding: '6px 2px' }}
                          >
                            {label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => {
                      const count = weekCountForCat(cat.id);
                      const met = count >= cat.goal;
                      const exceeded = count > cat.goal;
                      return (
                        <tr key={cat.id}>
                          <td style={{ fontSize: '0.78rem', verticalAlign: 'middle', padding: '6px 8px' }}>
                            <div className={`fw-semibold ${exceeded ? 'text-primary' : met ? 'text-success' : ''}`}>
                              {cat.name}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              {count}/{cat.goal} goal
                            </div>
                          </td>
                          {weekDays.map((dateISO, di) => {
                            const key = `${dateISO}|${cat.id}`;
                            const checked = checkinSet.has(key);
                            const isTogglingThis = toggling === key;
                            const future = dateISO > todayISO && !isFuture;
                            return (
                              <td
                                key={di}
                                className="text-center p-0"
                                style={{ verticalAlign: 'middle', cursor: future ? 'default' : 'pointer' }}
                                onClick={() => !future && !isTogglingThis && toggleCheckin(dateISO, cat.id)}
                              >
                                <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {isTogglingThis ? (
                                    <span className="spinner-border spinner-border-sm text-secondary" style={{ width: 16, height: 16 }}></span>
                                  ) : (
                                    <i
                                      className={`bi ${checked
                                        ? exceeded ? 'bi-check-circle-fill text-primary' : met ? 'bi-check-circle-fill text-success' : 'bi-check-circle-fill text-success'
                                        : future ? 'bi-circle text-muted opacity-25' : 'bi-circle text-muted'
                                      }`}
                                      style={{ fontSize: '1.15rem' }}
                                    ></i>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Month progress */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-matador-black text-white small">
              <i className="bi bi-calendar-month me-2"></i>
              {today.toLocaleDateString('en-US', { month: 'long' })} Progress
            </div>
            <div className="card-body">
              {categories.map(cat => {
                const count = monthCountForCat(cat.id);
                const target = cat.goal * 4;
                const pct = Math.min(100, Math.round(count / target * 100));
                const met = count >= target;
                const exceeded = count > target;
                return (
                  <div key={cat.id} className="mb-3">
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold">{cat.name}</span>
                      <span className={exceeded ? 'text-primary fw-bold' : met ? 'text-success fw-bold' : 'text-muted'}>
                        {count}/{target}
                      </span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
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
        </>
      )}
    </div>
  );
}
