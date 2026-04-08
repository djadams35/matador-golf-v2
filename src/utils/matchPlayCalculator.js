import { strokesReceived, getHoleHandicaps } from './handicapUtils';

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

    for (let i = 0; i < 9; i++) {
      const si = holeHandicaps[i];
      const aNet = playerA.scores[i] - strokesReceived(playerA.fullHandicap, si);
      const bNet = playerB.scores[i] - strokesReceived(playerB.fullHandicap, si);

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

  // Team point: combined net score for all players over all holes
  const teamANet = [...teamA.players].reduce((sum, p) => {
    return sum + p.scores.reduce((s, gross, i) => {
      return s + gross - strokesReceived(p.fullHandicap, holeHandicaps[i]);
    }, 0);
  }, 0);

  const teamBNet = [...teamB.players].reduce((sum, p) => {
    return sum + p.scores.reduce((s, gross, i) => {
      return s + gross - strokesReceived(p.fullHandicap, holeHandicaps[i]);
    }, 0);
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
