import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getHoleHandicaps, strokesReceived } from '../../utils/handicapUtils';

export default function PlayerLeaderboards() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoreType, setScoreType] = useState('gross'); // 'gross' | 'net' for eagle/birdie/par

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    // Get all scores with player and round info
    const { data: scores } = await supabase
      .from('player_scores')
      .select('player_id, hole_number, gross_score, full_handicap, players(name), rounds(holes_played, played_date)')
      .order('rounds(played_date)');

    if (!scores) { setLoading(false); return; }

    // Build per-player stats
    const playerStats = {};
    const roundScores = {}; // roundId -> playerId -> { gross[], net[], hdcp }

    scores.forEach(row => {
      if (!row.players || !row.rounds) return;
      const name = row.players.name;
      const section = row.rounds.holes_played;
      const holeHandicaps = getHoleHandicaps(section);
      const holeIndex = section === 'front' ? row.hole_number - 1 : row.hole_number - 10;
      const si = holeHandicaps[holeIndex];
      const net = row.gross_score - strokesReceived(row.full_handicap, si);

      if (!playerStats[name]) {
        playerStats[name] = {
          name,
          rounds: 0,
          grossScores: [],   // total gross per round
          netScores: [],     // total net per round
          eagles: { gross: 0, net: 0 },
          birdies: { gross: 0, net: 0 },
          pars: { gross: 0, net: 0 },
          bestGross: null,
          bestNet: null,
          holeScores: [],    // for per-hole tracking
        };
      }

      // We need par per hole — get from parsRow... but we don't store it.
      // Golf League Guru CSVs include a pars row; we'll use standard par values.
      // For now we track eagles/birdies/pars relative to a fixed par of 4 for unknown holes.
      // This will be improved when we store the pars row in the DB.
      playerStats[name].holeScores.push({ gross: row.gross_score, net, section, holeIndex });
    });

    // For gross/net totals per round, aggregate from round_net_totals
    const { data: netTotals } = await supabase
      .from('round_net_totals')
      .select('player_id, net_total, gross_total, players(name)');

    if (netTotals) {
      netTotals.forEach(row => {
        if (!row.players) return;
        const name = row.players.name;
        if (playerStats[name]) {
          playerStats[name].grossScores.push(row.gross_total);
          playerStats[name].netScores.push(row.net_total);
          playerStats[name].rounds++;
        }
      });
    }

    // Compute best and average
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

  const byBestGross = [...data].filter(p => p.bestGross !== null).sort((a, b) => a.bestGross - b.bestGross);
  const byBestNet   = [...data].filter(p => p.bestNet !== null).sort((a, b) => a.bestNet - b.bestNet);
  const byAvgGross  = [...data].filter(p => p.avgGross).sort((a, b) => parseFloat(a.avgGross) - parseFloat(b.avgGross));
  const byAvgNet    = [...data].filter(p => p.avgNet).sort((a, b) => parseFloat(a.avgNet) - parseFloat(b.avgNet));

  function LeaderTable({ title, rows, valueKey, label }) {
    return (
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-matador-black text-white">
          <h6 className="mb-0">{title}</h6>
        </div>
        <div className="card-body p-0">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr><th>#</th><th>Player</th><th className="text-center">{label}</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((p, i) => (
                <tr key={p.name} className={i === 0 ? 'table-matador-success' : ''}>
                  <td>{i + 1}</td>
                  <td className="fw-semibold">{p.name}</td>
                  <td className="text-center fw-bold">{p[valueKey]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6">
          <LeaderTable title="Best Single Round — Gross" rows={byBestGross} valueKey="bestGross" label="Score" />
        </div>
        <div className="col-12 col-md-6">
          <LeaderTable title="Best Single Round — Net (Full HC)" rows={byBestNet} valueKey="bestNet" label="Net Score" />
        </div>
        <div className="col-12 col-md-6">
          <LeaderTable title="Season Avg Gross" rows={byAvgGross} valueKey="avgGross" label="Avg" />
        </div>
        <div className="col-12 col-md-6">
          <LeaderTable title="Season Avg Net (Full HC)" rows={byAvgNet} valueKey="avgNet" label="Avg Net" />
        </div>
      </div>

      <div className="alert alert-info small">
        <i className="bi bi-info-circle me-1"></i>
        Eagles, birdies, and pars leaderboard coming in a future update (requires storing par values per hole from the CSV).
      </div>
    </div>
  );
}
