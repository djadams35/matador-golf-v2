import { getHoleHandicaps } from './handicapUtils';

/**
 * Calculate match play results for a week.
 *
 * Match play uses FULL handicaps.
 * Each hole is won by the player with the lower net score.
 * The match winner is whoever wins more holes (ties count as halves).
 *
 * @param {Object} teamA  - { players: [playerLow, playerHigh] } sorted low-to-high handicap
 * @param {Object} teamB  - same structure
 * @param {'front'|'back'} section
 * @returns {Object} {
 *   lowMatch:  { teamAPlayer, teamBPlayer, teamAHolesWon, teamBHolesWon, halved, winner: 'A'|'B'|'tie' },
 *   highMatch: { same structure },
 *   teamPoint: { teamANet, teamBNet, winner: 'A'|'B'|'tie' },
 *   points:    { teamA: 0-3, teamB: 0-3 }  (with 0.5 for ties)
 * }
 */
export function calculateMatchPlay(teamA, teamB, section) {
  const holeHandicaps = getHoleHandicaps(section);

  function playMatch(playerA, playerB) {
    let aWins = 0, bWins = 0, halved = 0;

    // Difference method: the higher-HC player receives (diff) strokes on the
    // diff hardest holes. The lower-HC player receives zero strokes.
    const diff = playerA.fullHandicap - playerB.fullHandicap;
    const absDiff = Math.abs(diff) % 1 !== 0 ? Math.ceil(Math.abs(diff)) : Math.abs(diff);

    for (let i = 0; i < 9; i++) {
      const si = holeHandicaps[i];
      let aNet = playerA.scores[i];
      let bNet = playerB.scores[i];

      if (diff > 0 && si <= absDiff) aNet -= 1;
      else if (diff < 0 && si <= absDiff) bNet -= 1;

      if (aNet < bNet) aWins++;
      else if (bNet < aNet) bWins++;
      else halved++;
    }

    return {
      playerA: playerA.name,
      playerB: playerB.name,
      aHolesWon: aWins,
      bHolesWon: bWins,
      halved,
      winner: aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'tie',
    };
  }

  // Sort each team's players by handicap (index 0 = lower handicap)
  const [aLow, aHigh] = [...teamA.players].sort((a, b) => a.fullHandicap - b.fullHandicap);
  const [bLow, bHigh] = [...teamB.players].sort((a, b) => a.fullHandicap - b.fullHandicap);

  const lowMatch  = playMatch(aLow,  bLow);
  const highMatch = playMatch(aHigh, bHigh);

  // Team point: each player's gross total minus their full handicap (simple subtraction, not hole-by-hole)
  const teamANet = [...teamA.players].reduce((sum, p) => {
    return sum + p.scores.reduce((s, g) => s + g, 0) - p.fullHandicap;
  }, 0);

  const teamBNet = [...teamB.players].reduce((sum, p) => {
    return sum + p.scores.reduce((s, g) => s + g, 0) - p.fullHandicap;
  }, 0);

  const teamPoint = {
    teamANet,
    teamBNet,
    winner: teamANet < teamBNet ? 'A' : teamBNet < teamANet ? 'B' : 'tie',
  };

  // Tally points (0.5 for ties)
  const pointValue = (result) => result === 'A' ? 1 : result === 'B' ? 0 : 0.5;
  const teamAPoints = pointValue(lowMatch.winner) + pointValue(highMatch.winner) + pointValue(teamPoint.winner);
  const teamBPoints = 3 - teamAPoints;

  return { lowMatch, highMatch, teamPoint, points: { teamA: teamAPoints, teamB: teamBPoints } };
}
