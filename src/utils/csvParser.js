import Papa from 'papaparse';

/**
 * Parse a Golf League Guru round scores CSV file.
 *
 * Expected CSV format (Golf League Guru export):
 *   Row 0: (blank)
 *   Row 1: headers — Player, Team #, Hole, [10..18 or 1..9], Total, HDCP
 *   Row 2: Pars row — ,,Pars,[par values],total,
 *   Row 3+: player data — name, teamNumber, , [9 scores], total, handicap
 *
 * Returns:
 *   {
 *     section: 'front' | 'back',
 *     players: [{ name, teamNumber, fullHandicap, halfHandicap, scores: [9 numbers] }],
 *     parsRow: [9 numbers],
 *   }
 */
function validatePlayers(players) {
  const warnings = [];
  if (players.length < 2) {
    warnings.push('Only ' + players.length + ' player(s) found — check that the file is a valid round export.');
  }
  players.forEach(p => {
    if (!p.name) {
      warnings.push('A player row has an empty name — it may be parsed incorrectly.');
    }
    if (isNaN(p.fullHandicap)) {
      warnings.push(`${p.name}: handicap could not be read (got "${p.fullHandicap}").`);
    } else if (p.fullHandicap < -5 || p.fullHandicap > 30) {
      warnings.push(`${p.name}: handicap ${p.fullHandicap} looks out of range (expected -5 to 30).`);
    }
    const badScores = p.scores.map((s, i) => ({ hole: i + 1, score: s })).filter(h => h.score === 0 || h.score > 15);
    if (badScores.length > 0) {
      warnings.push(`${p.name}: suspicious scores on hole(s) ${badScores.map(h => h.hole).join(', ')} — verify before saving.`);
    }
  });
  return warnings;
}

export function parseRoundCSV(file) {
  return new Promise((resolve, reject) => {
    // First pass: detect front vs back 9 from headers
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (headerResult) => {
        const fields = headerResult.meta.fields || [];
        const holeHeaders = fields.filter(
          f => !isNaN(parseInt(f)) && parseInt(f) >= 1 && parseInt(f) <= 18
        );

        let section = 'front';
        if (holeHeaders.length > 0 && parseInt(holeHeaders[0]) >= 10) {
          section = 'back';
        }

        // Second pass: raw row access (no header mode) for reliable column indexing
        Papa.parse(file, {
          header: false,
          dynamicTyping: false,  // keep as strings so "+1" handicaps aren't mangled
          skipEmptyLines: true,
          complete: (rawResult) => {
            try {
              const data = rawResult.data;

              const parsRow = data.find(row => row[2] === 'Pars');
              const parScores = parsRow ? parsRow.slice(3, 12).map(Number) : [];

              const playerRows = data.filter(row =>
                row[0] &&
                row[0] !== 'Player' &&
                row[0] !== 'HDCP' &&
                row[0] !== 'PAR' &&
                row[0] !== '' &&
                !String(row[2] || '').includes('Pars')
              );

              const players = playerRows.map((row, index) => {
                // Handle plus handicaps like "+1" — must read as string before parsing
                const hdcpRaw = String(row[13] ?? '').trim();
                const fullHandicap = hdcpRaw.startsWith('+')
                  ? -parseFloat(hdcpRaw.slice(1))   // +1 → -1 (gives strokes, not receives)
                  : parseFloat(hdcpRaw) || 0;
                return {
                  name: String(row[0]).trim(),
                  teamNumber: row[1] ? parseInt(row[1]) : null,
                  fullHandicap,
                  halfHandicap: fullHandicap / 2,
                  scores: row.slice(3, 12).map(s => parseInt(String(s)) || 0),
                  originalIndex: index,
                };
              });

              resolve({ section, players, parScores, warnings: validatePlayers(players) });
            } catch (err) {
              reject(new Error('Error processing CSV data: ' + err.message));
            }
          },
          error: (err) => reject(new Error('Error reading CSV: ' + err.message)),
        });
      },
      error: (err) => reject(new Error('Error reading CSV headers: ' + err.message)),
    });
  });
}
