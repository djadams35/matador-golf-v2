// ─── Course handicap stroke index arrays ────────────────────────────────────
// These are fixed for this course and must never be changed.
// The stroke index tells you which holes are "harder" for handicap purposes.
// Hole index 0 = first hole played (hole 1 on front, hole 10 on back).

export const FRONT_NINE_HANDICAPS = [4, 14, 16, 2, 18, 8, 6, 12, 10];
export const BACK_NINE_HANDICAPS  = [5,  7, 17, 1, 13, 11, 15,  9,  3];

/**
 * Returns the handicap stroke index array for the given section.
 * @param {'front'|'back'} section
 */
export function getHoleHandicaps(section) {
  return section === 'back' ? BACK_NINE_HANDICAPS : FRONT_NINE_HANDICAPS;
}

/**
 * How many strokes does a player receive on a given hole?
 *
 * Rule: a player with handicap N receives 1 stroke on every hole whose
 * stroke index is <= N.  If the handicap is a half (e.g. 7.5) they receive
 * a stroke on holes with index <= ceil(7.5) = 8.
 *
 * Used for SKINS (half handicap) and MATCH PLAY / LOW NET (full handicap).
 *
 * @param {number} handicap       - The player's handicap (may be fractional for skins)
 * @param {number} holeStrokeIndex - The hole's stroke index (1–18)
 * @returns {number} 0 or 1
 */
export function strokesReceived(handicap, holeStrokeIndex) {
  if (handicap % 1 !== 0) {
    return holeStrokeIndex <= Math.ceil(handicap) ? 1 : 0;
  }
  return holeStrokeIndex <= handicap ? 1 : 0;
}

/**
 * Calculate a player's net score for a single hole.
 * @param {number} grossScore
 * @param {number} handicap
 * @param {number} holeStrokeIndex
 * @returns {number}
 */
export function netScore(grossScore, handicap, holeStrokeIndex) {
  return grossScore - strokesReceived(handicap, holeStrokeIndex);
}

/**
 * Calculate a player's total net score for all 9 holes.
 * @param {number[]} grossScores    - Array of 9 gross scores
 * @param {number}   handicap       - Full handicap (use fullHdcp/2 for skins)
 * @param {number[]} holeHandicaps  - Array of 9 stroke index values
 * @returns {number}
 */
export function totalNetScore(grossScores, handicap, holeHandicaps) {
  return grossScores.reduce((sum, gross, i) => {
    return sum + netScore(gross, handicap, holeHandicaps[i]);
  }, 0);
}
