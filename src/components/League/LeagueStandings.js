import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function LeagueStandings() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchStandings(); }, []);

  async function fetchStandings() {
    setLoading(true);

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, team_players(player_id, players(name))');
    if (teamsError) { setError(teamsError.message); setLoading(false); return; }

    // Get all match results
    const { data: matches, error: matchError } = await supabase
      .from('match_results')
      .select('team_a_id, team_b_id, team_a_points, team_b_points');
    if (matchError) { setError(matchError.message); setLoading(false); return; }

    // Calculate standings for each team
    const teamStats = {};
    teams.forEach(team => {
      teamStats[team.id] = {
        id: team.id,
        name: team.name,
        players: team.team_players?.map(tp => tp.players?.name).filter(Boolean).join(' & ') || '',
        points: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        matchesPlayed: 0,
      };
    });

    matches.forEach(match => {
      const a = teamStats[match.team_a_id];
      const b = teamStats[match.team_b_id];
      if (!a || !b) return;

      a.points += match.team_a_points;
      b.points += match.team_b_points;
      a.matchesPlayed++;
      b.matchesPlayed++;

      // Count wins/losses/ties per individual point
      // Each match has 3 points available; we count the total points won as the record
      // Win = 2+ points in a week, Loss = 1 or less, Tie = exactly 1.5 each
      if (match.team_a_points > match.team_b_points) { a.wins++; b.losses++; }
      else if (match.team_b_points > match.team_a_points) { b.wins++; a.losses++; }
      else { a.ties++; b.ties++; }
    });

    const sorted = Object.values(teamStats)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
      })
      .map((team, i) => ({
        ...team,
        rank: i + 1,
        pct: team.matchesPlayed > 0
          ? ((team.points / (team.matchesPlayed * 3)) * 100).toFixed(1) + '%'
          : '—',
      }));

    setStandings(sorted);
    setLoading(false);
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-matador-red"></span></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  if (standings.length === 0) {
    return (
      <div className="alert alert-info">
        No standings yet. Upload rounds and set up teams in the Admin panel to see standings here.
      </div>
    );
  }

  return (
    <div>
      <div className="card border-0 shadow border-matador">
        <div className="card-header bg-matador-red text-white">
          <h5 className="mb-0"><i className="bi bi-trophy-fill me-2"></i>Season Standings</h5>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-matador-black text-white">
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Team</th>
                  <th className="d-none d-md-table-cell">Players</th>
                  <th className="text-center">Pts</th>
                  <th className="text-center">W</th>
                  <th className="text-center">L</th>
                  <th className="text-center">T</th>
                  <th className="text-center d-none d-sm-table-cell">Pct</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, i) => (
                  <tr key={team.id} className={i === 0 ? 'table-matador-success' : ''}>
                    <td className="fw-bold text-matador-red">{team.rank}</td>
                    <td className="fw-bold">{team.name}</td>
                    <td className="text-muted d-none d-md-table-cell small">{team.players}</td>
                    <td className="text-center fw-bold">{team.points}</td>
                    <td className="text-center">{team.wins}</td>
                    <td className="text-center">{team.losses}</td>
                    <td className="text-center">{team.ties}</td>
                    <td className="text-center d-none d-sm-table-cell text-muted">{team.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-muted small mt-2">Points: 3 available per week (1 low match, 1 high match, 1 team combined net). Ties = 0.5 each.</p>
    </div>
  );
}
