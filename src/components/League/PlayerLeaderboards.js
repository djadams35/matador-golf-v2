import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { strokesReceived, getHoleHandicaps, formatHandicap } from '../../utils/handicapUtils';

export default function PlayerLeaderboards() {
  const [data, setData] = useState(null);
  const [matchResults, setMatchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('net');

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
          name, rounds: 0,
          grossScores: [], netScores: [],
          grossEagles: 0, grossBirdies: 0, grossPars: 0,
          netEagles: 0, netBirdies: 0, netPars: 0,
          bestGross: null, bestNet: null,
          hcHistory: {},   // weekNum -> handicap
          netByWeek: {},   // weekNum -> net total (filled from round_net_totals)
        };
      }

      // Track handicap per week (all holes in a round have the same value — just overwrite)
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
      }
    });

    const { data: netTotals } = await supabase
      .from('round_net_totals')
      .select('player_id, net_total, gross_total, players(name), rounds(week_number)');

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
      });
    }

    Object.values(playerStats).forEach(p => {
      if (p.grossScores.length > 0) {
        p.bestGross = Math.min(...p.grossScores);
        p.bestNet = Math.min(...p.netScores);
        p.avgGross = (p.grossScores.reduce((a, b) => a + b, 0) / p.grossScores.length).toFixed(1);
        p.avgNet = (p.netScores.reduce((a, b) => a + b, 0) / p.netScores.length).toFixed(1);
      }
    });

    const { data: matchRows } = await supabase
      .from('match_results')
      .select('week_number, low_match_detail, high_match_detail');
    setMatchResults(matchRows || []);

    setData(Object.values(playerStats).filter(p => p.rounds > 0));
    setLoading(false);
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  if (!data || data.length === 0) return <div className="alert alert-info">No data yet. Upload rounds to see leaderboards.</div>;

  // ── Sorting for toggle-dependent tables ────────────────────────────────────
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
      const change = startHC - currentHC; // positive = improved (HC went down)
      return { name: p.name, startWeek, startHC, currentWeek, currentHC, change };
    })
    .sort((a, b) => b.change - a.change); // most improved first

  // ── Power rankings (last 3 weeks) ──────────────────────────────────────────
  const allWeekNums = [...new Set(
    data.flatMap(p => Object.keys(p.netByWeek).map(Number))
  )].sort((a, b) => b - a);
  const last3Weeks = allWeekNums.slice(0, 3);

  // Individual match points earned in the last 3 weeks
  const playerMatchPts = {};
  matchResults
    .filter(r => last3Weeks.includes(r.week_number))
    .forEach(row => {
      [row.low_match_detail, row.high_match_detail].forEach(detail => {
        if (!detail) return;
        const { playerA, playerB, winner } = detail;
        if (playerMatchPts[playerA] === undefined) playerMatchPts[playerA] = 0;
        if (playerMatchPts[playerB] === undefined) playerMatchPts[playerB] = 0;
        if (winner === 'A') playerMatchPts[playerA] += 1;
        else if (winner === 'B') playerMatchPts[playerB] += 1;
        else { playerMatchPts[playerA] += 0.5; playerMatchPts[playerB] += 0.5; }
      });
    });

  // Build raw stats per player
  const prRaw = data
    .map(p => {
      const weekScores = last3Weeks.map(w => p.netByWeek[w]).filter(s => s !== undefined);
      if (weekScores.length === 0) return null;
      const avgNet = parseFloat((weekScores.reduce((a, b) => a + b, 0) / weekScores.length).toFixed(1));
      const totalPts = playerMatchPts[p.name] || 0;
      return { name: p.name, weeksPlayed: weekScores.length, avgNet, totalPts };
    })
    .filter(Boolean);

  // Normalize both metrics to 0–1 and combine 50/50
  // Net: lower is better → invert. Points: higher is better → keep.
  const nets = prRaw.map(p => p.avgNet);
  const pts  = prRaw.map(p => p.totalPts);
  const minNet = Math.min(...nets), maxNet = Math.max(...nets);
  const minPts = Math.min(...pts),  maxPts = Math.max(...pts);

  const powerRankings = prRaw
    .map(p => {
      const netNorm = maxNet === minNet ? 0.5 : (maxNet - p.avgNet) / (maxNet - minNet);
      const ptsNorm = maxPts === minPts ? 0.5 : (p.totalPts - minPts) / (maxPts - minPts);
      const rating  = Math.round((netNorm + ptsNorm) / 2 * 100);
      return { ...p, rating };
    })
    .sort((a, b) => b.rating - a.rating);

  function LeaderTable({ title, rows, valueKey, label, icon }) {
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
                : rows.slice(0, 10).map((p, i) => (
                  <tr key={p.name} className={i === 0 ? 'table-matador-success' : ''}>
                    <td>{i + 1}</td>
                    <td className="fw-semibold">{p.name}</td>
                    <td className="text-center fw-bold">{p[valueKey]}</td>
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

      {/* ── Handicap Tracker + Power Rankings side by side ── */}
      {(hcChanges.length > 0 || powerRankings.length > 0) && (
        <div className="row g-4 mb-4">
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
                </div>
                <div className="card-footer text-muted small">▼ = improved &nbsp;·&nbsp; ▲ = higher handicap</div>
              </div>
            </div>
          )}

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
                          <td>{i === 0 ? '🔥' : i + 1}</td>
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
                </div>
                <div className="card-footer text-muted small">Rating = avg net + total match pts, normalized 0–100</div>
              </div>
            </div>
          )}
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
              <LeaderTable title="Best Single Round — Net" rows={byBestNet} valueKey="bestNet" label="Net Score" icon="bi-star-fill" />
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
              <LeaderTable title="Best Single Round — Gross" rows={byBestGross} valueKey="bestGross" label="Score" icon="bi-star-fill" />
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
