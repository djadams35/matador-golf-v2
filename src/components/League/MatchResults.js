import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getHoleHandicaps, formatHandicap } from '../../utils/handicapUtils';

function HoleTable({ playerA, playerB, scoreMap, section, aTeamName, bTeamName }) {
  const holeHandicaps = getHoleHandicaps(section);

  // Pre-calculate all hole results so we can build running score
  let runningScore = 0; // positive = A leads, negative = B leads

  const aFirstName = playerA ? playerA.split(' ')[0] : '';
  const bFirstName = playerB ? playerB.split(' ')[0] : '';
  const aHandicap = scoreMap[playerA] ? Object.values(scoreMap[playerA])[0]?.fullHandicap : null;
  const bHandicap = scoreMap[playerB] ? Object.values(scoreMap[playerB])[0]?.fullHandicap : null;

  // Match play uses handicap difference method:
  // the higher-HC player receives (diff) strokes on the diff hardest holes.
  const hcDiff = aHandicap !== null && bHandicap !== null ? aHandicap - bHandicap : 0;
  const absDiff = Math.abs(hcDiff) % 1 !== 0 ? Math.ceil(Math.abs(hcDiff)) : Math.abs(hcDiff);

  const holes = [...Array(9)].map((_, i) => {
    const holeNumber = section === 'front' ? i + 1 : i + 10;
    const si = holeHandicaps[i];
    const aScore = scoreMap[playerA]?.[i];
    const bScore = scoreMap[playerB]?.[i];
    const aStrokes = hcDiff > 0 && si <= absDiff ? 1 : 0;
    const bStrokes = hcDiff < 0 && si <= absDiff ? 1 : 0;
    const aNet = aScore != null ? aScore.gross - aStrokes : null;
    const bNet = bScore != null ? bScore.gross - bStrokes : null;
    const winner = aNet !== null && bNet !== null
      ? aNet < bNet ? 'A' : bNet < aNet ? 'B' : 'tie'
      : null;
    if (winner === 'A') runningScore++;
    else if (winner === 'B') runningScore--;
    const snap = runningScore;
    return { holeNumber, si, aScore, bScore, aNet, bNet, aStrokes, bStrokes, winner, runningScore: snap };
  });

  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead className="table-light">
          <tr>
            <th>Hole</th>
            <th className="text-center text-muted">Hole HC</th>
            <th className="text-center">
              {playerA}
              {aHandicap !== null && <div className="fw-normal text-muted small">HC {formatHandicap(aHandicap)}</div>}
            </th>
            <th className="text-center">
              {playerB}
              {bHandicap !== null && <div className="fw-normal text-muted small">HC {formatHandicap(bHandicap)}</div>}
            </th>
            <th className="text-center">Result</th>
            <th className="text-center">Match</th>
          </tr>
        </thead>
        <tbody>
          {holes.map(({ holeNumber, si, aScore, bScore, aNet, bNet, aStrokes, bStrokes, winner, runningScore: rs }) => {
            const leadName = rs > 0 ? aFirstName : rs < 0 ? bFirstName : null;
            const matchLabel = rs === 0 ? 'AS' : `${leadName} ${Math.abs(rs)} UP`;
            const matchClass = rs > 0 ? 'text-danger fw-bold' : rs < 0 ? 'text-primary fw-bold' : 'text-muted';

            return (
              <tr key={holeNumber}>
                <td className="fw-semibold">{holeNumber}</td>
                <td className="text-center text-muted small">{si}</td>
                <td className={`text-center ${winner === 'A' ? 'fw-bold table-danger' : ''}`}>
                  {aScore != null ? (
                    <>{aStrokes > 0 && <span className="text-danger me-1" title="Receives stroke">●</span>}{aScore.gross} ({aNet})</>
                  ) : '—'}
                </td>
                <td className={`text-center ${winner === 'B' ? 'fw-bold table-primary' : ''}`}>
                  {bScore != null ? (
                    <>{bStrokes > 0 && <span className="text-danger me-1" title="Receives stroke">●</span>}{bScore.gross} ({bNet})</>
                  ) : '—'}
                </td>
                <td className="text-center">
                  {winner === 'A' && <span className="badge badge-matador">{playerA}</span>}
                  {winner === 'B' && <span className="badge bg-primary">{playerB}</span>}
                  {winner === 'tie' && <span className="text-muted small">Tied</span>}
                </td>
                <td className={`text-center small ${matchClass}`}>{matchLabel}</td>
              </tr>
            );
          })}
        </tbody>
        <caption className="caption-top pt-2 pb-1 text-muted small">
          <span className="text-danger me-1">●</span> Player receives a stroke on this hole &nbsp;·&nbsp; Score format: Gross (Net)
        </caption>
        <tfoot>
          <tr className="table-dark">
            <td colSpan={4} className="fw-bold">
              {runningScore === 0
                ? 'All Square'
                : runningScore > 0
                  ? <><span className="badge badge-matador me-2">{aTeamName} wins</span>{aFirstName} {runningScore} UP</>
                  : <><span className="badge bg-primary me-2">{bTeamName} wins</span>{bFirstName} {Math.abs(runningScore)} UP</>}
            </td>
            <td className="text-center fw-bold">Final</td>
            <td className={`text-center fw-bold ${runningScore > 0 ? 'text-danger' : runningScore < 0 ? 'text-primary' : 'text-muted'}`}>
              {runningScore === 0 ? 'AS' : runningScore > 0 ? `${runningScore} UP` : `${Math.abs(runningScore)} DN`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function MatchResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  useEffect(() => { fetchResults(); }, []);

  async function fetchResults() {
    setLoading(true);
    const { data, error } = await supabase
      .from('match_results')
      .select(`
        *,
        team_a:teams!team_a_id(name),
        team_b:teams!team_b_id(name),
        rounds(played_date, holes_played)
      `)
      .order('week_number', { ascending: false });
    if (!error) setResults(data || []);
    setLoading(false);
  }

  async function toggleDetails(result) {
    if (expanded[result.id]) {
      setExpanded(prev => { const n = { ...prev }; delete n[result.id]; return n; });
      return;
    }

    setLoadingDetails(prev => ({ ...prev, [result.id]: true }));

    const section = result.rounds?.holes_played || 'front';
    const low = result.low_match_detail || {};
    const high = result.high_match_detail || {};
    const playerNames = [low.playerA, low.playerB, high.playerA, high.playerB].filter(Boolean);

    const { data: playerRows } = await supabase
      .from('players')
      .select('id, name')
      .in('name', playerNames);

    if (!playerRows) {
      setLoadingDetails(prev => ({ ...prev, [result.id]: false }));
      return;
    }

    const playerIdToName = {};
    playerRows.forEach(p => { playerIdToName[p.id] = p.name; });
    const playerIds = playerRows.map(p => p.id);

    const { data: scores } = await supabase
      .from('player_scores')
      .select('player_id, hole_number, gross_score, full_handicap')
      .eq('round_id', result.round_id)
      .in('player_id', playerIds);

    const scoreMap = {};
    (scores || []).forEach(s => {
      const name = playerIdToName[s.player_id];
      if (!name) return;
      if (!scoreMap[name]) scoreMap[name] = {};
      const holeIndex = section === 'front' ? s.hole_number - 1 : s.hole_number - 10;
      scoreMap[name][holeIndex] = { gross: s.gross_score, fullHandicap: s.full_handicap };
    });

    setExpanded(prev => ({ ...prev, [result.id]: { scoreMap, section } }));
    setLoadingDetails(prev => ({ ...prev, [result.id]: false }));
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  if (results.length === 0) return <div className="alert alert-info">No match results yet. Upload rounds with a week number to see results here.</div>;

  return (
    <div>
      {results.map(r => {
        const low = r.low_match_detail || {};
        const high = r.high_match_detail || {};
        const team = r.team_point_detail || {};
        const aName = r.team_a?.name;
        const bName = r.team_b?.name;
        const details = expanded[r.id];
        const isLoadingDetail = loadingDetails[r.id];

        return (
          <div className="card border-0 shadow-sm mb-3" key={r.id}>
            <div className="card-header bg-matador-black text-white d-flex justify-content-between">
              <span>{aName} vs {bName}{r.week_number ? ` — Week ${r.week_number}` : ''}{r.rounds?.played_date ? ` — ${r.rounds.played_date}` : ''}</span>
              <span className="badge bg-light text-dark">
                {r.rounds?.holes_played === 'front' ? 'Front 9' : 'Back 9'}
              </span>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="text-center">
                  <div className="fw-bold fs-5 text-matador-red">{aName}</div>
                  <div className="display-6 fw-bold text-matador-red">{r.team_a_points}</div>
                  <div className="text-muted small">points</div>
                </div>
                <div className="text-center text-muted">vs</div>
                <div className="text-center">
                  <div className="fw-bold fs-5 text-primary">{bName}</div>
                  <div className="display-6 fw-bold text-primary">{r.team_b_points}</div>
                  <div className="text-muted small">points</div>
                </div>
              </div>

              <table className="table table-sm table-bordered mb-0">
                <thead className="table-light">
                  <tr><th>Match</th><th>Players</th><th className="text-center">Result</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-semibold text-nowrap">Low HC Match</td>
                    <td className="small">
                      {low.playerA}{details?.scoreMap[low.playerA] ? ` (HC ${formatHandicap(Object.values(details.scoreMap[low.playerA])[0]?.fullHandicap)})` : ''} vs {low.playerB}{details?.scoreMap[low.playerB] ? ` (HC ${formatHandicap(Object.values(details.scoreMap[low.playerB])[0]?.fullHandicap)})` : ''}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${low.winner === 'A' ? 'badge-matador' : low.winner === 'B' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                        {low.winner === 'A' ? low.playerA : low.winner === 'B' ? low.playerB : 'Tie'}
                      </span>
                      <span className="text-muted small ms-1">{low.winner === 'tie' ? '+0.5 each' : '+1'}</span>
                      <div className="text-muted small">{low.aHolesWon}–{low.bHolesWon} ({low.halved} tied)</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-nowrap">High HC Match</td>
                    <td className="small">
                      {high.playerA}{details?.scoreMap[high.playerA] ? ` (HC ${formatHandicap(Object.values(details.scoreMap[high.playerA])[0]?.fullHandicap)})` : ''} vs {high.playerB}{details?.scoreMap[high.playerB] ? ` (HC ${formatHandicap(Object.values(details.scoreMap[high.playerB])[0]?.fullHandicap)})` : ''}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${high.winner === 'A' ? 'badge-matador' : high.winner === 'B' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                        {high.winner === 'A' ? high.playerA : high.winner === 'B' ? high.playerB : 'Tie'}
                      </span>
                      <span className="text-muted small ms-1">{high.winner === 'tie' ? '+0.5 each' : '+1'}</span>
                      <div className="text-muted small">{high.aHolesWon}–{high.bHolesWon} ({high.halved} tied)</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-nowrap">Team Net</td>
                    <td className="small text-muted">{team.teamANet} vs {team.teamBNet}</td>
                    <td className="text-center">
                      <span className={`badge ${team.winner === 'A' ? 'badge-matador' : team.winner === 'B' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                        {team.winner === 'A' ? aName : team.winner === 'B' ? bName : 'Tie'}
                      </span>
                      <span className="text-muted small ms-1">{team.winner === 'tie' ? '+0.5 each' : '+1'}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <button
                className="btn btn-sm btn-outline-secondary mt-3 w-100"
                onClick={() => toggleDetails(r)}
              >
                {isLoadingDetail
                  ? <span className="spinner-border spinner-border-sm me-1"></span>
                  : <i className={`bi bi-chevron-${details ? 'up' : 'down'} me-1`}></i>}
                {details ? 'Hide' : 'View'} Hole by Hole
              </button>

              {details && (
                <div className="mt-3">
                  <div className="fw-semibold small text-muted mb-1 text-uppercase">
                    Low HC — {low.playerA} vs {low.playerB}
                  </div>
                  <HoleTable
                    playerA={low.playerA} playerB={low.playerB}
                    scoreMap={details.scoreMap} section={details.section}
                    aTeamName={aName} bTeamName={bName}
                  />
                  <div className="fw-semibold small text-muted mb-1 mt-3 text-uppercase">
                    High HC — {high.playerA} vs {high.playerB}
                  </div>
                  <HoleTable
                    playerA={high.playerA} playerB={high.playerB}
                    scoreMap={details.scoreMap} section={details.section}
                    aTeamName={aName} bTeamName={bName}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
