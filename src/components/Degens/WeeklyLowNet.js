import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function WeeklyLowNet() {
  const [weeklyResults, setWeeklyResults] = useState([]);
  const [seasonSummary, setSeasonSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    // Get all degens
    const { data: degensData } = await supabase
      .from('degens')
      .select('player_id, players(name)')
      .eq('active', true);

    const degenIds = (degensData || []).map(d => d.player_id);
    const degenNames = {};
    (degensData || []).forEach(d => { degenNames[d.player_id] = d.players?.name; });

    if (degenIds.length === 0) { setLoading(false); return; }

    // Get net totals for all degen players, joined with round info
    const { data: netData } = await supabase
      .from('round_net_totals')
      .select('player_id, net_total, gross_total, rounds(id, played_date, week_number, holes_played)')
      .in('player_id', degenIds)
      .order('rounds(played_date)', { ascending: false });

    if (!netData) { setLoading(false); return; }

    // Group by round
    const roundMap = {};
    netData.forEach(row => {
      if (!row.rounds) return;
      const roundId = row.rounds.id;
      if (!roundMap[roundId]) {
        roundMap[roundId] = {
          roundId,
          date: row.rounds.played_date,
          week: row.rounds.week_number,
          holes: row.rounds.holes_played,
          players: [],
        };
      }
      roundMap[roundId].players.push({
        playerId: row.player_id,
        name: degenNames[row.player_id] || 'Unknown',
        net: row.net_total,
        gross: row.gross_total,
      });
    });

    // Sort players within each round by net score, then find the winner
    const results = Object.values(roundMap).map(round => {
      const sorted = [...round.players].sort((a, b) => a.net - b.net);
      const lowest = sorted[0]?.net;
      const winners = sorted.filter(p => p.net === lowest);
      return { ...round, sorted, winner: winners.length === 1 ? winners[0].name : 'Tie', winners };
    }).sort((a, b) => {
      if (b.week && a.week) return b.week - a.week;
      return (b.date || '').localeCompare(a.date || '');
    });

    setWeeklyResults(results);

    // Season summary: count wins per player
    const winCounts = {};
    results.forEach(r => {
      if (r.winners.length === 1) {
        const name = r.winners[0].name;
        winCounts[name] = (winCounts[name] || 0) + 1;
      }
    });
    const summary = Object.entries(winCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, wins]) => ({ name, wins }));

    setSeasonSummary(summary);
    setLoading(false);
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;

  return (
    <div>
      {/* Season Summary */}
      {seasonSummary.length > 0 && (
        <div className="card border-0 shadow-sm mb-4 border-matador">
          <div className="card-header bg-matador-red text-white">
            <h5 className="mb-0"><i className="bi bi-trophy-fill me-2"></i>Season Low Net Wins</h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead className="bg-matador-black text-white">
                <tr><th>Rank</th><th>Player</th><th className="text-center">Wins</th></tr>
              </thead>
              <tbody>
                {seasonSummary.map((row, i) => (
                  <tr key={row.name} className={i === 0 ? 'table-matador-success' : ''}>
                    <td className="fw-bold">{i + 1}</td>
                    <td>{row.name}</td>
                    <td className="text-center"><span className="badge badge-matador">{row.wins}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly breakdown */}
      <h5 className="fw-bold mb-3">Weekly Results</h5>
      {weeklyResults.length === 0 && (
        <div className="alert alert-info">No rounds uploaded yet. Upload rounds in the Admin panel.</div>
      )}
      {weeklyResults.map(round => (
        <div className="card border-0 shadow-sm mb-3" key={round.roundId}>
          <div className="card-header bg-matador-black text-white d-flex justify-content-between">
            <span>
              {round.date || 'Unknown date'}
              {round.week ? ` — Week ${round.week}` : ''}
              {' — '}{round.holes === 'front' ? 'Front 9' : 'Back 9'}
            </span>
            <span className="badge bg-light text-dark">
              Winner: {round.winner}
            </span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr><th>Player</th><th className="text-center">Net Total</th><th className="text-center">Gross Total</th></tr>
                </thead>
                <tbody>
                  {round.sorted.map(p => (
                    <tr key={p.name} className={round.winner === p.name ? 'table-matador-success' : ''}>
                      <td className="fw-semibold">
                        {p.name}
                        {round.winner === p.name && <span className="badge badge-matador ms-2">Low Net</span>}
                      </td>
                      <td className="text-center fw-bold">{p.net}</td>
                      <td className="text-center text-muted">{p.gross}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
