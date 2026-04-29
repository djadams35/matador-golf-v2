import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function LeagueSchedule() {
  const [byWeek, setByWeek] = useState({});
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weekStatuses, setWeekStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [schedRes, resultsRes, statusRes] = await Promise.all([
      supabase
        .from('schedule')
        .select('id, week_number, date, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)')
        .order('week_number'),
      supabase
        .from('match_results')
        .select('week_number'),
      supabase
        .from('schedule_week_status')
        .select('*'),
    ]);

    const schedule = schedRes.data || [];
    const playedWeeks = new Set((resultsRes.data || []).map(r => r.week_number));

    const statusMap = {};
    (statusRes.data || []).forEach(s => { statusMap[s.week_number] = s; });
    setWeekStatuses(statusMap);

    const grouped = {};
    schedule.forEach(s => {
      if (!grouped[s.week_number]) grouped[s.week_number] = [];
      grouped[s.week_number].push({ ...s, hasResults: playedWeeks.has(s.week_number) });
    });

    const sortedWeeks = Object.keys(grouped).map(Number).sort((a, b) => a - b);
    const maxPlayed = sortedWeeks.filter(w => playedWeeks.has(w));
    const lastPlayed = maxPlayed.length > 0 ? Math.max(...maxPlayed) : 0;
    const nextWeek = sortedWeeks.find(w => w > lastPlayed) ?? sortedWeeks[sortedWeeks.length - 1];

    setByWeek(grouped);
    setWeeks(sortedWeeks);
    setSelectedWeek(nextWeek ?? null);
    setLoading(false);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;

  if (weeks.length === 0) {
    return <div className="alert alert-info">No schedule yet. Set up the schedule in the Admin panel.</div>;
  }

  const matchups = byWeek[selectedWeek] || [];
  const weekHasResults = matchups.length > 0 && matchups[0].hasResults;
  const weekDate = matchups[0]?.date;
  const status = weekStatuses[selectedWeek];
  const isRainout = status?.rained_out;

  return (
    <div>
      {/* Week selector */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {weeks.map(w => (
          <button
            key={w}
            className={`btn btn-sm ${selectedWeek === w ? 'btn-matador' : 'btn-outline-secondary'}`}
            onClick={() => setSelectedWeek(w)}
          >
            Week {w}
            {weekStatuses[w]?.rained_out && <i className="bi bi-cloud-rain ms-1"></i>}
          </button>
        ))}
      </div>

      {/* Matchup card */}
      <div className="card border-0 shadow-sm">
        <div className={`card-header text-white d-flex justify-content-between align-items-center ${isRainout && status?.reschedule_date ? 'bg-matador-red' : 'bg-matador-black'}`}>
          <span>
            <i className={`bi ${isRainout && status?.reschedule_date ? 'bi-calendar-check' : 'bi-calendar3'} me-2`}></i>
            {isRainout && status?.reschedule_date
              ? <>Week {selectedWeek} Makeup <span className="fw-normal small ms-1 opacity-75">{formatDate(status.reschedule_date)}</span></>
              : <>Week {selectedWeek} Matchups{weekDate && <span className="ms-2 fw-normal small opacity-75">{formatDate(weekDate)}</span>}</>
            }
          </span>
          {isRainout && !status?.reschedule_date && !status?.no_reschedule && (
            <span className="badge bg-warning text-dark"><i className="bi bi-cloud-rain me-1"></i>Rained Out — TBD</span>
          )}
          {isRainout && status?.no_reschedule && (
            <span className="badge bg-secondary">Not Rescheduling</span>
          )}
          {isRainout && status?.reschedule_date && (
            <span className="badge bg-light text-dark">Makeup Game</span>
          )}
          {!isRainout && weekHasResults && (
            <span className="badge bg-success">Results available</span>
          )}
          {!isRainout && !weekHasResults && (
            <span className="badge bg-secondary">Upcoming</span>
          )}
        </div>

        {isRainout && (
          <div className={`mb-0 rounded-0 py-2 px-3 small ${status?.reschedule_date ? 'alert alert-info' : 'alert alert-warning'}`}>
            <i className="bi bi-cloud-rain me-2"></i>
            {status?.reschedule_date
              ? <>Originally scheduled for <strong>{formatDate(status.original_date || weekDate)}</strong> — rained out. Makeup date: <strong>{formatDate(status.reschedule_date)}</strong>.</>
              : status?.no_reschedule
                ? <>Week {selectedWeek} was rained out and will not be rescheduled.</>
                : <>Week {selectedWeek} was rained out. Reschedule TBD.</>
            }
          </div>
        )}

        <div className="card-body p-0">
          <table className="table mb-0">
            <tbody>
              {matchups.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? '' : 'table-light'}>
                  <td className="fw-semibold ps-4 py-3 text-end" style={{ width: '45%' }}>
                    {m.team_a?.name}
                  </td>
                  <td className="text-center text-muted py-3" style={{ width: '10%' }}>vs</td>
                  <td className="fw-semibold py-3" style={{ width: '45%' }}>
                    {m.team_b?.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
