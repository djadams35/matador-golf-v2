import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { parseRoundCSV } from '../../utils/csvParser';
import { calculateSkins } from '../../utils/skinsCalculator';
import { calculateMatchPlay } from '../../utils/matchPlayCalculator';

export default function UploadRound() {
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [weekOverride, setWeekOverride] = useState('');
  const [roundDate, setRoundDate] = useState('');
  const [permanentRoster, setPermanentRoster] = useState([]); // { id, name, teamId }
  const [subAssignments, setSubAssignments] = useState({}); // playerName -> originalPlayerId
  const [unassignedPlayers, setUnassignedPlayers] = useState([]);

  useEffect(() => {
    supabase
      .from('team_players')
      .select('player_id, team_id, players(name)')
      .eq('is_sub', false)
      .then(({ data }) => {
        if (data) {
          setPermanentRoster(
            data
              .filter(r => r.players?.name)
              .map(r => ({ id: r.player_id, name: r.players.name, teamId: r.team_id }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        }
      });
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setStatus({ type: 'error', message: 'Please upload a .csv file.' });
      return;
    }

    setStatus({ type: 'info', message: 'Reading file...' });

    // Check for duplicate in Supabase Storage
    const { data: existing, error: listError } = await supabase.storage
      .from('round-csvs')
      .list('rounds', { search: file.name });

    if (listError) {
      setStatus({ type: 'error', message: 'Could not check for duplicates: ' + listError.message });
      return;
    }

    if (existing && existing.length > 0) {
      setStatus({
        type: 'warning',
        message: `⚠️ A file named "${file.name}" has already been uploaded. Are you sure this is a new round? If so, rename the file and try again.`,
      });
      return;
    }

    try {
      const result = await parseRoundCSV(file);

      // Find which players aren't on any permanent team roster
      const { data: allRosters } = await supabase
        .from('team_players')
        .select('player_id, players(name)')
        .eq('is_sub', false);

      const assignedNames = new Set(
        (allRosters || []).map(r => r.players?.name).filter(Boolean)
      );

      const unassigned = result.players.filter(p => !assignedNames.has(p.name));
      setUnassignedPlayers(unassigned);

      const assignments = {};
      unassigned.forEach(p => { assignments[p.name] = ''; });
      setSubAssignments(assignments);

      setParsed({ file, ...result });
      setStatus({
        type: unassigned.length > 0 ? 'warning' : 'info',
        message: unassigned.length > 0
          ? `Parsed ${result.players.length} players. ${unassigned.length} player(s) are not on any team roster — assign them below before saving.`
          : `Parsed ${result.players.length} players. Review below, then click "Save Round".`
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  async function saveRound() {
    if (!parsed) return;
    setUploading(true);
    setStatus({ type: 'info', message: 'Saving...' });

    try {
      const { file, section, players, parScores } = parsed;

      // ── 1. Upload raw CSV to Supabase Storage ─────────────────────────────
      const storagePath = `rounds/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('round-csvs')
        .upload(storagePath, file);
      if (uploadError) throw new Error('Storage upload failed: ' + uploadError.message);

      // ── 2. Upsert players ──────────────────────────────────────────────────
      const playerUpserts = players.map(p => ({ name: p.name }));
      const { data: upsertedPlayers, error: playerError } = await supabase
        .from('players')
        .upsert(playerUpserts, { onConflict: 'name' })
        .select();
      if (playerError) throw new Error('Player upsert failed: ' + playerError.message);

      const playerMap = {};
      upsertedPlayers.forEach(p => { playerMap[p.name] = p.id; });

      // ── 3. Temporarily add subs to their original player's team for match play
      const tempSubEntries = []; // track for cleanup
      for (const [playerName, originalPlayerId] of Object.entries(subAssignments)) {
        if (!originalPlayerId || !playerMap[playerName]) continue;
        const rosterEntry = permanentRoster.find(r => r.id === originalPlayerId);
        if (!rosterEntry) continue;
        await supabase.from('team_players').upsert({
          team_id: rosterEntry.teamId,
          player_id: playerMap[playerName],
          is_sub: true,
        }, { onConflict: 'team_id,player_id' });
        tempSubEntries.push({ teamId: rosterEntry.teamId, playerId: playerMap[playerName] });
      }

      // ── 4. Insert round record ─────────────────────────────────────────────
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .insert({
          file_name: file.name,
          storage_path: storagePath,
          holes_played: section,
          played_date: roundDate || null,
          week_number: weekOverride ? parseInt(weekOverride) : null,
          par_scores: parScores || null,
        })
        .select()
        .single();
      if (roundError) throw new Error('Round insert failed: ' + roundError.message);

      // ── 4b. Save sub-to-player mappings ───────────────────────────────────
      const subRows = [];
      for (const [playerName, originalPlayerId] of Object.entries(subAssignments)) {
        if (!originalPlayerId || !playerMap[playerName]) continue;
        subRows.push({
          round_id: round.id,
          sub_player_id: playerMap[playerName],
          original_player_id: originalPlayerId,
        });
      }
      if (subRows.length > 0) {
        const { error: subError } = await supabase.from('round_subs').insert(subRows);
        if (subError) throw new Error('Sub mapping insert failed: ' + subError.message);
      }

      // ── 5. Insert hole-by-hole scores ──────────────────────────────────────
      const scoreRows = [];
      players.forEach(player => {
        player.scores.forEach((gross, i) => {
          const holeNumber = section === 'front' ? i + 1 : i + 10;
          scoreRows.push({
            round_id: round.id,
            player_id: playerMap[player.name],
            hole_number: holeNumber,
            gross_score: gross,
            full_handicap: player.fullHandicap,
          });
        });
      });
      const { error: scoresError } = await supabase.from('player_scores').insert(scoreRows);
      if (scoresError) throw new Error('Scores insert failed: ' + scoresError.message);

      // ── 6. Calculate and save skins ────────────────────────────────────────
      const skins = calculateSkins(players, section);
      const skinsRows = Object.entries(skins).map(([hole, result]) => ({
        round_id: round.id,
        hole_number: parseInt(hole),
        winner_player_id: result.winner !== 'No Winner' ? playerMap[result.winner] : null,
        winner_name: result.winner !== 'No Winner' ? result.winner : null,
      }));
      const { error: skinsError } = await supabase.from('skins_results').insert(skinsRows);
      if (skinsError) throw new Error('Skins insert failed: ' + skinsError.message);

      // ── 7. Calculate and save net totals ──────────────────────────────────
      const degenRows = players.map(p => {
        const grossTotal = p.scores.reduce((a, b) => a + b, 0);
        return {
          round_id: round.id,
          player_id: playerMap[p.name],
          gross_total: grossTotal,
          net_total: grossTotal - p.fullHandicap,
        };
      });
      const { error: netError } = await supabase.from('round_net_totals').insert(degenRows);
      if (netError) throw new Error('Net totals insert failed: ' + netError.message);

      // ── 8. Calculate match play if week is known ───────────────────────────
      if (weekOverride) {
        await calculateAndSaveMatchPlay(round.id, parseInt(weekOverride), players, section, playerMap);
      }

      // ── 9. Remove temp sub team_player records (keep roster clean) ─────────
      for (const { teamId, playerId } of tempSubEntries) {
        await supabase.from('team_players')
          .delete()
          .eq('team_id', teamId)
          .eq('player_id', playerId)
          .eq('is_sub', true);
      }

      setStatus({ type: 'success', message: `✅ Round saved! ${players.length} players, ${section} 9.` });
      setParsed(null);
      setUnassignedPlayers([]);
      setSubAssignments({});
      setWeekOverride('');
      setRoundDate('');
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function calculateAndSaveMatchPlay(roundId, weekNumber, players, section, playerMap) {
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
      const rosterEntries = (teamRosters || [])
        .filter(r => r.team_id === teamId)
        .map(r => players.find(p => p.name === r.players.name))
        .filter(Boolean);
      return { players: rosterEntries };
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

  // Players in the current round who can't be subbed for (they're already playing)
  const playingNames = new Set((parsed?.players || []).map(p => p.name));

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-cloud-upload me-2 text-matador-red"></i>Upload Weekly Round</h5>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Round Date</label>
          <input type="date" className="form-control" value={roundDate} onChange={e => setRoundDate(e.target.value)} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Week # <span className="text-muted fw-normal">(needed for match play)</span></label>
          <input type="number" className="form-control" placeholder="e.g. 5" value={weekOverride}
            onChange={e => setWeekOverride(e.target.value)} min="1" />
        </div>
      </div>

      <div
        className={`upload-zone p-5 text-center mb-4 ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      >
        <i className="bi bi-cloud-upload fs-1 text-matador-red mb-3 d-block"></i>
        <p className="mb-2 fw-semibold">Drag and drop your CSV file here</p>
        <p className="text-muted mb-3">Export from Golf League Guru → Reports → Round Scores → Export CSV</p>
        <label className="btn btn-matador">
          Choose File
          <input type="file" accept=".csv" onChange={handleChange} className="d-none" />
        </label>
      </div>

      {status && (
        <div className={`alert alert-${status.type === 'success' ? 'success' : status.type === 'error' ? 'danger' : status.type === 'warning' ? 'warning' : 'info'} mb-4`}>
          {status.message}
        </div>
      )}

      {/* Sub assignment step */}
      {unassignedPlayers.length > 0 && parsed && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-warning text-dark">
            <strong><i className="bi bi-person-fill-exclamation me-2"></i>Sub Players — Who are they subbing for?</strong>
          </div>
          <div className="card-body">
            <p className="text-muted small mb-3">
              These players aren't on any permanent roster. Select the player they're replacing this week.
              If they're a degen sub, their score will count in Weekly Low Net in place of the absent player.
            </p>
            {unassignedPlayers.map(p => (
              <div key={p.name} className="row g-2 align-items-center mb-2">
                <div className="col-12 col-md-4">
                  <span className="fw-semibold">{p.name}</span>
                  <span className="text-muted ms-2 small">HC: {p.fullHandicap}</span>
                </div>
                <div className="col-12 col-md-5">
                  <select
                    className="form-select form-select-sm"
                    value={subAssignments[p.name] || ''}
                    onChange={e => setSubAssignments(prev => ({ ...prev, [p.name]: e.target.value }))}
                  >
                    <option value="">Not subbing for anyone</option>
                    {permanentRoster
                      .filter(r => !playingNames.has(r.name))
                      .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-matador-black text-white">
            <strong>Preview — {parsed.players.length} players, {parsed.section === 'front' ? 'Front 9 (holes 1-9)' : 'Back 9 (holes 10-18)'}</strong>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr><th>Player</th><th>Team #</th><th>Handicap</th><th>Total Gross</th></tr>
                </thead>
                <tbody>
                  {parsed.players.map(p => (
                    <tr key={p.name}>
                      <td className="fw-semibold">{p.name}</td>
                      <td>{p.teamNumber ?? '—'}</td>
                      <td>{p.fullHandicap}</td>
                      <td>{p.scores.reduce((a, b) => a + b, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer d-flex gap-2">
            <button className="btn btn-matador" onClick={saveRound} disabled={uploading}>
              {uploading ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-check-circle me-1"></i>Save Round</>}
            </button>
            <button className="btn btn-outline-secondary" onClick={() => { setParsed(null); setStatus(null); setUnassignedPlayers([]); setSubAssignments({}); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
