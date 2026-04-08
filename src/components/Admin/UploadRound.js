import React, { useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { parseRoundCSV } from '../../utils/csvParser';
import { calculateSkins } from '../../utils/skinsCalculator';
import { calculateMatchPlay } from '../../utils/matchPlayCalculator';
import { totalNetScore, getHoleHandicaps } from '../../utils/handicapUtils';

export default function UploadRound() {
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'warning'|'info', message }
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState(null); // preview before confirming
  const [weekOverride, setWeekOverride] = useState('');
  const [roundDate, setRoundDate] = useState('');

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setStatus({ type: 'error', message: 'Please upload a .csv file.' });
      return;
    }

    setStatus({ type: 'info', message: 'Reading file...' });

    // ── Step 1: Check for duplicate in Supabase Storage ──────────────────────
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

    // ── Step 2: Parse the CSV ─────────────────────────────────────────────────
    try {
      const result = await parseRoundCSV(file);
      setParsed({ file, ...result });
      setStatus({ type: 'info', message: `Parsed ${result.players.length} players. Review below, then click "Save Round".` });
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
      const { file, section, players } = parsed;

      // ── 1. Upload raw CSV to Supabase Storage ─────────────────────────────
      const storagePath = `rounds/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('round-csvs')
        .upload(storagePath, file);
      if (uploadError) throw new Error('Storage upload failed: ' + uploadError.message);

      // ── 2. Upsert players into the players table ───────────────────────────
      const playerUpserts = players.map(p => ({ name: p.name }));
      const { data: upsertedPlayers, error: playerError } = await supabase
        .from('players')
        .upsert(playerUpserts, { onConflict: 'name' })
        .select();
      if (playerError) throw new Error('Player upsert failed: ' + playerError.message);

      const playerMap = {};
      upsertedPlayers.forEach(p => { playerMap[p.name] = p.id; });

      // ── 3. Insert round record ─────────────────────────────────────────────
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .insert({
          file_name: file.name,
          storage_path: storagePath,
          holes_played: section,
          played_date: roundDate || null,
          week_number: weekOverride ? parseInt(weekOverride) : null,
        })
        .select()
        .single();
      if (roundError) throw new Error('Round insert failed: ' + roundError.message);

      // ── 4. Insert hole-by-hole scores ──────────────────────────────────────
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

      // ── 5. Calculate and save skins ────────────────────────────────────────
      const skins = calculateSkins(players, section);
      const skinsRows = Object.entries(skins).map(([hole, result]) => ({
        round_id: round.id,
        hole_number: parseInt(hole),
        winner_player_id: result.winner !== 'No Winner' ? playerMap[result.winner] : null,
        winner_name: result.winner !== 'No Winner' ? result.winner : null,
      }));
      const { error: skinsError } = await supabase.from('skins_results').insert(skinsRows);
      if (skinsError) throw new Error('Skins insert failed: ' + skinsError.message);

      // ── 6. Calculate and save weekly low net (Degens) ─────────────────────
      const holeHandicaps = getHoleHandicaps(section);
      const degenRows = players.map(p => ({
        round_id: round.id,
        player_id: playerMap[p.name],
        net_total: totalNetScore(p.scores, p.fullHandicap, holeHandicaps),
        gross_total: p.scores.reduce((a, b) => a + b, 0),
      }));
      const { error: netError } = await supabase.from('round_net_totals').insert(degenRows);
      if (netError) throw new Error('Net totals insert failed: ' + netError.message);

      // ── 7. Calculate match play if week is known ───────────────────────────
      if (weekOverride) {
        await calculateAndSaveMatchPlay(round.id, parseInt(weekOverride), players, section, playerMap);
      }

      setStatus({ type: 'success', message: `✅ Round saved! ${players.length} players, ${section} 9.` });
      setParsed(null);
      setWeekOverride('');
      setRoundDate('');
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function calculateAndSaveMatchPlay(roundId, weekNumber, players, section, playerMap) {
    // Look up the schedule for this week
    const { data: schedule } = await supabase
      .from('schedule')
      .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
      .eq('week_number', weekNumber)
      .single();

    if (!schedule) return; // No schedule entry — skip match play

    // Look up team rosters
    const { data: teamRosters } = await supabase
      .from('team_players')
      .select('team_id, player_id, players(name)')
      .in('team_id', [schedule.team_a_id, schedule.team_b_id]);

    if (!teamRosters || teamRosters.length < 4) return;

    const buildTeam = (teamId) => {
      const rosterPlayers = teamRosters
        .filter(r => r.team_id === teamId)
        .map(r => players.find(p => p.name === r.players.name))
        .filter(Boolean);
      return { players: rosterPlayers };
    };

    const teamA = buildTeam(schedule.team_a_id);
    const teamB = buildTeam(schedule.team_b_id);

    if (teamA.players.length < 2 || teamB.players.length < 2) return;

    const result = calculateMatchPlay(teamA, teamB, section);

    await supabase.from('match_results').insert({
      round_id: roundId,
      schedule_id: schedule.id,
      week_number: weekNumber,
      team_a_id: schedule.team_a_id,
      team_b_id: schedule.team_b_id,
      low_match_winner: result.lowMatch.winner === 'A' ? schedule.team_a_id : result.lowMatch.winner === 'B' ? schedule.team_b_id : null,
      high_match_winner: result.highMatch.winner === 'A' ? schedule.team_a_id : result.highMatch.winner === 'B' ? schedule.team_b_id : null,
      team_point_winner: result.teamPoint.winner === 'A' ? schedule.team_a_id : result.teamPoint.winner === 'B' ? schedule.team_b_id : null,
      team_a_points: result.points.teamA,
      team_b_points: result.points.teamB,
      low_match_detail: result.lowMatch,
      high_match_detail: result.highMatch,
      team_point_detail: result.teamPoint,
    });
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-cloud-upload me-2 text-matador-red"></i>Upload Weekly Round</h5>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Round Date</label>
          <input
            type="date"
            className="form-control"
            value={roundDate}
            onChange={e => setRoundDate(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Week # <span className="text-muted fw-normal">(optional — needed for match play)</span></label>
          <input
            type="number"
            className="form-control"
            placeholder="e.g. 5"
            value={weekOverride}
            onChange={e => setWeekOverride(e.target.value)}
            min="1"
          />
        </div>
      </div>

      <div
        className={`upload-zone p-5 text-center mb-4 ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
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

      {parsed && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-matador-black text-white">
            <strong>Preview — {parsed.players.length} players, {parsed.section === 'front' ? 'Front 9 (holes 1-9)' : 'Back 9 (holes 10-18)'}</strong>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Player</th>
                    <th>Team #</th>
                    <th>Handicap</th>
                    <th>Total Gross</th>
                  </tr>
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
            <button className="btn btn-outline-secondary" onClick={() => { setParsed(null); setStatus(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
