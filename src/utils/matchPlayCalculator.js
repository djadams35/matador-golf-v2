import { getHoleHandicaps } from './handicapUtils';

/**
 * Calculate match play results for a week.
 *
 * Match play uses FULL handicaps.
 * Each hole is won by the player with the lower net score.
 * The match winner is whoever wins more holes (ties count as halves).
 *
 * @param {Object} teamA  - { players: [p1, p2] }
 * @param {Object} teamB  - same structure
 * @param {'front'|'back'} section
 * @param {Object|null} pairingOverrides - { aLow, aHigh, bLow, bHigh } player names; skips auto-sort
 * @returns {Object} {
 *   lowMatch:  { teamAPlayer, teamBPlayer, teamAHolesWon, teamBHolesWon, halved, winner: 'A'|'B'|'tie' },
 *   highMatch: { same structure },
 *   teamPoint: { teamANet, teamBNet, winner: 'A'|'B'|'tie' },
 *   points:    { teamA: 0-3, teamB: 0-3 }  (with 0.5 for ties)
 * }
 */
export function calculateMatchPlay(teamA, teamB, section, pairingOverrides = null) {
  const holeHandicaps = getHoleHandicaps(section);

  function playMatch(playerA, playerB) {
    let aWins = 0, bWins = 0, halved = 0;

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

  // Sort by HC ascending; break ties by last name alphabetically for a deterministic result.
  function sortPlayers(players) {
    return [...players].sort((a, b) => {
      const hcDiff = a.fullHandicap - b.fullHandicap;
      if (hcDiff !== 0) return hcDiff;
      const aLast = a.name.split(' ').slice(-1)[0];
      const bLast = b.name.split(' ').slice(-1)[0];
      return aLast.localeCompare(bLast);
    });
  }

  let aLow, aHigh, bLow, bHigh;

  if (pairingOverrides) {
    const aSorted = sortPlayers(teamA.players);
    const bSorted = sortPlayers(teamB.players);
    aLow  = teamA.players.find(p => p.name === pairingOverrides.aLow)  || aSorted[0];
    aHigh = teamA.players.find(p => p.name === pairingOverrides.aHigh) || aSorted[1];
    bLow  = teamB.players.find(p => p.name === pairingOverrides.bLow)  || bSorted[0];
    bHigh = teamB.players.find(p => p.name === pairingOverrides.bHigh) || bSorted[1];
  } else {
    [aLow, aHigh] = sortPlayers(teamA.players);
    [bLow, bHigh] = sortPlayers(teamB.players);
  }

  const lowMatch  = playMatch(aLow,  bLow);
  const highMatch = playMatch(aHigh, bHigh);

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

  const pointValue = (result) => result === 'A' ? 1 : result === 'B' ? 0 : 0.5;
  const teamAPoints = pointValue(lowMatch.winner) + pointValue(highMatch.winner) + pointValue(teamPoint.winner);
  const teamBPoints = 3 - teamAPoints;

  return { lowMatch, highMatch, teamPoint, points: { teamA: teamAPoints, teamB: teamBPoints } };
}
