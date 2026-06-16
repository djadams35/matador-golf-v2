import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { strokesReceived, getHoleHandicaps, formatHandicap } from '../../utils/handicapUtils';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PlayerLeaderboards() {
  const [data, setData] = useState(null);
  const [matchResults, setMatchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('net');
  const [roundModal, setRoundModal] = useState(null); // { playerName, roundId, roundInfo }
  const [modalScores, setModalScores] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [sosModal, setSosModal] = useState(null); // { playerName, rows }

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    const { data: rosterRows } = await supabase
      .from('team_players')
      .select('players(name)')
      .eq('is_sub', false);

    const rosterNames = new Set(
      (rosterRows || []).map(r => r.players?.name).filter(Boolean)
    );

    const { data: scores } = await supabase
      .from('player_scores')
      .select('player_id, hole_number, gross_score, full_handicap, players(name), rounds(holes_played, played_date, par_scores, week_number)')
      .order('rounds(played_date)');

    if (!scores) { setLoading(false); return; }

    const playerStats = {};

    scores.forEach(row => {
      if (!row.players || !row.rounds) return;
      const name = row.players.name;
      if (!rosterNames.has(name)) return;
      const section = row.rounds.holes_played;
      const holeIndex = section === 'front' ? row.hole_number - 1 : row.hole_number - 10;
      const parScores = row.rounds.par_scores;
      const par = parScores ? parScores[holeIndex] : null;

      if (!playerStats[name]) {
        playerStats[name] = {
          name,
          playerId: row.player_id,
          rounds: 0,
          grossScores: [], netScores: [],
          roundDetails: [],
          grossEagles: 0, grossBirdies: 0, grossPars: 0,
          netEagles: 0, netBirdies: 0, netPars: 0,
          netToParSum: 0, holesGraded: 0,
          netToParByWeek: {},
          bestGross: null, bestNet: null,
          bestGrossRoundId: null, bestNetRoundId: null,
          bestGrossRoundInfo: null, bestNetRoundInfo: null,
          hcHistory: {},
          netByWeek: {},
        };
      }

      if (row.rounds.week_number != null) {
        playerStats[name].hcHistory[row.rounds.week_number] = row.full_handicap;
      }

      if (par !== null) {
        const holeHandicaps = getHoleHandicaps(section);
        const strokes = strokesReceived(row.full_handicap, holeHandicaps[holeIndex]);
        const netScore = row.gross_score - strokes;

        const grossDiff = row.gross_score - par;
        if (grossDiff <= -2) playerStats[name].grossEagles++;
        else if (grossDiff === -1) playerStats[name].grossBirdies++;
        else if (grossDiff === 0) playerStats[name].grossPars++;

        const netDiff = netScore - par;
        if (netDiff <= -2) playerStats[name].netEagles++;
        else if (netDiff === -1) playerStats[name].netBirdies++;
        else if (netDiff === 0) playerStats[name].netPars++;

        // Net-to-par accumulation — measures performance vs handicap
        playerStats[name].netToParSum += netDiff;
        playerStats[name].holesGraded += 1;
        if (row.rounds.week_number != null) {
          const wk = row.rounds.week_number;
          playerStats[name].netToParByWeek[wk] = (playerStats[name].netToParByWeek[wk] || 0) + netDiff;
        }
      }
    });

    const { data: netTotals } = await supabase
      .from('round_net_totals')
      .select('player_id, round_id, net_total, gross_total, players(name), rounds(week_number, played_date, holes_played)');

    if (netTotals) {
      netTotals.forEach(row => {
        if (!row.players) return;
        const name = row.players.name;
        if (!playerStats[name] || !rosterNames.has(name)) return;
        playerStats[name].grossScores.push(row.gross_total);
        playerStats[name].netScores.push(row.net_total);
        playerStats[name].rounds++;
        if (row.rounds?.week_number != null) {
          playerStats[name].netByWeek[row.rounds.week_number] = row.net_total;
        }
        playerStats[name].roundDetails.push({
          roundId: row.round_id,
          gross: row.gross_total,
          net: row.net_total,
          weekNum: row.rounds?.week_number,
          date: row.rounds?.played_date,
          holesPlayed: row.rounds?.holes_played,
        });
      });
    }

    Object.values(playerStats).forEach(p => {
      if (p.roundDetails.length > 0) {
        const bestNetDetail   = p.roundDetails.reduce((b, r) => r.net   < b.net   ? r : b);
        const bestGrossDetail = p.roundDetails.reduce((b, r) => r.gross < b.gross ? r : b);
        p.bestNet            = bestNetDetail.net;
        p.bestGross          = bestGrossDetail.gross;
        p.bestNetRoundId     = bestNetDetail.roundId;
        p.bestGrossRoundId   = bestGrossDetail.roundId;
        p.bestNetRoundInfo   = bestNetDetail;
        p.bestGrossRoundInfo = bestGrossDetail;
        p.avgGross = (p.grossScores.reduce((a, b) => a + b, 0) / p.grossScores.length).toFixed(1);
        p.avgNet   = (p.netScores.reduce((a, b) => a + b, 0)   / p.netScores.length).toFixed(1);
      }
    });

    const { data: matchRows } = await supabase
      .from('match_results')
      .select('week_number, low_match_detail, high_match_detail');
    setMatchResults(matchRows || []);

    setData(Object.values(playerStats).filter(p => p.rounds > 0));
    setLoading(false);
  }

  async function openRoundDetail(player, roundId, roundInfo) {
    setRoundModal({ playerName: player.name, roundId, roundInfo });
    setModalScores([]);
    setModalLoading(true);
    const { data: scores } = await supabase
      .from('player_scores')
      .select('hole_number, gross_score, full_handicap, rounds(holes_played, par_scores)')
      .eq('player_id', player.playerId)
      .eq('round_id', roundId)
      .order('hole_number');
    setModalScores(scores || []);
    setModalLoading(false);
  }

  // Build the per-opponent breakdown for a player's strength-of-schedule modal
  function openSosBreakdown(playerName) {
    const statByName = {};
    (data || []).forEach(p => { statByName[p.name] = p; });
    const rows = [];
    matchResults.forEach(row => {
      [row.low_match_detail, row.high_match_detail].forEach(d => {
        if (!d || !d.playerA || !d.playerB) return;
        let opponent = null;
        if (d.playerA === playerName) opponent = d.playerB;
        else if (d.playerB === playerName) opponent = d.playerA;
        else return;
        const oppStat = statByName[opponent];
        const wk = row.week_number;
        rows.push({
          week: wk,
          opponent,
          oppNet: oppStat?.netByWeek?.[wk] ?? null,
          oppVsPar: oppStat?.netToParByWeek?.[wk] ?? null, // negative = under net par (played well)
        });
      });
    });
    rows.sort((a, b) => (b.week ?? -1) - (a.week ?? -1));
    setSosModal({ playerName, rows });
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  if (!data || data.length === 0) return <div className="alert alert-info">No data yet. Upload rounds to see leaderboards.</div>;

  // ── Sorting ────────────────────────────────────────────────────────────────
  const byBestGross   = [...data].filter(p => p.bestGross !== null).sort((a, b) => a.bestGross - b.bestGross);
  const byBestNet     = [...data].filter(p => p.bestNet !== null).sort((a, b) => a.bestNet - b.bestNet);
  const byAvgGross    = [...data].filter(p => p.avgGross).sort((a, b) => parseFloat(a.avgGross) - parseFloat(b.avgGross));
  const byAvgNet      = [...data].filter(p => p.avgNet).sort((a, b) => parseFloat(a.avgNet) - parseFloat(b.avgNet));
  const byGrossEagles = [...data].filter(p => p.grossEagles > 0).sort((a, b) => b.grossEagles - a.grossEagles);
  const byGrossBirds  = [...data].filter(p => p.grossBirdies > 0).sort((a, b) => b.grossBirdies - a.grossBirdies);
  const byGrossPars   = [...data].filter(p => p.grossPars > 0).sort((a, b) => b.grossPars - a.grossPars);
  const byNetEagles   = [...data].filter(p => p.netEagles > 0).sort((a, b) => b.netEagles - a.netEagles);
  const byNetBirds    = [...data].filter(p => p.netBirdies > 0).sort((a, b) => b.netBirdies - a.netBirdies);
  const byNetPars     = [...data].filter(p => p.netPars > 0).sort((a, b) => b.netPars - a.netPars);

  // ── Handicap tracker ───────────────────────────────────────────────────────
  const hcChanges = data
    .filter(p => Object.keys(p.hcHistory).length >= 1)
    .map(p => {
      const weeks = Object.keys(p.hcHistory).map(Number).sort((a, b) => a - b);
      const startWeek = weeks[0];
      const currentWeek = weeks[weeks.length - 1];
      const startHC = p.hcHistory[startWeek];
      const currentHC = p.hcHistory[currentWeek];
      const change = startHC - currentHC;
      return { name: p.name, startWeek, startHC, currentWeek, currentHC, change };
    })
    .sort((a, b) => b.change - a.change);

  // ── Power rankings (last 3 weeks) ──────────────────────────────────────────
  const allWeekNums = [...new Set(
    data.flatMap(p => Object.keys(p.netByWeek).map(Number))
  )].sort((a, b) => b - a);
  const last3Weeks = allWeekNums.slice(0, 3);

  // Compute a sorted power ranking for a given rolling window of weeks.
  const computeRankings = (weekList) => {
    if (weekList.length === 0) return [];
    const matchPts = {};
    matchResults
      .filter(r => weekList.includes(r.week_number))
      .forEach(row => {
        [row.low_match_detail, row.high_match_detail].forEach(detail => {
          if (!detail) return;
          const { playerA, playerB, winner } = detail;
          if (matchPts[playerA] === undefined) matchPts[playerA] = 0;
          if (matchPts[playerB] === undefined) matchPts[playerB] = 0;
          if (winner === 'A') matchPts[playerA] += 1;
          else if (winner === 'B') matchPts[playerB] += 1;
          else { matchPts[playerA] += 0.5; matchPts[playerB] += 0.5; }
        });
      });

    const raw = data
      .map(p => {
        const weekScores = weekList.map(w => p.netByWeek[w]).filter(s => s !== undefined);
        if (weekScores.length === 0) return null;
        const avgNet = parseFloat((weekScores.reduce((a, b) => a + b, 0) / weekScores.length).toFixed(1));
        const totalPts = matchPts[p.name] || 0;
        return { name: p.name, weeksPlayed: weekScores.length, avgNet, totalPts };
      })
      .filter(Boolean);

    if (raw.length === 0) return [];
    const nets = raw.map(p => p.avgNet);
    const pts  = raw.map(p => p.totalPts);
    const minNet = Math.min(...nets), maxNet = Math.max(...nets);
    const minPts = Math.min(...pts),  maxPts = Math.max(...pts);

    return raw
      .map(p => {
        const netNorm = maxNet === minNet ? 0.5 : (maxNet - p.avgNet) / (maxNet - minNet);
        const ptsNorm = maxPts === minPts ? 0.5 : (p.totalPts - minPts) / (maxPts - minPts);
        const rating  = Math.round((netNorm + ptsNorm) / 2 * 100);
        return { ...p, rating };
      })
      .sort((a, b) => b.rating - a.rating);
  };

  // Previous-week ranking uses the 3-week window shifted back one week, to show movement
  const prevRankings = computeRankings(allWeekNums.slice(1, 4));
  const prevPos = {};
  prevRankings.forEach((p, i) => { prevPos[p.name] = i + 1; });
  const hasPrevRankings = prevRankings.length > 0;

  const powerRankings = computeRankings(last3Weeks).map((p, i) => {
    const prev = prevPos[p.name];
    return {
      ...p,
      posChange: prev != null ? prev - (i + 1) : null, // positive = moved up
      isNew: hasPrevRankings && prev == null,
    };
  });

  // ── Strength of Schedule ───────────────────────────────────────────────────
  // Based on how each opponent actually played in the round they faced you:
  // strokes they beat their net par by that week, averaged over all matchups.
  // Higher = you caught opponents playing above their handicaps (tougher schedule).
  const encounters = {};  // name -> [{ opponent, week }]
  matchResults.forEach(row => {
    [row.low_match_detail, row.high_match_detail].forEach(d => {
      if (!d || !d.playerA || !d.playerB) return;
      if (!encounters[d.playerA]) encounters[d.playerA] = [];
      if (!encounters[d.playerB]) encounters[d.playerB] = [];
      encounters[d.playerA].push({ opponent: d.playerB, week: row.week_number });
      encounters[d.playerB].push({ opponent: d.playerA, week: row.week_number });
    });
  });

  const rosterNameSet = new Set(data.map(p => p.name));
  const statByName = {};
  data.forEach(p => { statByName[p.name] = p; });

  const strengthOfSchedule = Object.keys(encounters)
    .filter(n => rosterNameSet.has(n))
    .map(n => {
      const encs = encounters[n]
        .map(e => {
          const oppStat = statByName[e.opponent];
          const netToPar = oppStat?.netToParByWeek?.[e.week];
          const oppNet = oppStat?.netByWeek?.[e.week];
          return { beatHc: netToPar != null ? -netToPar : null, oppNet };
        })
        .filter(e => e.beatHc != null);
      if (encs.length === 0) return null;
      const oppPerf = encs.reduce((a, e) => a + e.beatHc, 0) / encs.length;
      const nets = encs.map(e => e.oppNet).filter(v => v != null);
      const avgOppNet = nets.length ? (nets.reduce((a, b) => a + b, 0) / nets.length).toFixed(1) : null;
      return {
        name: n,
        matches: encs.length,
        oppPerf: Math.round(oppPerf * 10) / 10,
        avgOppNet,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.oppPerf - a.oppPerf);

  // ── Total match points won (season) ────────────────────────────────────────
  const seasonMatchPts = {};
  matchResults.forEach(row => {
    [row.low_match_detail, row.high_match_detail].forEach(d => {
      if (!d || !d.playerA || !d.playerB) return;
      const { playerA, playerB, winner } = d;
      if (seasonMatchPts[playerA] === undefined) seasonMatchPts[playerA] = 0;
      if (seasonMatchPts[playerB] === undefined) seasonMatchPts[playerB] = 0;
      if (winner === 'A') seasonMatchPts[playerA] += 1;
      else if (winner === 'B') seasonMatchPts[playerB] += 1;
      else { seasonMatchPts[playerA] += 0.5; seasonMatchPts[playerB] += 0.5; }
    });
  });

  const byPointsWon = data
    .map(p => ({ ...p, pointsWon: seasonMatchPts[p.name] || 0 }))
    .sort((a, b) => b.pointsWon - a.pointsWon || a.name.localeCompare(b.name));

  // ── Round detail modal content ─────────────────────────────────────────────
  const section   = modalScores[0]?.rounds?.holes_played;
  const parScores = modalScores[0]?.rounds?.par_scores;
  const hcApplied = modalScores[0]?.full_handicap;

  const holeRows = modalScores.map(row => {
    const holeIndex   = section === 'front' ? row.hole_number - 1 : row.hole_number - 10;
    const par         = parScores ? parScores[holeIndex] : null;
    const holeHcaps   = getHoleHandicaps(section);
    const strokes     = holeHcaps ? strokesReceived(row.full_handicap, holeHcaps[holeIndex]) : 0;
    const net         = row.gross_score - strokes;
    const netDiff     = par !== null ? net - par : null;
    return { hole: row.hole_number, par, gross: row.gross_score, strokes, net, netDiff };
  });

  const grossTotal = holeRows.reduce((s, r) => s + r.gross, 0);
  const netTotal   = holeRows.reduce((s, r) => s + r.net, 0);
  const parTotal   = parScores ? parScores.reduce((s, p) => s + p, 0) : null;

  function diffBadge(diff) {
    if (diff === null) return null;
    if (diff <= -2) return <span className="badge bg-warning text-dark">Eagle</span>;
    if (diff === -1) return <span className="badge bg-success">Birdie</span>;
    if (diff === 0)  return <span className="badge bg-secondary">Par</span>;
    if (diff === 1)  return <span className="badge bg-danger">Bogey</span>;
    return <span className="badge bg-danger">+{diff}</span>;
  }

  // ── Sub-component ──────────────────────────────────────────────────────────
  function LeaderTable({ title, rows, valueKey, label, icon, onScoreClick, limit = 10 }) {
    return (
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">
          <h6 className="mb-0">{icon && <i className={`bi ${icon} me-2`}></i>}{title}</h6>
        </div>
        <div className="card-body p-0">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr><th>#</th><th>Player</th><th className="text-center">{label}</th></tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={3} className="text-muted text-center py-3">No data yet</td></tr>
                : rows.slice(0, limit).map((p, i) => (
                  <tr key={p.name} className={i === 0 ? 'table-matador-success' : ''}>
                    <td>{i + 1}</td>
                    <td className="fw-semibold">{p.name}</td>
                    <td className="text-center fw-bold">
                      {onScoreClick && p[valueKey] != null ? (
                        <button
                          className="btn btn-link p-0 fw-bold text-dark"
                          style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
                          onClick={() => onScoreClick(p)}
                        >
                          {p[valueKey]}
                        </button>
                      ) : (
                        p[valueKey]
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>

      {/* ── Strength of Schedule breakdown modal ── */}
      {sosModal && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setSosModal(null)}
        >
          <div className="modal-dialog modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-matador-black text-white">
                <div>
                  <h5 className="modal-title mb-0">{sosModal.playerName}</h5>
                  <div className="text-white-50 small">Opponents faced — how they scored vs their handicap that week</div>
                </div>
                <button className="btn-close btn-close-white ms-auto" onClick={() => setSosModal(null)}></button>
              </div>
              <div className="modal-body p-0">
                {sosModal.rows.length === 0 ? (
                  <div className="p-4 text-muted">No opponent data found.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Week</th>
                          <th>Opponent</th>
                          <th className="text-center">Opp Net</th>
                          <th className="text-center pe-3">vs HC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sosModal.rows.map((r, idx) => {
                          const beat = r.oppVsPar != null ? -r.oppVsPar : null; // positive = beat their handicap
                          return (
                            <tr key={idx}>
                              <td className="ps-3">{r.week != null ? `Week ${r.week}` : '—'}</td>
                              <td className="fw-semibold">{r.opponent}</td>
                              <td className="text-center">{r.oppNet != null ? r.oppNet : '—'}</td>
                              <td className={`text-center fw-bold pe-3 ${beat > 0 ? 'text-success' : beat < 0 ? 'text-danger' : ''}`}>
                                {beat != null ? `${beat > 0 ? '+' : ''}${beat}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <span className="text-muted small me-auto">
                  vs HC = strokes the opponent beat their net par by that round. <span className="text-success">Green</span> = they played above their handicap.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Round detail modal ── */}
      {roundModal && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setRoundModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-scrollable modal-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-matador-black text-white">
                <div>
                  <h5 className="modal-title mb-0">{roundModal.playerName}</h5>
                  <div className="text-white-50 small">
                    {roundModal.roundInfo?.weekNum != null && `Week ${roundModal.roundInfo.weekNum} · `}
                    {formatDate(roundModal.roundInfo?.date)}
                    {roundModal.roundInfo?.holesPlayed && ` · ${roundModal.roundInfo.holesPlayed === 'front' ? 'Front 9' : 'Back 9'}`}
                    {hcApplied != null && ` · HC ${hcApplied}`}
                  </div>
                </div>
                <button
                  className="btn-close btn-close-white ms-auto"
                  onClick={() => setRoundModal(null)}
                ></button>
              </div>
              <div className="modal-body p-0">
                {modalLoading ? (
                  <div className="text-center py-5">
                    <span className="spinner-border text-matador-red"></span>
                  </div>
                ) : holeRows.length === 0 ? (
                  <div className="p-4 text-muted">No hole-by-hole data found for this round.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="text-center">Hole</th>
                          <th className="text-center">Par</th>
                          <th className="text-center">Gross</th>
                          <th className="text-center">Strokes</th>
                          <th className="text-center">Net</th>
                          <th className="text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holeRows.map(r => (
                          <tr key={r.hole}>
                            <td className="text-center fw-semibold">{r.hole}</td>
                            <td className="text-center text-muted">{r.par ?? '—'}</td>
                            <td className="text-center">{r.gross}</td>
                            <td className="text-center text-muted">{r.strokes > 0 ? `+${r.strokes}` : '—'}</td>
                            <td className="text-center fw-bold">{r.net}</td>
                            <td className="text-center">{diffBadge(r.netDiff)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light fw-bold">
                        <tr>
                          <td className="text-center">Total</td>
                          <td className="text-center text-muted">{parTotal ?? '—'}</td>
                          <td className="text-center">{grossTotal}</td>
                          <td></td>
                          <td className="text-center text-matador-red">{netTotal}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Power Rankings + Handicap Tracker ── */}
      {(hcChanges.length > 0 || powerRankings.length > 0) && (
        <div className="row g-4 mb-4">
          {powerRankings.length > 0 && (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center">
                  <h6 className="mb-0"><i className="bi bi-fire me-2 text-warning"></i>Power Rankings — Last {last3Weeks.length} Week{last3Weeks.length > 1 ? 's' : ''}</h6>
                  <span className="text-muted small">Wk {[...last3Weeks].sort((a,b)=>a-b).join(', ')}</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Player</th>
                        <th className="text-center">Rating</th>
                        <th className="text-center">Avg Net</th>
                        <th className="text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {powerRankings.map((p, i) => (
                        <tr key={p.name} className={i === 0 ? 'table-warning' : ''}>
                          <td className="text-nowrap">
                            {i === 0 ? '🔥' : i + 1}
                            {p.isNew ? (
                              <span className="ms-1 small text-primary">NEW</span>
                            ) : p.posChange != null && p.posChange !== 0 ? (
                              <span className={`ms-1 small fw-bold ${p.posChange > 0 ? 'text-success' : 'text-danger'}`}>
                                {p.posChange > 0 ? `▲${p.posChange}` : `▼${Math.abs(p.posChange)}`}
                              </span>
                            ) : p.posChange === 0 ? (
                              <span className="ms-1 small text-muted">–</span>
                            ) : null}
                          </td>
                          <td className="fw-semibold">{p.name}</td>
                          <td className="text-center fw-bold">{p.rating}</td>
                          <td className="text-center text-muted small">{p.avgNet}</td>
                          <td className="text-center text-muted small">{p.totalPts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                <div className="card-footer text-muted small">Rating = avg net + total match pts, normalized 0–100 &nbsp;·&nbsp; <span className="text-success">▲</span>/<span className="text-danger">▼</span> = position change vs last week</div>
              </div>
            </div>
          )}

          {hcChanges.length > 0 && (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-matador-black text-white">
                  <h6 className="mb-0"><i className="bi bi-graph-down-arrow me-2"></i>Handicap Tracker</h6>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Player</th>
                        <th className="text-center">Wk {hcChanges[0]?.startWeek} HC</th>
                        <th className="text-center">Current HC</th>
                        <th className="text-center">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hcChanges.map(p => (
                        <tr key={p.name}>
                          <td className="fw-semibold">{p.name}</td>
                          <td className="text-center text-muted">{formatHandicap(p.startHC)}</td>
                          <td className="text-center fw-bold">{formatHandicap(p.currentHC)}</td>
                          <td className="text-center fw-bold">
                            {p.change === 0
                              ? <span className="text-muted">—</span>
                              : p.change > 0
                                ? <span className="text-success">▼ {p.change}</span>
                                : <span className="text-danger">▲ {Math.abs(p.change)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                <div className="card-footer text-muted small">▼ = improved &nbsp;·&nbsp; ▲ = higher handicap</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Total Match Points Won ── */}
      {byPointsWon.length > 0 && (
        <div className="row g-4 mb-4">
          <div className="col-12">
            <LeaderTable
              title="Total Match Points Won (Season)"
              rows={byPointsWon}
              valueKey="pointsWon"
              label="Points"
              icon="bi-trophy-fill"
              limit={byPointsWon.length}
            />
          </div>
        </div>
      )}

      {/* ── Strength of Schedule ── */}
      {strengthOfSchedule.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-matador-black text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0"><i className="bi bi-shield-shaded me-2 text-warning"></i>Strength of Schedule</h6>
            <span className="text-muted small">Opponents who beat their handicaps</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th className="text-center">Opp vs HC</th>
                    <th className="text-center">Avg Opp Net</th>
                    <th className="text-center">Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {strengthOfSchedule.slice(0, 10).map((p, i) => (
                    <tr key={p.name} className={i === 0 ? 'table-warning' : ''}>
                      <td>{i === 0 ? '💪' : i + 1}</td>
                      <td className="fw-semibold">
                        <button
                          className="btn btn-link p-0 fw-semibold text-dark text-start"
                          style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
                          onClick={() => openSosBreakdown(p.name)}
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className={`text-center fw-bold ${p.oppPerf > 0 ? 'text-success' : p.oppPerf < 0 ? 'text-danger' : ''}`}>
                        {p.oppPerf > 0 ? '+' : ''}{p.oppPerf.toFixed(1)}
                      </td>
                      <td className="text-center text-muted small">{p.avgOppNet ?? '—'}</td>
                      <td className="text-center text-muted small">{p.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer text-muted small">
            Opp vs HC = avg strokes your opponents beat their net par by in the rounds they played you. Higher = caught opponents playing above their handicaps. Click a name for the breakdown.
          </div>
        </div>
      )}

      {/* ── Net / Gross toggle ── */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <span className="text-muted small fw-semibold">View:</span>
        <div className="btn-group btn-group-sm">
          <button
            className={`btn ${view === 'net' ? 'btn-matador' : 'btn-outline-secondary'}`}
            onClick={() => setView('net')}
          >
            Net
          </button>
          <button
            className={`btn ${view === 'gross' ? 'btn-matador' : 'btn-outline-secondary'}`}
            onClick={() => setView('gross')}
          >
            Gross
          </button>
        </div>
      </div>

      {view === 'net' && (
        <>
          <div className="row g-4 mb-4">
            <div className="col-12 col-md-6">
              <LeaderTable
                title="Best Single Round — Net"
                rows={byBestNet}
                valueKey="bestNet"
                label="Net Score"
                icon="bi-star-fill"
                onScoreClick={p => openRoundDetail(p, p.bestNetRoundId, p.bestNetRoundInfo)}
              />
            </div>
            <div className="col-12 col-md-6">
              <LeaderTable title="Season Avg Net" rows={byAvgNet} valueKey="avgNet" label="Avg Net" icon="bi-bar-chart-fill" />
            </div>
          </div>
          <div className="row g-4">
            <div className="col-12 col-md-4">
              <LeaderTable title="Eagles (Net)" rows={byNetEagles} valueKey="netEagles" label="Eagles" icon="bi-star-fill" />
            </div>
            <div className="col-12 col-md-4">
              <LeaderTable title="Birdies (Net)" rows={byNetBirds} valueKey="netBirdies" label="Birdies" icon="bi-arrow-down-circle-fill" />
            </div>
            <div className="col-12 col-md-4">
              <LeaderTable title="Pars (Net)" rows={byNetPars} valueKey="netPars" label="Pars" icon="bi-check-circle-fill" />
            </div>
          </div>
        </>
      )}

      {view === 'gross' && (
        <>
          <div className="row g-4 mb-4">
            <div className="col-12 col-md-6">
              <LeaderTable
                title="Best Single Round — Gross"
                rows={byBestGross}
                valueKey="bestGross"
                label="Score"
                icon="bi-star-fill"
                onScoreClick={p => openRoundDetail(p, p.bestGrossRoundId, p.bestGrossRoundInfo)}
              />
            </div>
            <div className="col-12 col-md-6">
              <LeaderTable title="Season Avg Gross" rows={byAvgGross} valueKey="avgGross" label="Avg" icon="bi-bar-chart-fill" />
            </div>
          </div>
          <div className="row g-4">
            <div className="col-12 col-md-4">
              <LeaderTable title="Eagles (Gross)" rows={byGrossEagles} valueKey="grossEagles" label="Eagles" icon="bi-star-fill" />
            </div>
            <div className="col-12 col-md-4">
              <LeaderTable title="Birdies (Gross)" rows={byGrossBirds} valueKey="grossBirdies" label="Birdies" icon="bi-arrow-down-circle-fill" />
            </div>
            <div className="col-12 col-md-4">
              <LeaderTable title="Pars (Gross)" rows={byGrossPars} valueKey="grossPars" label="Pars" icon="bi-check-circle-fill" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
