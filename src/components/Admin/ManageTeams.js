import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ManageTeams() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', player1: '', player2: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [teamsRes, playersRes] = await Promise.all([
      supabase.from('teams').select(`
        id, name,
        team_players(player_id, players(id, name))
      `).order('name'),
      supabase.from('players').select('id, name').order('name'),
    ]);
    if (teamsRes.error) setMessage({ type: 'error', text: teamsRes.error.message });
    else setTeams(teamsRes.data || []);
    if (playersRes.data) setPlayers(playersRes.data);
    setLoading(false);
  }

  async function createTeam(e) {
    e.preventDefault();
    if (!newTeam.name.trim() || !newTeam.player1 || !newTeam.player2) {
      setMessage({ type: 'error', text: 'Please fill in team name and both players.' });
      return;
    }
    if (newTeam.player1 === newTeam.player2) {
      setMessage({ type: 'error', text: 'Players must be different.' });
      return;
    }
    setSaving(true);
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name: newTeam.name.trim() })
      .select()
      .single();
    if (teamError) { setMessage({ type: 'error', text: teamError.message }); setSaving(false); return; }

    const { error: rosterError } = await supabase.from('team_players').insert([
      { team_id: team.id, player_id: newTeam.player1 },
      { team_id: team.id, player_id: newTeam.player2 },
    ]);
    if (rosterError) setMessage({ type: 'error', text: rosterError.message });
    else {
      setNewTeam({ name: '', player1: '', player2: '' });
      setMessage({ type: 'success', text: `Team "${team.name}" created!` });
      fetchData();
    }
    setSaving(false);
  }

  async function deleteTeam(id, name) {
    if (!window.confirm(`Delete team "${name}"? Match results referencing this team will also be deleted.`)) return;
    await supabase.from('team_players').delete().eq('team_id', id);
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: `Deleted ${name}` }); fetchData(); }
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-people me-2 text-matador-red"></i>Manage Teams</h5>
      <p className="text-muted mb-4">There are 16 two-man teams. Create each team and assign its two players.</p>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Add New Team</div>
        <div className="card-body">
          <form onSubmit={createTeam}>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Team Name</label>
                <input type="text" className="form-control" placeholder="e.g. Team Alpha"
                  value={newTeam.name} onChange={e => setNewTeam(t => ({ ...t, name: e.target.value }))} />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label fw-semibold">Player 1</label>
                <select className="form-select" value={newTeam.player1} onChange={e => setNewTeam(t => ({ ...t, player1: e.target.value }))}>
                  <option value="">Select player...</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label fw-semibold">Player 2</label>
                <select className="form-select" value={newTeam.player2} onChange={e => setNewTeam(t => ({ ...t, player2: e.target.value }))}>
                  <option value="">Select player...</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-2 d-flex align-items-end">
                <button type="submit" className="btn btn-matador w-100" disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-plus-circle me-1"></i>Create</>}
                </button>
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
        <div className="row g-3">
          {teams.length === 0 && <div className="col-12 text-muted">No teams yet.</div>}
          {teams.map(team => {
            const roster = team.team_players?.map(tp => tp.players?.name).filter(Boolean) || [];
            return (
              <div className="col-12 col-md-6 col-lg-4" key={team.id}>
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-body d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-bold">{team.name}</div>
                      <div className="text-muted small">{roster.join(' & ') || 'No players assigned'}</div>
                    </div>
                    <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => deleteTeam(team.id, team.name)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
