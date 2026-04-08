import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ManageSchedule() {
  const [schedule, setSchedule] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [newEntry, setNewEntry] = useState({ week_number: '', team_a_id: '', team_b_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [schedRes, teamsRes] = await Promise.all([
      supabase.from('schedule')
        .select('*, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)')
        .order('week_number'),
      supabase.from('teams').select('id, name').order('name'),
    ]);
    if (schedRes.data) setSchedule(schedRes.data);
    if (teamsRes.data) setTeams(teamsRes.data);
    setLoading(false);
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

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-calendar3 me-2 text-matador-red"></i>Season Schedule</h5>
      <p className="text-muted mb-4">Set which team plays which team each week. This is used to calculate match play results when you upload a round.</p>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Add / Override Matchup</div>
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
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead className="bg-matador-black text-white">
              <tr><th>Week</th><th>Team A</th><th>vs</th><th>Team B</th><th></th></tr>
            </thead>
            <tbody>
              {schedule.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">No schedule entries yet.</td></tr>}
              {schedule.map(s => (
                <tr key={s.id}>
                  <td className="fw-bold">{s.week_number}</td>
                  <td>{s.team_a?.name}</td>
                  <td className="text-muted">vs</td>
                  <td>{s.team_b?.name}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEntry(s.id)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
