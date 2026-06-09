import { getHoleHandicaps } from './handicapUtils';

/**
 * Play a single head-to-head match (9 holes, full handicaps).
 * Each hole goes to the lower net score; the match winner wins more holes.
 */
function playMatch(playerA, playerB, holeHandicaps) {
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

function teamNet(team) {
  return team.players.reduce((sum, p) => sum + p.scores.reduce((s, g) => s + g, 0) - p.fullHandicap, 0);
}

const pointValue = (result) => result === 'A' ? 1 : result === 'B' ? 0 : 0.5;

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
 *   lowMatch:  { playerA, playerB, aHolesWon, bHolesWon, halved, winner: 'A'|'B'|'tie' },
 *   highMatch: { same structure },
 *   teamPoint: { teamANet, teamBNet, winner: 'A'|'B'|'tie' },
 *   points:    { teamA: 0-3, teamB: 0-3 }  (with 0.5 for ties)
 * }
 */
export function calculateMatchPlay(teamA, teamB, section, pairingOverrides = null) {
  const holeHandicaps = getHoleHandicaps(section);

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

  const lowMatch  = playMatch(aLow,  bLow,  holeHandicaps);
  const highMatch = playMatch(aHigh, bHigh, holeHandicaps);

  const teamANet = teamNet(teamA);
  const teamBNet = teamNet(teamB);
  const teamPoint = {
    teamANet,
    teamBNet,
    winner: teamANet < teamBNet ? 'A' : teamBNet < teamANet ? 'B' : 'tie',
  };

  const teamAPoints = pointValue(lowMatch.winner) + pointValue(highMatch.winner) + pointValue(teamPoint.winner);
  const teamBPoints = 3 - teamAPoints;

  return { lowMatch, highMatch, teamPoint, points: { teamA: teamAPoints, teamB: teamBPoints } };
}

/**
 * Match play when one team has a no-show.
 * The no-show forfeits their individual match AND the team net point. The
 * showing teammate still plays a single live match against an admin-chosen
 * opponent. The opponent's slot (low/high HC) determines which individual
 * match is "live" and which is the forfeit.
 *
 * @param opts {
 *   noShowSide: 'A'|'B',        // which scheduled team had the no-show
 *   showingPlayerName,          // teammate who actually played (may be a sub)
 *   chosenOpponentName,         // opposing player they compete against
 *   noShowPlayerName,           // for display
 * }
 */
export function calculateMatchPlayNoShow(teamA, teamB, section, opts) {
  const holeHandicaps = getHoleHandicaps(section);
  const { noShowSide, showingPlayerName, chosenOpponentName, noShowPlayerName } = opts;

  const showTeam = noShowSide === 'A' ? teamA : teamB;
  const oppTeam  = noShowSide === 'A' ? teamB : teamA;

  const showingPlayer = showTeam.players.find(p => p.name === showingPlayerName) || showTeam.players[0] || null;
  const [oppLow, oppHigh] = sortPlayers(oppTeam.players);
  const chosenOpp = oppTeam.players.find(p => p.name === chosenOpponentName) || oppLow;
  const liveSlot = (oppHigh && chosenOpp && chosenOpp.name === oppHigh.name) ? 'high' : 'low';
  const otherOpp = liveSlot === 'low' ? oppHigh : oppLow;

  // Opponent's team wins both the forfeited individual match and the team point
  const forfeitWinner = noShowSide === 'A' ? 'B' : 'A';

  // Live match — orient detail so playerA is teamA's side, playerB is teamB's side
  let liveDetail = null;
  if (showingPlayer && chosenOpp) {
    liveDetail = noShowSide === 'A'
      ? playMatch(showingPlayer, chosenOpp, holeHandicaps)
      : playMatch(chosenOpp, showingPlayer, holeHandicaps);
  } else {
    // No teammate played — the "live" slot also becomes a forfeit
    liveDetail = {
      playerA: noShowSide === 'A' ? noShowPlayerName : (chosenOpp ? chosenOpp.name : null),
      playerB: noShowSide === 'A' ? (chosenOpp ? chosenOpp.name : null) : noShowPlayerName,
      aHolesWon: 0, bHolesWon: 0, halved: 0,
      winner: forfeitWinner,
      noShow: true,
      noShowPlayer: noShowPlayerName,
    };
  }

  // Forfeited individual match — the unopposed opponent wins by no-show
  const forfeitDetail = {
    playerA: noShowSide === 'A' ? noShowPlayerName : (otherOpp ? otherOpp.name : null),
    playerB: noShowSide === 'A' ? (otherOpp ? otherOpp.name : null) : noShowPlayerName,
    aHolesWon: 0, bHolesWon: 0, halved: 0,
    winner: forfeitWinner,
    noShow: true,
    noShowPlayer: noShowPlayerName,
  };

  const lowMatch  = liveSlot === 'low'  ? liveDetail : forfeitDetail;
  const highMatch = liveSlot === 'high' ? liveDetail : forfeitDetail;

  const oppNet = teamNet(oppTeam);
  const teamPoint = {
    teamANet: noShowSide === 'A' ? null : oppNet,
    teamBNet: noShowSide === 'A' ? oppNet : null,
    winner: forfeitWinner,
    noShow: true,
  };

  const teamAPoints = pointValue(lowMatch.winner) + pointValue(highMatch.winner) + pointValue(teamPoint.winner);
  const teamBPoints = 3 - teamAPoints;

  return { lowMatch, highMatch, teamPoint, points: { teamA: teamAPoints, teamB: teamBPoints } };
}
