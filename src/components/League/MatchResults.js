import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function MatchResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

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

        return (
          <div className="card border-0 shadow-sm mb-3" key={r.id}>
            <div className="card-header bg-matador-black text-white d-flex justify-content-between">
              <span>Week {r.week_number}{r.rounds?.played_date ? ` — ${r.rounds.played_date}` : ''}</span>
              <span className="badge bg-light text-dark">
                {r.rounds?.holes_played === 'front' ? 'Front 9' : 'Back 9'}
              </span>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="text-center">
                  <div className="fw-bold fs-5">{aName}</div>
                  <div className="display-6 fw-bold text-matador-red">{r.team_a_points}</div>
                  <div className="text-muted small">points</div>
                </div>
                <div className="text-center text-muted">vs</div>
                <div className="text-center">
                  <div className="fw-bold fs-5">{bName}</div>
                  <div className="display-6 fw-bold text-matador-red">{r.team_b_points}</div>
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
                    <td className="small">{low.playerA} vs {low.playerB}</td>
                    <td className="text-center">
                      <span className={`badge ${low.winner === 'A' ? 'badge-matador' : low.winner === 'B' ? 'bg-secondary' : 'bg-warning text-dark'}`}>
                        {low.winner === 'A' ? aName : low.winner === 'B' ? bName : 'Tie'}
                      </span>
                      <div className="text-muted small">{low.aHolesWon}–{low.bHolesWon} ({low.halved} tied)</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-nowrap">High HC Match</td>
                    <td className="small">{high.playerA} vs {high.playerB}</td>
                    <td className="text-center">
                      <span className={`badge ${high.winner === 'A' ? 'badge-matador' : high.winner === 'B' ? 'bg-secondary' : 'bg-warning text-dark'}`}>
                        {high.winner === 'A' ? aName : high.winner === 'B' ? bName : 'Tie'}
                      </span>
                      <div className="text-muted small">{high.aHolesWon}–{high.bHolesWon} ({high.halved} tied)</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-nowrap">Team Net</td>
                    <td className="small text-muted">{team.teamANet} vs {team.teamBNet}</td>
                    <td className="text-center">
                      <span className={`badge ${team.winner === 'A' ? 'badge-matador' : team.winner === 'B' ? 'bg-secondary' : 'bg-warning text-dark'}`}>
                        {team.winner === 'A' ? aName : team.winner === 'B' ? bName : 'Tie'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
