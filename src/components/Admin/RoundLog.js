import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateSkins } from '../../utils/skinsCalculator';
import { calculateMatchPlay } from '../../utils/matchPlayCalculator';

export default function RoundLog() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState({}); // roundId -> { played_date, week_number }
  const [saving, setSaving] = useState({});
  const [recalculating, setRecalculating] = useState({});

  useEffect(() => { fetchRounds(); }, []);

  async function fetchRounds() {
    setLoading(true);
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setMessage({ type: 'error', text: error.message });
    else setRounds(data || []);
    setLoading(false);
  }

  function startEdit(r) {
    setEditing(prev => ({
      ...prev,
      [r.id]: { played_date: r.played_date || '', week_number: r.week_number ?? '' },
    }));
  }

  function cancelEdit(id) {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveEdit(r) {
    setSaving(prev => ({ ...prev, [r.id]: true }));
    const { played_date, week_number } = editing[r.id];
    const { error } = await supabase.from('rounds').update({
      played_date: played_date || null,
      week_number: week_number !== '' ? parseInt(week_number) : null,
    }).eq('id', r.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: `Updated "${r.file_name}"` });
      cancelEdit(r.id);
      fetchRounds();
    }
    setSaving(prev => ({ ...prev, [r.id]: false }));
  }

  async function deleteRound(round) {
    if (!window.confirm(`Delete round "${round.file_name}"? This will permanently remove all scores, skins, and match results for this round.`)) return;

    await supabase.storage.from('round-csvs').remove([round.storage_path]);

    const { error } = await supabase.from('rounds').delete().eq('id', round.id);
    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setMessage({ type: 'success', text: `Deleted "${round.file_name}"` });
      fetchRounds();
    }
  }

  async function recalculateRound(round) {
    if (!window.confirm(`Recalculate skins and match results for "${round.file_name}"? This overwrites existing skins and match results for this round.`)) return;

    setRecalculating(prev => ({ ...prev, [round.id]: true }));
    setMessage(null);

    try {
      // 1. Fetch saved player scores for this round
      const { data: scoreRows, error: scoresError } = await supabase
        .from('player_scores')
        .select('player_id, hole_number, gross_score, full_handicap, players(name)')
        .eq('round_id', round.id);

      if (scoresError) throw new Error('Failed to fetch scores: ' + scoresError.message);
      if (!scoreRows || scoreRows.length === 0) throw new Error('No scores found for this round.');

      // 2. Reconstruct players array from stored scores
      const section = round.holes_played; // 'front' or 'back'
      const startHole = section === 'front' ? 1 : 10;
      const byPlayerId = {};

      for (const row of scoreRows) {
        const name = row.players?.name;
        if (!name) continue;
        if (!byPlayerId[row.player_id]) {
          byPlayerId[row.player_id] = { name, fullHandicap: row.full_handicap, scores: new Array(9).fill(0) };
        }
        const idx = row.hole_number - startHole;
        if (idx >= 0 && idx < 9) {
          byPlayerId[row.player_id].scores[idx] = row.gross_score;
        }
      }

      const players = Object.values(byPlayerId);
      const playerNameToId = {};
      for (const [id, p] of Object.entries(byPlayerId)) {
        playerNameToId[p.name] = id;
      }

      // 3. Recalculate and replace skins_results
      await supabase.from('skins_results').delete().eq('round_id', round.id);

      const skins = calculateSkins(players, section);
      const skinsRows = Object.entries(skins).map(([hole, result]) => ({
        round_id: round.id,
        hole_number: parseInt(hole),
        winner_player_id: result.winner !== 'No Winner' ? playerNameToId[result.winner] : null,
        winner_name: result.winner !== 'No Winner' ? result.winner : null,
      }));
      const { error: skinsError } = await supabase.from('skins_results').insert(skinsRows);
      if (skinsError) throw new Error('Skins insert failed: ' + skinsError.message);

      // 4. Recalculate and replace match_results (only if week_number is set)
      if (round.week_number) {
        await supabase.from('match_results').delete().eq('round_id', round.id);
        await recalcMatchPlay(round.id, round.week_number, players, section);
      }

      const matchNote = round.week_number ? ' and match results' : ' (no week # — match play skipped)';
      setMessage({ type: 'success', text: `Recalculated skins${matchNote} for "${round.file_name}"` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRecalculating(prev => ({ ...prev, [round.id]: false }));
    }
  }

  async function recalcMatchPlay(roundId, weekNumber, players, section) {
    const { data: matchups } = await supabase
      .from('schedule')
      .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
      .eq('week_number', weekNumber);

    if (!matchups || matchups.length === 0) return;

    const teamIds = matchups.flatMap(m => [m.team_a_id, m.team_b_id]);

    const { data: teamRosters } = await supabase
      .from('team_players')
      .select('team_id, player_id, players(name)')
      .in('team_id', teamIds);

    if (!teamRosters) return;

    const buildTeam = (teamId) => {
      const rosterPlayers = (teamRosters || [])
        .filter(r => r.team_id === teamId)
        .map(r => players.find(p => p.name === r.players.name))
        .filter(Boolean);
      return { players: rosterPlayers };
    };

    for (const matchup of matchups) {
      const teamA = buildTeam(matchup.team_a_id);
      const teamB = buildTeam(matchup.team_b_id);
      if (teamA.players.length < 2 || teamB.players.length < 2) continue;

      const result = calculateMatchPlay(teamA, teamB, section);

      await supabase.from('match_results').insert({
        round_id: roundId,
        schedule_id: matchup.id,
        week_number: weekNumber,
        team_a_id: matchup.team_a_id,
        team_b_id: matchup.team_b_id,
        low_match_winner: result.lowMatch.winner === 'A' ? matchup.team_a_id : result.lowMatch.winner === 'B' ? matchup.team_b_id : null,
        high_match_winner: result.highMatch.winner === 'A' ? matchup.team_a_id : result.highMatch.winner === 'B' ? matchup.team_b_id : null,
        team_point_winner: result.teamPoint.winner === 'A' ? matchup.team_a_id : result.teamPoint.winner === 'B' ? matchup.team_b_id : null,
        team_a_points: result.points.teamA,
        team_b_points: result.points.teamB,
        low_match_detail: result.lowMatch,
        high_match_detail: result.highMatch,
        team_point_detail: result.teamPoint,
      });
    }
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-journal-text me-2 text-matador-red"></i>Round Log</h5>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="bg-matador-black text-white">
              <tr>
                <th>File</th>
                <th>Date Played</th>
                <th>Week #</th>
                <th>Holes</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rounds.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No rounds uploaded yet.</td></tr>
              )}
              {rounds.map(r => {
                const isEditing = !!editing[r.id];
                const isSaving = !!saving[r.id];
                const isRecalculating = !!recalculating[r.id];
                const edit = editing[r.id] || {};

                return (
                  <tr key={r.id}>
                    <td className="fw-semibold">{r.file_name}</td>
                    <td>
                      {isEditing
                        ? <input type="date" className="form-control form-control-sm" style={{ minWidth: 140 }}
                            value={edit.played_date}
                            onChange={e => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], played_date: e.target.value } }))} />
                        : r.played_date || '—'}
                    </td>
                    <td>
                      {isEditing
                        ? <input type="number" className="form-control form-control-sm" style={{ width: 80 }}
                            value={edit.week_number}
                            min="1"
                            onChange={e => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], week_number: e.target.value } }))} />
                        : r.week_number ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${r.holes_played === 'front' ? 'bg-success' : 'bg-primary'}`}>
                        {r.holes_played === 'front' ? 'Front 9' : 'Back 9'}
                      </span>
                    </td>
                    <td className="text-muted small">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      {isEditing ? (
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-matador" onClick={() => saveEdit(r)} disabled={isSaving}>
                            {isSaving ? <span className="spinner-border spinner-border-sm"></span> : 'Save'}
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => cancelEdit(r.id)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => recalculateRound(r)}
                            disabled={isRecalculating}
                            title="Recalculate skins and match results using current handicap rules"
                          >
                            {isRecalculating
                              ? <span className="spinner-border spinner-border-sm"></span>
                              : <><i className="bi bi-arrow-clockwise me-1"></i>Recalc</>}
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => startEdit(r)}>
                            <i className="bi bi-pencil me-1"></i>Edit
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRound(r)}>
                            <i className="bi bi-trash me-1"></i>Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
