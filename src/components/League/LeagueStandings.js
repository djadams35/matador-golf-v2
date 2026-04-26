import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function LeagueStandings() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTeam, setExpandedTeam] = useState(null);

  useEffect(() => { fetchStandings(); }, []);

  async function fetchStandings() {
    setLoading(true);

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, team_players(player_id, players(name))');
    if (teamsError) { setError(teamsError.message); setLoading(false); return; }

    const { data: matches, error: matchError } = await supabase
      .from('match_results')
      .select('team_a_id, team_b_id, team_a_points, team_b_points, team_point_winner, low_match_detail, high_match_detail');
    if (matchError) { setError(matchError.message); setLoading(false); return; }

    // Per-player: points + W/L/T for individual matches
    const playerStats = {}; // name -> { points, wins, losses, ties }
    const playerTeamMap = {}; // name -> Set of team_ids (to identify subs)

    matches.forEach(match => {
      [
        { detail: match.low_match_detail,  teamA: match.team_a_id, teamB: match.team_b_id },
        { detail: match.high_match_detail, teamA: match.team_a_id, teamB: match.team_b_id },
      ].forEach(({ detail, teamA, teamB }) => {
        if (!detail) return;
        const { playerA, playerB, winner } = detail;
        if (!playerStats[playerA]) playerStats[playerA] = { points: 0, wins: 0, losses: 0, ties: 0 };
        if (!playerStats[playerB]) playerStats[playerB] = { points: 0, wins: 0, losses: 0, ties: 0 };
        if (!playerTeamMap[playerA]) playerTeamMap[playerA] = new Set();
        if (!playerTeamMap[playerB]) playerTeamMap[playerB] = new Set();
        playerTeamMap[playerA].add(teamA);
        playerTeamMap[playerB].add(teamB);

        if (winner === 'A') {
          playerStats[playerA].points += 1; playerStats[playerA].wins++;
          playerStats[playerB].losses++;
        } else if (winner === 'B') {
          playerStats[playerB].points += 1; playerStats[playerB].wins++;
          playerStats[playerA].losses++;
        } else {
          playerStats[playerA].points += 0.5; playerStats[playerA].ties++;
          playerStats[playerB].points += 0.5; playerStats[playerB].ties++;
        }
      });
    });

    const teamStats = {};
    teams.forEach(team => {
      const playerNames = team.team_players?.map(tp => tp.players?.name).filter(Boolean) || [];
      teamStats[team.id] = {
        id: team.id,
        name: team.name,
        players: playerNames.join(' & '),
        playerNames,
        points: 0,
        wins: 0, losses: 0, ties: 0,
        teamNetPts: 0, teamNetWins: 0, teamNetLosses: 0, teamNetTies: 0,
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

      if (match.team_a_points > match.team_b_points) { a.wins++; b.losses++; }
      else if (match.team_b_points > match.team_a_points) { b.wins++; a.losses++; }
      else { a.ties++; b.ties++; }

      if (match.team_point_winner === match.team_a_id) {
        a.teamNetPts += 1; a.teamNetWins++;
        b.teamNetLosses++;
      } else if (match.team_point_winner === match.team_b_id) {
        b.teamNetPts += 1; b.teamNetWins++;
        a.teamNetLosses++;
      } else {
        a.teamNetPts += 0.5; a.teamNetTies++;
        b.teamNetPts += 0.5; b.teamNetTies++;
      }
    });

    const sorted = Object.values(teamStats)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
      })
      .map((team, i) => {
        const subDetails = Object.entries(playerStats)
          .filter(([name]) => !team.playerNames.includes(name) && playerTeamMap[name]?.has(team.id))
          .map(([name, stats]) => ({ name, ...stats }));

        return {
          ...team,
          rank: i + 1,
          playerDetails: team.playerNames.map(name => ({
            name,
            ...(playerStats[name] || { points: 0, wins: 0, losses: 0, ties: 0 }),
          })),
          subDetails,
        };
      });

    setStandings(sorted);
    setLoading(false);
  }

  function toggleExpand(teamId) {
    setExpandedTeam(prev => prev === teamId ? null : teamId);
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
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, i) => {
                  const isExpanded = expandedTeam === team.id;
                  return (
                    <React.Fragment key={team.id}>
                      <tr
                        className={i === 0 ? 'table-matador-success' : ''}
                        onClick={() => toggleExpand(team.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="fw-bold text-matador-red">{team.rank}</td>
                        <td className="fw-bold">{team.name}</td>
                        <td className="text-muted d-none d-md-table-cell small">{team.players}</td>
                        <td className="text-center fw-bold">{team.points}</td>
                        <td className="text-center text-muted">
                          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} small`}></i>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="table-light">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="d-flex flex-wrap gap-4">
                              {team.playerDetails.map(p => (
                                <div key={p.name}>
                                  <div className="text-muted small fw-semibold mb-1">{p.name}</div>
                                  <div className="fw-bold">{p.points} pts</div>
                                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{p.wins}–{p.losses}–{p.ties} W–L–T</div>
                                </div>
                              ))}
                              <div>
                                <div className="text-muted small fw-semibold mb-1">Team Net</div>
                                <div className="fw-bold">{team.teamNetPts} pts</div>
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{team.teamNetWins}–{team.teamNetLosses}–{team.teamNetTies} W–L–T</div>
                              </div>
                              {team.subDetails.map(s => (
                                <div key={s.name}>
                                  <div className="text-muted small fw-semibold mb-1">
                                    {s.name} <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>sub</span>
                                  </div>
                                  <div className="fw-bold">{s.points} pts</div>
                                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{s.wins}–{s.losses}–{s.ties} W–L–T</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-muted small mt-2">Points: 3 available per week (1 low match, 1 high match, 1 team combined net). Ties = 0.5 each.</p>
    </div>
  );
}
