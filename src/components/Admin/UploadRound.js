import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { parseRoundCSV } from '../../utils/csvParser';
import { calculateSkins } from '../../utils/skinsCalculator';
import { calculateMatchPlay, calculateMatchPlayNoShow } from '../../utils/matchPlayCalculator';

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
  const [tiedMatchups, setTiedMatchups] = useState([]); // matchups where a team has equal HCs
  const [matchupPairings, setMatchupPairings] = useState({}); // scheduleId -> { aLow, aHigh, bLow, bHigh }
  const [noShowCandidates, setNoShowCandidates] = useState([]); // roster players missing from the CSV
  const [noShows, setNoShows] = useState({}); // playerName -> { confirmed, opponentName }
  const [reupload, setReupload] = useState(null); // { roundId, storagePath, fileName, weekNumber, roundDate, subs }
  const reuploadRef = useRef(null);     // mirror for use inside handleFile/saveRound
  const prefillSubsRef = useRef([]);    // [{ subName, originalPlayerId }] to re-apply on parse

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

    // Re-upload mode: a round was sent here from the Round Log to be replaced.
    let ctx = null;
    const raw = sessionStorage.getItem('reuploadContext');
    if (raw) {
      try { ctx = JSON.parse(raw); } catch { ctx = null; }
      sessionStorage.removeItem('reuploadContext');
    }
    if (ctx) {
      setReupload(ctx);
      reuploadRef.current = ctx;
      prefillSubsRef.current = ctx.subs || [];
      if (ctx.weekNumber != null) setWeekOverride(String(ctx.weekNumber));
      if (ctx.roundDate) setRoundDate(ctx.roundDate);
    } else {
      // Predict the next week from the most recently uploaded round (editable below)
      supabase
        .from('rounds')
        .select('week_number')
        .not('week_number', 'is', null)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.week_number != null) setWeekOverride(String(data.week_number + 1));
        });
    }
  }, []);

  useEffect(() => {
    if (!parsed || !weekOverride) {
      setTiedMatchups([]);
      setMatchupPairings({});
      return;
    }
    fetchTiedMatchups(parsed.players, parseInt(weekOverride));
  }, [parsed, weekOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!parsed || !weekOverride) {
      setNoShowCandidates([]);
      return;
    }
    detectNoShows(parsed.players, parseInt(weekOverride), subAssignments);
  }, [parsed, weekOverride, subAssignments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find roster players who aren't in the CSV and aren't covered by a sub — potential no-shows.
  async function detectNoShows(players, weekNumber, subs) {
    const { data: matchups } = await supabase
      .from('schedule')
      .select('id, team_a:teams!team_a_id(id,name), team_b:teams!team_b_id(id,name)')
      .eq('week_number', weekNumber);
    if (!matchups?.length) { setNoShowCandidates([]); return; }

    const teamIds = matchups.flatMap(m => [m.team_a.id, m.team_b.id]);
    const { data: rosters } = await supabase
      .from('team_players')
      .select('team_id, player_id, players(name)')
      .in('team_id', teamIds)
      .eq('is_sub', false);
    if (!rosters) { setNoShowCandidates([]); return; }

    const presentNames = new Set(players.map(p => p.name));
    const subbedOriginalIds = new Set(Object.values(subs).filter(Boolean));

    // The active player for a roster slot: the roster player if present, else their assigned sub
    const activeNameForRoster = (rosterEntry) => {
      const name = rosterEntry.players?.name;
      if (name && presentNames.has(name)) return name;
      const subEntry = Object.entries(subs).find(([sName, origId]) => origId === rosterEntry.player_id && sName);
      if (subEntry && presentNames.has(subEntry[0])) return subEntry[0];
      return null;
    };

    const candidates = [];
    for (const m of matchups) {
      const sides = [
        { id: m.team_a.id, name: m.team_a.name, oppId: m.team_b.id, oppName: m.team_b.name },
        { id: m.team_b.id, name: m.team_b.name, oppId: m.team_a.id, oppName: m.team_a.name },
      ];
      for (const side of sides) {
        const teamRoster = rosters.filter(r => r.team_id === side.id);
        const oppRoster  = rosters.filter(r => r.team_id === side.oppId);
        for (const r of teamRoster) {
          const name = r.players?.name;
          if (!name) continue;
          if (presentNames.has(name) || subbedOriginalIds.has(r.player_id)) continue;
          // Missing and not subbed → a no-show candidate
          const teammate = teamRoster
            .filter(o => o.player_id !== r.player_id)
            .map(activeNameForRoster)
            .find(Boolean) || null;
          const opponents = oppRoster.map(activeNameForRoster).filter(Boolean);
          candidates.push({
            playerName: name,
            scheduleId: m.id,
            teamId: side.id,
            teamName: side.name,
            opponentTeamName: side.oppName,
            teammate,
            opponents,
          });
        }
      }
    }
    setNoShowCandidates(candidates);
  }

  async function fetchTiedMatchups(players, weekNumber) {
    const sortByHCThenName = (arr) => [...arr].sort((a, b) => {
      const d = a.fullHandicap - b.fullHandicap;
      if (d !== 0) return d;
      return a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]);
    });

    const { data: matchups } = await supabase
      .from('schedule')
      .select('id, team_a:teams!team_a_id(id, name), team_b:teams!team_b_id(id, name)')
      .eq('week_number', weekNumber);
    if (!matchups?.length) return;

    const teamIds = matchups.flatMap(m => [m.team_a.id, m.team_b.id]);
    const { data: rosters } = await supabase
      .from('team_players')
      .select('team_id, player_id, players(name)')
      .in('team_id', teamIds)
      .eq('is_sub', false);

    const playerByName = {};
    players.forEach(p => { playerByName[p.name] = p; });

    const ties = [];
    const initialPairings = {};

    for (const matchup of matchups) {
      const getPlayers = (teamId) =>
        (rosters || [])
          .filter(r => r.team_id === teamId)
          .map(r => playerByName[r.players?.name])
          .filter(Boolean);

      const aPlayers = getPlayers(matchup.team_a.id);
      const bPlayers = getPlayers(matchup.team_b.id);
      if (aPlayers.length < 2 || bPlayers.length < 2) continue;

      const aSorted = sortByHCThenName(aPlayers);
      const bSorted = sortByHCThenName(bPlayers);
      const aTied = aSorted[0].fullHandicap === aSorted[1].fullHandicap;
      const bTied = bSorted[0].fullHandicap === bSorted[1].fullHandicap;

      if (aTied || bTied) {
        ties.push({
          scheduleId: matchup.id,
          teamAName: matchup.team_a.name,
          teamBName: matchup.team_b.name,
          aTied, bTied,
          aPlayers, bPlayers,
          aSorted: aSorted.map(p => p.name),
          bSorted: bSorted.map(p => p.name),
        });
        initialPairings[matchup.id] = {
          aLow: aSorted[0].name, aHigh: aSorted[1].name,
          bLow: bSorted[0].name, bHigh: bSorted[1].name,
        };
      }
    }

    setTiedMatchups(ties);
    setMatchupPairings(initialPairings);
  }

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setStatus({ type: 'error', message: 'Please upload a .csv file.' });
      return;
    }

    setStatus({ type: 'info', message: 'Reading file...' });

    // Duplicate guard — skipped during re-upload (we're intentionally replacing a round)
    if (!reuploadRef.current) {
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
      // Re-upload: pre-fill the sub assignments from the round being replaced
      (prefillSubsRef.current || []).forEach(ps => {
        if (assignments[ps.subName] !== undefined && ps.originalPlayerId) {
          assignments[ps.subName] = ps.originalPlayerId;
        }
      });
      setSubAssignments(assignments);

      setParsed({ file, ...result });
      const csvWarnings = result.warnings || [];
      const allWarnings = [
        ...csvWarnings,
        ...(unassigned.length > 0
          ? [`${unassigned.length} player(s) not on any team roster — assign them below before saving.`]
          : []),
      ];
      setStatus({
        type: allWarnings.length > 0 ? 'warning' : 'info',
        message: allWarnings.length > 0
          ? `Parsed ${result.players.length} players. Please review:\n• ${allWarnings.join('\n• ')}`
          : `Parsed ${result.players.length} players. Review below, then click "Save Round".`,
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
      const reuploadCtx = reuploadRef.current;

      // ── 0. Re-upload: remove the round being replaced and all its derived data
      if (reuploadCtx?.roundId) {
        const oldId = reuploadCtx.roundId;
        await supabase.from('match_results').delete().eq('round_id', oldId);
        await supabase.from('skins_results').delete().eq('round_id', oldId);
        await supabase.from('round_net_totals').delete().eq('round_id', oldId);
        await supabase.from('round_subs').delete().eq('round_id', oldId);
        await supabase.from('player_scores').delete().eq('round_id', oldId);
        await supabase.from('rounds').delete().eq('id', oldId);
        if (reuploadCtx.storagePath) {
          await supabase.storage.from('round-csvs').remove([reuploadCtx.storagePath]);
        }
      }

      // ── 1. Upload raw CSV to Supabase Storage ─────────────────────────────
      const storagePath = `rounds/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('round-csvs')
        .upload(storagePath, file, { upsert: true });
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
        const confirmedNoShows = noShowCandidates
          .filter(c => noShows[c.playerName]?.confirmed)
          .map(c => ({
            scheduleId: c.scheduleId,
            teamId: c.teamId,
            playerName: c.playerName,
            teammate: c.teammate,
            opponentName: noShows[c.playerName]?.opponentName || c.opponents[0] || null,
          }));
        await calculateAndSaveMatchPlay(round.id, parseInt(weekOverride), players, section, playerMap, matchupPairings, confirmedNoShows);
      }

      // ── 9. Remove temp sub team_player records (keep roster clean) ─────────
      for (const { teamId, playerId } of tempSubEntries) {
        await supabase.from('team_players')
          .delete()
          .eq('team_id', teamId)
          .eq('player_id', playerId)
          .eq('is_sub', true);
      }

      const wasReupload = !!reuploadCtx;
      setStatus({
        type: 'success',
        message: wasReupload
          ? `✅ Round re-uploaded and recalculated! ${players.length} players, ${section} 9.`
          : `✅ Round saved! ${players.length} players, ${section} 9.`,
      });
      setParsed(null);
      setUnassignedPlayers([]);
      setSubAssignments({});
      setNoShows({});
      setNoShowCandidates([]);
      setRoundDate('');
      if (wasReupload) {
        setReupload(null);
        reuploadRef.current = null;
        prefillSubsRef.current = [];
        // keep the same week shown (we replaced that week, not advanced)
      } else {
        setWeekOverride(weekOverride ? String(parseInt(weekOverride, 10) + 1) : '');
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function calculateAndSaveMatchPlay(roundId, weekNumber, players, section, playerMap, pairings = {}, noShowList = []) {
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

    const insertResult = (matchup, result) =>
      supabase.from('match_results').insert({
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

    for (const matchup of matchups) {
      const teamA = buildTeam(matchup.team_a_id);
      const teamB = buildTeam(matchup.team_b_id);

      const noShow = noShowList.find(ns => ns.scheduleId === matchup.id);
      if (noShow) {
        const noShowSide = noShow.teamId === matchup.team_a_id ? 'A' : 'B';
        const oppTeam = noShowSide === 'A' ? teamB : teamA;
        if (oppTeam.players.length < 2) continue; // can't score without an intact opponent
        const result = calculateMatchPlayNoShow(teamA, teamB, section, {
          noShowSide,
          showingPlayerName: noShow.teammate,
          chosenOpponentName: noShow.opponentName,
          noShowPlayerName: noShow.playerName,
        });
        await insertResult(matchup, result);
        continue;
      }

      if (teamA.players.length < 2 || teamB.players.length < 2) continue;

      const result = calculateMatchPlay(teamA, teamB, section, pairings[matchup.id] || null);
      await insertResult(matchup, result);
    }
  }

  // Players in the current round who can't be subbed for (they're already playing)
  const playingNames = new Set((parsed?.players || []).map(p => p.name));

  return (
    <div>
      <h5 className="fw-bold mb-3">
        <i className={`bi ${reupload ? 'bi-arrow-repeat' : 'bi-cloud-upload'} me-2 text-matador-red`}></i>
        {reupload ? 'Re-upload Round' : 'Upload Weekly Round'}
      </h5>

      {reupload && (
        <div className="alert alert-warning d-flex justify-content-between align-items-start gap-2 mb-4">
          <div>
            <strong><i className="bi bi-arrow-repeat me-1"></i>Re-uploading Week {reupload.weekNumber} </strong>
            (replacing <code>{reupload.fileName}</code>).
            <div className="small mt-1">
              Drop in the corrected CSV below. Your previous sub assignments are pre-filled, and no-shows are
              re-detected automatically — adjust anything, then Save. The old round is fully replaced and everything
              recalculates.
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-secondary flex-shrink-0"
            onClick={() => { setReupload(null); reuploadRef.current = null; prefillSubsRef.current = []; setParsed(null); setStatus(null); }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Round Date</label>
          <input type="date" className="form-control" value={roundDate} onChange={e => setRoundDate(e.target.value)} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold">Week # <span className="text-muted fw-normal">(auto-filled from last upload &mdash; edit if needed)</span></label>
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
                      .filter(r => !Object.entries(subAssignments).some(([otherName, id]) => id === r.id && otherName !== p.name))
                      .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No-show step */}
      {noShowCandidates.length > 0 && parsed && weekOverride && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-danger text-white">
            <strong><i className="bi bi-person-x me-2"></i>Possible No-Shows</strong>
          </div>
          <div className="card-body">
            <p className="text-muted small mb-3">
              These rostered players aren't in this round's scores and have no sub. Mark a no-show to forfeit
              their individual match and their team's net point. Their teammate still plays one live match —
              pick the opponent below.
            </p>
            {noShowCandidates.map(c => {
              const ns = noShows[c.playerName] || {};
              const confirmed = !!ns.confirmed;
              return (
                <div key={`${c.scheduleId}-${c.playerName}`} className="border rounded p-2 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`noshow-${c.scheduleId}-${c.playerName}`}
                      checked={confirmed}
                      onChange={e => setNoShows(prev => ({
                        ...prev,
                        [c.playerName]: {
                          confirmed: e.target.checked,
                          opponentName: prev[c.playerName]?.opponentName || c.opponents[0] || '',
                        },
                      }))}
                    />
                    <label className="form-check-label" htmlFor={`noshow-${c.scheduleId}-${c.playerName}`}>
                      <span className="fw-semibold">{c.playerName}</span>
                      <span className="text-muted small ms-2">{c.teamName} — no-show</span>
                    </label>
                  </div>
                  {confirmed && (
                    <div className="row g-2 align-items-center mt-1 ms-1">
                      <div className="col-12 col-md-auto small">
                        {c.teammate
                          ? <><span className="fw-semibold">{c.teammate}</span> plays against:</>
                          : <span className="text-danger">No teammate played — both individual points forfeit.</span>}
                      </div>
                      {c.teammate && (
                        <div className="col-12 col-md-5">
                          <select
                            className="form-select form-select-sm"
                            value={ns.opponentName || ''}
                            onChange={e => setNoShows(prev => ({
                              ...prev,
                              [c.playerName]: { confirmed: true, opponentName: e.target.value },
                            }))}
                          >
                            {c.opponents.length === 0 && <option value="">No opponent available</option>}
                            {c.opponents.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual matchup pairing for tied-HC teams */}
      {tiedMatchups.length > 0 && parsed && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-warning text-dark">
            <strong><i className="bi bi-shuffle me-2"></i>Tied Handicaps — Who plays the Low HC match?</strong>
          </div>
          <div className="card-body">
            <p className="text-muted small mb-3">
              Some teammates share the same handicap. Choose who plays the Low HC individual match for each pairing below.
            </p>
            {tiedMatchups.map(tm => {
              const pairing = matchupPairings[tm.scheduleId] || {};
              return (
                <div key={tm.scheduleId} className="mb-4">
                  <div className="fw-semibold mb-2">{tm.teamAName} vs {tm.teamBName}</div>
                  {tm.aTied && (
                    <div className="row g-2 align-items-center mb-2">
                      <div className="col-12 col-md-5 text-muted small">
                        {tm.teamAName} — Low HC match player:
                      </div>
                      <div className="col-12 col-md-5">
                        <select
                          className="form-select form-select-sm"
                          value={pairing.aLow || ''}
                          onChange={e => {
                            const chosen = e.target.value;
                            const other = tm.aPlayers.find(p => p.name !== chosen)?.name;
                            setMatchupPairings(prev => ({
                              ...prev,
                              [tm.scheduleId]: { ...prev[tm.scheduleId], aLow: chosen, aHigh: other },
                            }));
                          }}
                        >
                          {tm.aPlayers.map(p => (
                            <option key={p.name} value={p.name}>{p.name} (HC {p.fullHandicap})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-2 text-muted small">
                        High: {tm.aPlayers.find(p => p.name !== pairing.aLow)?.name || tm.aSorted[1]}
                      </div>
                    </div>
                  )}
                  {tm.bTied && (
                    <div className="row g-2 align-items-center mb-2">
                      <div className="col-12 col-md-5 text-muted small">
                        {tm.teamBName} — Low HC match player:
                      </div>
                      <div className="col-12 col-md-5">
                        <select
                          className="form-select form-select-sm"
                          value={pairing.bLow || ''}
                          onChange={e => {
                            const chosen = e.target.value;
                            const other = tm.bPlayers.find(p => p.name !== chosen)?.name;
                            setMatchupPairings(prev => ({
                              ...prev,
                              [tm.scheduleId]: { ...prev[tm.scheduleId], bLow: chosen, bHigh: other },
                            }));
                          }}
                        >
                          {tm.bPlayers.map(p => (
                            <option key={p.name} value={p.name}>{p.name} (HC {p.fullHandicap})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-2 text-muted small">
                        High: {tm.bPlayers.find(p => p.name !== pairing.bLow)?.name || tm.bSorted[1]}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
