import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { strokesReceived, getHoleHandicaps } from '../../utils/handicapUtils';

export default function PlayerLeaderboards() {
  const [data, setData] = useState(null);
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
      .select('player_id, hole_number, gross_score, full_handicap, players(name), rounds(holes_played, played_date, par_scores)')
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
        };
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
      .select('player_id, net_total, gross_total, players(name)');

    if (netTotals) {
      netTotals.forEach(row => {
        if (!row.players) return;
        const name = row.players.name;
        if (playerStats[name] && rosterNames.has(name)) {
          playerStats[name].grossScores.push(row.gross_total);
          playerStats[name].netScores.push(row.net_total);
          playerStats[name].rounds++;
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

    setData(Object.values(playerStats).filter(p => p.rounds > 0));
    setLoading(false);
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  if (!data || data.length === 0) return <div className="alert alert-info">No data yet. Upload rounds to see leaderboards.</div>;

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
      {/* Toggle */}
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
