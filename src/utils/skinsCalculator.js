import { strokesReceived, getHoleHandicaps } from './handicapUtils';

/**
 * Calculate skins results for a round.
 *
 * @param {Array}  players    - [{ name, fullHandicap, scores }]
 * @param {'front'|'back'} section
 * @param {number} multiplier - Handicap percentage as decimal: 1 = full, 0.75 = 75%, 0.5 = 50%, 0.25 = 25%
 */
export function calculateSkins(players, section, multiplier = 1) {
  const holeHandicaps = getHoleHandicaps(section);

  const sorted = [...players].sort((a, b) => {
    if (a.fullHandicap !== b.fullHandicap) return a.fullHandicap - b.fullHandicap;
    return a.originalIndex - b.originalIndex;
  });

  const results = {};

  for (let i = 0; i < 9; i++) {
    const holeNumber = section === 'front' ? i + 1 : i + 10;
    const holeStrokeIndex = holeHandicaps[i];

    const holeScores = sorted.map(player => {
      const hdcp = player.fullHandicap * multiplier;
      const strokes = strokesReceived(hdcp, holeStrokeIndex);
      const gross = player.scores[i];
      return { name: player.name, gross, net: gross - strokes, strokes };
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

export function getSkinWinners(skinsResults) {
  return Object.entries(skinsResults)
    .filter(([, result]) => result.winner !== 'No Winner')
    .map(([hole, result]) => ({ hole: parseInt(hole), winner: result.winner }));
}
