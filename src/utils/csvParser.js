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

              resolve({ section, players, parScores });
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
