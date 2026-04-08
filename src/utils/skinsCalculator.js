import { strokesReceived, getHoleHandicaps } from './handicapUtils';

/**
 * Calculate skins results for a round.
 *
 * Skins use HALF handicaps (fullHandicap / 2).
 * A skin is won outright only when one player has the lowest net score on a hole.
 * If two or more players tie, no skin is awarded for that hole.
 *
 * @param {Array}  players  - From csvParser: [{ name, fullHandicap, halfHandicap, scores }]
 * @param {'front'|'back'} section
 * @param {'half'|'full'} handicapType - 'half' (default, skins standard) or 'full'
 * @returns {Object} keyed by hole number (1-9 or 10-18):
 *   {
 *     winner: string | 'No Winner',
 *     value: 1 | 0,
 *     scores: [{ name, gross, net, strokes }]
 *   }
 */
export function calculateSkins(players, section, handicapType = 'half') {
  const holeHandicaps = getHoleHandicaps(section);

  // Sort players by handicap for consistent display (lowest first)
  const sorted = [...players].sort((a, b) => {
    if (a.fullHandicap !== b.fullHandicap) return a.fullHandicap - b.fullHandicap;
    return a.originalIndex - b.originalIndex;
  });

  const results = {};

  for (let i = 0; i < 9; i++) {
    const holeNumber = section === 'front' ? i + 1 : i + 10;
    const holeStrokeIndex = holeHandicaps[i];

    const holeScores = sorted.map(player => {
      const hdcp = handicapType === 'full' ? player.fullHandicap : player.halfHandicap;
      const strokes = strokesReceived(hdcp, holeStrokeIndex);
      const gross = player.scores[i];
      return {
        name: player.name,
        gross,
        net: gross - strokes,
        strokes,
      };
    });

    const lowestNet = Math.min(...holeScores.map(s => s.net));
    const winners = holeScores.filter(s => s.net === lowestNet);

    results[holeNumber] = {
      winner: winners.length === 1 ? winners[0].name : 'No Winner',
      value: winners.length === 1 ? 1 : 0,
      scores: holeScores,
    };
  }

  return results;
}

/**
 * Summarize skins results into a winners list.
 * @param {Object} skinsResults - Output of calculateSkins
 * @returns {Array} [{ hole, winner }]
 */
export function getSkinWinners(skinsResults) {
  return Object.entries(skinsResults)
    .filter(([, result]) => result.winner !== 'No Winner')
    .map(([hole, result]) => ({ hole: parseInt(hole), winner: result.winner }));
}
