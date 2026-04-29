import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../supabaseClient';

export default function ManageSchedule() {
  const [schedule, setSchedule] = useState([]);
  const [teams, setTeams] = useState([]);
  const [rainoutStatuses, setRainoutStatuses] = useState({});
  const [editingRainout, setEditingRainout] = useState(null);
  const [rainoutForm, setRainoutForm] = useState({ reschedule_date: '', no_reschedule: false });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [newEntry, setNewEntry] = useState({ week_number: '', team_a_id: '', team_b_id: '' });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [schedRes, teamsRes, statusRes] = await Promise.all([
      supabase.from('schedule')
        .select('*, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)')
        .order('week_number'),
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('schedule_week_status').select('*'),
    ]);
    if (schedRes.data) setSchedule(schedRes.data);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (statusRes.data) {
      const map = {};
      statusRes.data.forEach(s => { map[s.week_number] = s; });
      setRainoutStatuses(map);
    }
    setLoading(false);
  }

  async function importScheduleCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);

    const { data: teamsData } = await supabase.from('teams').select('id, name');
    if (!teamsData || teamsData.length === 0) {
      setMessage({ type: 'error', text: 'No teams found. Import your teams first before importing the schedule.' });
      setImporting(false);
      return;
    }

    const teamLookup = {};
    teamsData.forEach(t => { teamLookup[t.name.toLowerCase().trim()] = t.id; });

    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      complete: async (result) => {
        const rows = result.data;
        let currentRound = null;
        let currentDate = null;
        let imported = 0, errors = [];

        for (const row of rows) {
          if (String(row[0]).trim() === 'Round') continue;

          const roundVal = String(row[0]).trim();
          if (roundVal && !isNaN(parseInt(roundVal))) {
            currentRound = parseInt(roundVal);
            // Parse date from col 1: "04/06/2026 - Regular" → "2026-04-06"
            const datePart = String(row[1] || '').trim().split(' - ')[0].trim();
            const [mm, dd, yyyy] = datePart.split('/');
            currentDate = mm && dd && yyyy ? `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}` : null;
          }

          if (!currentRound) continue;

          const team1Name = String(row[5] || '').trim();
          const team2Name = String(row[7] || '').trim();

          if (!team1Name || !team2Name || team1Name === 'Team 1' || team2Name === 'Team 2') continue;
          if (team1Name.toUpperCase() === 'VS' || team2Name.toUpperCase() === 'VS') continue;

          const teamAId = teamLookup[team1Name.toLowerCase()];
          const teamBId = teamLookup[team2Name.toLowerCase()];

          if (!teamAId) { errors.push(`Week ${currentRound}: team not found — "${team1Name}"`); continue; }
          if (!teamBId) { errors.push(`Week ${currentRound}: team not found — "${team2Name}"`); continue; }

          const { error } = await supabase.from('schedule').upsert({
            week_number: currentRound,
            team_a_id: teamAId,
            team_b_id: teamBId,
            date: currentDate,
          }, { onConflict: 'week_number,team_a_id' });

          if (error) { errors.push(`Week ${currentRound} ${team1Name} vs ${team2Name}: ${error.message}`); }
          else imported++;
        }

        if (errors.length > 0) {
          setMessage({ type: 'error', text: `${imported} matchups imported. Issues:\n${errors.join('\n')}` });
        } else {
          setMessage({ type: 'success', text: `✅ ${imported} matchups imported across the season.` });
        }

        fetchData();
        setImporting(false);
        e.target.value = '';
      },
      error: (err) => {
        setMessage({ type: 'error', text: 'Could not read CSV: ' + err.message });
        setImporting(false);
      }
    });
  }

  async function addEntry(e) {
    e.preventDefault();
    if (!newEntry.week_number || !newEntry.team_a_id || !newEntry.team_b_id) {
      setMessage({ type: 'error', text: 'Fill in all fields.' });
      return;
    }
    if (newEntry.team_a_id === newEntry.team_b_id) {
      setMessage({ type: 'error', text: 'Teams must be different.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('schedule').upsert({
      week_number: parseInt(newEntry.week_number),
      team_a_id: newEntry.team_a_id,
      team_b_id: newEntry.team_b_id,
    }, { onConflict: 'week_number,team_a_id' });
    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setNewEntry({ week_number: '', team_a_id: '', team_b_id: '' });
      setMessage({ type: 'success', text: 'Matchup saved!' });
      fetchData();
    }
    setSaving(false);
  }

  async function deleteEntry(id) {
    if (!window.confirm('Remove this matchup?')) return;
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: 'Removed.' }); fetchData(); }
  }

  function startEditRainout(weekNum) {
    const existing = rainoutStatuses[weekNum];
    setRainoutForm({
      reschedule_date: existing?.reschedule_date || '',
      no_reschedule: existing?.no_reschedule || false,
    });
    setEditingRainout(weekNum);
  }

  async function saveRainout(weekNum) {
    setSaving(true);
    const rescheduleDate = rainoutForm.no_reschedule ? null : (rainoutForm.reschedule_date || null);

    // Capture the current schedule date as original_date the first time this week is marked as a rainout
    const existing = rainoutStatuses[weekNum];
    const originalDate = existing?.original_date || byWeek[weekNum]?.[0]?.date || null;

    const { error } = await supabase.from('schedule_week_status').upsert({
      week_number: weekNum,
      rained_out: true,
      reschedule_date: rescheduleDate,
      no_reschedule: rainoutForm.no_reschedule,
      original_date: originalDate,
    }, { onConflict: 'week_number' });
    if (error) { setMessage({ type: 'error', text: error.message }); setSaving(false); return; }

    setMessage({ type: 'success', text: `Week ${weekNum} marked as rained out.` });
    fetchData();
    setEditingRainout(null);
    setSaving(false);
  }

  async function clearRainout(weekNum) {
    if (!window.confirm(`Clear rainout status for Week ${weekNum}?`)) return;
    setSaving(true);
    const { error } = await supabase.from('schedule_week_status').delete().eq('week_number', weekNum);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: `Week ${weekNum} rainout cleared.` }); fetchData(); }
    setEditingRainout(null);
    setSaving(false);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const byWeek = {};
  schedule.forEach(s => {
    if (!byWeek[s.week_number]) byWeek[s.week_number] = [];
    byWeek[s.week_number].push(s);
  });

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-calendar3 me-2 text-matador-red"></i>Season Schedule</h5>

      {/* CSV Import */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Import Full Season Schedule from CSV</div>
        <div className="card-body">
          <p className="text-muted small mb-3">
            Import the Golf League Guru matches report CSV. Make sure teams are imported first.
          </p>
          <label className={`btn btn-matador ${importing ? 'disabled' : ''}`}>
            {importing
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Importing...</>
              : <><i className="bi bi-upload me-2"></i>Choose matches_report.csv</>}
            <input type="file" accept=".csv" className="d-none" onChange={importScheduleCSV} disabled={importing} />
          </label>
        </div>
      </div>

      {/* Manual add */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Add / Override Single Matchup</div>
        <div className="card-body">
          <form onSubmit={addEntry}>
            <div className="row g-3">
              <div className="col-6 col-md-2">
                <label className="form-label fw-semibold">Week #</label>
                <input type="number" className="form-control" min="1"
                  value={newEntry.week_number} onChange={e => setNewEntry(n => ({ ...n, week_number: e.target.value }))} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Team A</label>
                <select className="form-select" value={newEntry.team_a_id} onChange={e => setNewEntry(n => ({ ...n, team_a_id: e.target.value }))}>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Team B</label>
                <select className="form-select" value={newEntry.team_b_id} onChange={e => setNewEntry(n => ({ ...n, team_b_id: e.target.value }))}>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-2 d-flex align-items-end">
                <button type="submit" className="btn btn-matador w-100" disabled={saving}>Save</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`} style={{ whiteSpace: 'pre-line' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <div>
          {Object.keys(byWeek).length === 0 && <p className="text-muted">No schedule entries yet.</p>}
          {Object.entries(byWeek).map(([week, matchups]) => {
            const weekNum = parseInt(week);
            const status = rainoutStatuses[weekNum];
            const isRainout = status?.rained_out;
            const isEditing = editingRainout === weekNum;
            const weekDate = matchups[0]?.date;

            return (
              <div key={week} className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <span className="d-flex align-items-center gap-2 flex-wrap">
                    <span>Week {week}{weekDate && <span className="text-white-50 small ms-2">{formatDate(weekDate)}</span>}</span>
                    {isRainout && (
                      <span className="badge bg-warning text-dark">
                        <i className="bi bi-cloud-rain me-1"></i>Rained Out
                        {status.reschedule_date && ` · Rescheduled ${formatDate(status.reschedule_date)}`}
                        {status.no_reschedule && ' · Not Rescheduling'}
                      </span>
                    )}
                  </span>
                  <div className="d-flex gap-2">
                    {isRainout ? (
                      <>
                        <button className="btn btn-sm btn-outline-light" onClick={() => startEditRainout(weekNum)}>
                          <i className="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button className="btn btn-sm btn-outline-warning" onClick={() => clearRainout(weekNum)} disabled={saving}>
                          Clear Rainout
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-sm btn-outline-light" onClick={() => startEditRainout(weekNum)}>
                        <i className="bi bi-cloud-rain me-1"></i>Mark Rainout
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="card-body bg-light border-bottom">
                    <p className="fw-semibold small mb-2">
                      <i className="bi bi-cloud-rain-heavy text-warning me-1"></i>
                      Rainout details for Week {weekNum}
                    </p>
                    <div className="d-flex flex-wrap align-items-end gap-3">
                      <div>
                        <label className="form-label small fw-semibold mb-1">Reschedule date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          style={{ width: 160 }}
                          value={rainoutForm.reschedule_date}
                          disabled={rainoutForm.no_reschedule}
                          onChange={e => setRainoutForm(f => ({ ...f, reschedule_date: e.target.value }))}
                        />
                      </div>
                      <div className="form-check mb-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`no-reschedule-${week}`}
                          checked={rainoutForm.no_reschedule}
                          onChange={e => setRainoutForm(f => ({
                            ...f,
                            no_reschedule: e.target.checked,
                            reschedule_date: e.target.checked ? '' : f.reschedule_date,
                          }))}
                        />
                        <label className="form-check-label small" htmlFor={`no-reschedule-${week}`}>
                          Not rescheduling
                        </label>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-matador" onClick={() => saveRainout(weekNum)} disabled={saving}>
                          Save
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingRainout(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="card-body p-0">
                  <table className="table table-sm mb-0">
                    <tbody>
                      {matchups.map(s => (
                        <tr key={s.id}>
                          <td className="fw-semibold ps-3">{s.team_a?.name}</td>
                          <td className="text-muted text-center">vs</td>
                          <td className="fw-semibold">{s.team_b?.name}</td>
                          <td className="text-end pe-3">
                            <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEntry(s.id)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
