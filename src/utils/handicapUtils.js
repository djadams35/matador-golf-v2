// ─── Course handicap stroke index arrays ────────────────────────────────────
// These are 9-hole stroke indexes (1–9) derived from the course's 18-hole
// stroke indexes. Handicaps in the CSV are already 9-hole handicaps, so
// strokes are allocated across 9 holes using these 1–9 SI values.
//
// Conversion: front 18-hole even SIs ÷ 2, back 18-hole odd SIs (+ 1) ÷ 2.
// Original 18-hole front: [4,14,16,2,18,8,6,12,10]
// Original 18-hole back:  [5,7,17,1,13,11,15,9,3]
// Hole index 0 = first hole played (hole 1 on front, hole 10 on back).

export const FRONT_NINE_HANDICAPS = [2, 7, 8, 1, 9, 4, 3, 6, 5];
export const BACK_NINE_HANDICAPS  = [3, 4, 9, 1, 7, 6, 8, 5, 2];

/**
 * Returns the handicap stroke index array for the given section.
 * @param {'front'|'back'} section
 */
export function getHoleHandicaps(section) {
  return section === 'back' ? BACK_NINE_HANDICAPS : FRONT_NINE_HANDICAPS;
}

/**
 * How many strokes does a player receive (or give) on a given hole?
 *
 * Positive handicap: receives 1 stroke on holes with SI <= handicap.
 * Negative handicap (plus handicap, stored as e.g. -1 for a +1 player):
 *   gives 1 stroke on holes with SI <= abs(handicap), returned as -1.
 *
 * Used for SKINS (half handicap) and MATCH PLAY / LOW NET (full handicap).
 *
 * @param {number} handicap        - The player's handicap (negative = plus handicap)
 * @param {number} holeStrokeIndex - The hole's stroke index (1–9)
 * @returns {number} -1, 0, or 1
 */
export function strokesReceived(handicap, holeStrokeIndex) {
  const abs = Math.abs(handicap);
  const threshold = abs % 1 !== 0 ? Math.ceil(abs) : abs;
  if (holeStrokeIndex > threshold) return 0;
  return handicap >= 0 ? 1 : -1;
}

/**
 * Format a handicap for display: negative values (plus handicaps) show as "+N".
 * @param {number} handicap
 * @returns {string}
 */
export function formatHandicap(handicap) {
  if (handicap === null || handicap === undefined) return '';
  return handicap < 0 ? `+${Math.abs(handicap)}` : String(handicap);
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
