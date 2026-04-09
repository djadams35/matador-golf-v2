import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../supabaseClient';

export default function ManageTeams() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', player1: '', player2: '' });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

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

  async function importCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (result) => {
        const rows = result.data;
        let created = 0, skipped = 0, errors = [];

        for (const row of rows) {
          // Skip header row
          if (String(row[0]).trim() === '#') continue;

          // Columns: 0=#, 1=Team, 2=Player1, 3=Player2
          const teamName = String(row[1] || '').trim();
          const player1Name = String(row[2] || '').trim();
          const player2Name = String(row[3] || '').trim();

          if (!teamName || !player1Name || !player2Name) {
            skipped++;
            continue;
          }

          // Upsert both players
          const { data: upserted, error: pErr } = await supabase
            .from('players')
            .upsert([{ name: player1Name }, { name: player2Name }], { onConflict: 'name' })
            .select();
          if (pErr) { errors.push(`${teamName}: ${pErr.message}`); continue; }

          const p1 = upserted.find(p => p.name === player1Name);
          const p2 = upserted.find(p => p.name === player2Name);
          if (!p1 || !p2) { errors.push(`${teamName}: could not find players after upsert`); continue; }

          // Upsert team (creates if not exists, updates if exists)
          const { data: team, error: tErr } = await supabase
            .from('teams')
            .upsert({ name: teamName }, { onConflict: 'name' })
            .select()
            .single();
          if (tErr) { errors.push(`${teamName} upsert error: ${tErr.message} (code: ${tErr.code})`); continue; }
          if (!team) { errors.push(`${teamName}: upsert returned no data`); continue; }

          // Assign players
          const { error: rErr } = await supabase.from('team_players').insert([
            { team_id: team.id, player_id: p1.id },
            { team_id: team.id, player_id: p2.id },
          ]);
          if (rErr) { errors.push(`${teamName}: ${rErr.message}`); continue; }

          created++;
        }

        if (errors.length > 0) {
          setMessage({ type: 'error', text: `${created} teams imported. Errors: ${errors.join('; ')}` });
        } else {
          setMessage({ type: 'success', text: `✅ ${created} teams imported${skipped > 0 ? `, ${skipped} skipped (already exist)` : ''}.` });
        }

        fetchData();
        setImporting(false);
        // Reset file input
        e.target.value = '';
      },
      error: (err) => {
        setMessage({ type: 'error', text: 'Could not read CSV: ' + err.message });
        setImporting(false);
      }
    });
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

      {/* CSV Import */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center">
          <span>Import Teams from CSV</span>
          <span className="text-white-50 small">Expected columns: #, Team, Points, Player1, Player2</span>
        </div>
        <div className="card-body">
          <label className={`btn btn-matador ${importing ? 'disabled' : ''}`}>
            {importing
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Importing...</>
              : <><i className="bi bi-upload me-2"></i>Choose teams.csv</>}
            <input type="file" accept=".csv" className="d-none" onChange={importCSV} disabled={importing} />
          </label>
          <span className="text-muted ms-3 small">Skips teams that already exist. Also adds players automatically.</span>
        </div>
      </div>

      {/* Manual add */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">Add Single Team Manually</div>
        <div className="card-body">
          <form onSubmit={createTeam}>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Team Name</label>
                <input type="text" className="form-control" placeholder="e.g. Beyer/Adams"
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
