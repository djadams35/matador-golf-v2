import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function LeagueSchedule() {
  const [byWeek, setByWeek] = useState({});
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [schedRes, resultsRes] = await Promise.all([
      supabase
        .from('schedule')
        .select('id, week_number, note, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)')
        .order('week_number'),
      supabase
        .from('match_results')
        .select('week_number'),
    ]);

    const schedule = schedRes.data || [];
    const playedWeeks = new Set((resultsRes.data || []).map(r => r.week_number));

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

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;

  if (weeks.length === 0) {
    return <div className="alert alert-info">No schedule yet. Set up the schedule in the Admin panel.</div>;
  }

  const matchups = byWeek[selectedWeek] || [];
  const weekHasResults = matchups.length > 0 && matchups[0].hasResults;
  const weekNote = matchups.find(m => m.note)?.note ?? null;

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
          </button>
        ))}
      </div>

      {/* Matchup cards */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center">
          <span><i className="bi bi-calendar3 me-2"></i>Week {selectedWeek} Matchups</span>
          {weekNote && (
            <span className="badge bg-warning text-dark">{weekNote}</span>
          )}
          {!weekNote && weekHasResults && (
            <span className="badge bg-success">Results available</span>
          )}
          {!weekNote && !weekHasResults && (
            <span className="badge bg-secondary">Upcoming</span>
          )}
        </div>
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
