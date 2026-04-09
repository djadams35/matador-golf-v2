import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateSkins } from '../../utils/skinsCalculator';
import { getHoleHandicaps } from '../../utils/handicapUtils';

export default function SkinsGame() {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [players, setPlayers] = useState([]);
  const [skinsResults, setSkinsResults] = useState({});
  const [section, setSection] = useState('front');
  const [loading, setLoading] = useState(true);

  // Also supports ad-hoc CSV upload (for quick use outside of saved rounds)
  const [csvMode, setCsvMode] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [handicapType, setHandicapType] = useState('full'); // 'full' or 'half'

  useEffect(() => { fetchRounds(); }, []);

  async function fetchRounds() {
    setLoading(true);
    const { data } = await supabase
      .from('rounds')
      .select('id, file_name, played_date, holes_played, week_number')
      .order('played_date', { ascending: false });
    setRounds(data || []);
    setLoading(false);
  }

  async function loadRound(roundId) {
    if (!roundId) { setPlayers([]); setSkinsResults({}); setSelectedRound(null); return; }

    const { data: round } = await supabase
      .from('rounds')
      .select('holes_played')
      .eq('id', roundId)
      .single();

    // Fetch only degen players' scores for this round
    const { data: scores } = await supabase
      .from('player_scores')
      .select('hole_number, gross_score, full_handicap, players(id, name)')
      .eq('round_id', roundId);

    if (!scores || scores.length === 0) {
      setPlayers([]);
      setSkinsResults({});
      setSelectedRound(roundId);
      return;
    }

    const sec = round?.holes_played || 'front';
    setSection(sec);

    // Rebuild player objects from score rows
    const playerMap = {};
    scores.forEach(s => {
      if (!s.players) return;
      const name = s.players.name;
      if (!playerMap[name]) {
        playerMap[name] = { name, fullHandicap: s.full_handicap, halfHandicap: s.full_handicap / 2, scores: [], originalIndex: Object.keys(playerMap).length };
      }
      playerMap[name].scores.push({ hole: s.hole_number, gross: s.gross_score });
    });

    const playerList = Object.values(playerMap).map(p => ({
      ...p,
      scores: p.scores.sort((a, b) => a.hole - b.hole).map(s => s.gross),
    }));

    setPlayers(playerList);
    setSkinsResults(calculateSkins(playerList, sec, handicapType));
    setSelectedRound(roundId);
  }

  const holeHandicaps = getHoleHandicaps(section);

  // ── Ad-hoc CSV upload (same logic as original app) ────────────────────────
  const { parseRoundCSV } = require('../../utils/csvParser');

  function handleDrag(e) { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === 'dragenter' || e.type === 'dragover'); }
  function handleDrop(e) { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files?.[0]) handleCSV(e.dataTransfer.files[0]); }
  function handleChange(e) { e.preventDefault(); if (e.target.files?.[0]) handleCSV(e.target.files[0]); }

  async function handleCSV(file) {
    try {
      const result = await parseRoundCSV(file);
      setSection(result.section);
      setPlayers(result.players);
      setSkinsResults(calculateSkins(result.players, result.section, handicapType));
      setSelectedRound(null);
    } catch (err) {
      console.error(err);
    }
  }

  // Recalculate when handicap type toggle changes
  React.useEffect(() => {
    if (players.length > 0) {
      setSkinsResults(calculateSkins(players, section, handicapType));
    }
  }, [handicapType]); // eslint-disable-line

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between gap-3 mb-4 flex-wrap">
        <div className="d-flex gap-2">
          <button className={`btn btn-sm ${!csvMode ? 'btn-matador' : 'btn-outline-secondary'}`} onClick={() => setCsvMode(false)}>
            Load from History
          </button>
          <button className={`btn btn-sm ${csvMode ? 'btn-matador' : 'btn-outline-secondary'}`} onClick={() => setCsvMode(true)}>
            Upload CSV
          </button>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted small fw-semibold">Handicap:</span>
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${handicapType === 'full' ? 'btn-matador' : 'btn-outline-secondary'}`}
              onClick={() => setHandicapType('full')}
            >
              Full
            </button>
            <button
              className={`btn ${handicapType === 'half' ? 'btn-matador' : 'btn-outline-secondary'}`}
              onClick={() => setHandicapType('half')}
            >
              Half
            </button>
          </div>
        </div>
      </div>

      {!csvMode ? (
        <div className="mb-4">
          <label className="form-label fw-semibold">Select a round:</label>
          {loading ? <div className="spinner-border spinner-border-sm text-matador-red ms-2"></div> : (
            <select className="form-select" onChange={e => loadRound(e.target.value)} defaultValue="">
              <option value="">-- Choose a round --</option>
              {rounds.map(r => (
                <option key={r.id} value={r.id}>
                  {r.played_date || 'Unknown date'} — {r.holes_played === 'front' ? 'Front 9' : 'Back 9'}{r.week_number ? ` (Week ${r.week_number})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div
          className={`upload-zone p-4 text-center mb-4 ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        >
          <i className="bi bi-cloud-upload fs-2 text-matador-red mb-2 d-block"></i>
          <p className="mb-2 fw-semibold">Drag & drop CSV or</p>
          <label className="btn btn-matador btn-sm">
            Choose File
            <input type="file" accept=".csv" onChange={handleChange} className="d-none" />
          </label>
        </div>
      )}

      {/* ── Skins Results Table (same as original app) ── */}
      {Object.keys(skinsResults).length > 0 && players.length > 0 && (
        <>
          <div className="card shadow mb-4 border-0 border-matador">
            <div className="card-header bg-matador-black text-white py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="bi bi-table me-2"></i>Skins Results</h5>
              <span className="badge bg-light text-dark">{section === 'front' ? 'Front 9 (Holes 1–9)' : 'Back 9 (Holes 10–18)'}</span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="bg-matador-black text-white">
                    <tr>
                      <th className="text-start" style={{ minWidth: 130 }}>Player</th>
                      <th className="text-center">{handicapType === 'half' ? '½ HC' : 'Full HC'}</th>
                      {[...Array(9)].map((_, i) => {
                        const holeNumber = section === 'front' ? i + 1 : i + 10;
                        return (
                          <th key={holeNumber} className="text-center">
                            <div>Hole {holeNumber}</div>
                            <div className="fw-bold text-dark small">HCP {holeHandicaps[i]}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(player => (
                      <tr key={player.name}>
                        <td className="fw-bold">{player.name}</td>
                        <td className="text-center">{handicapType === 'half' ? player.halfHandicap : player.fullHandicap}</td>
                        {[...Array(9)].map((_, i) => {
                          const holeNumber = section === 'front' ? i + 1 : i + 10;
                          const result = skinsResults[holeNumber];
                          const score = result?.scores.find(s => s.name === player.name);
                          return (
                            <td key={holeNumber} className={`text-center ${result?.winner === player.name ? 'table-matador-success' : ''}`}>
                              <div className="fw-bold">{score?.net}</div>
                              <small className="text-muted">({score?.gross}{score?.strokes > 0 ? `-${score.strokes}` : ''})</small>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-top border-dark bg-light">
                      <td className="fw-bold">Winner</td>
                      <td></td>
                      {[...Array(9)].map((_, i) => {
                        const holeNumber = section === 'front' ? i + 1 : i + 10;
                        const result = skinsResults[holeNumber];
                        return (
                          <td key={holeNumber} className="text-center">
                            {result?.winner === 'No Winner'
                              ? <span className="text-muted fw-semibold">None</span>
                              : <span className="badge badge-matador">{result?.winner}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card shadow border-0 border-matador">
            <div className="card-header bg-matador-red text-white py-3">
              <h5 className="mb-0"><i className="bi bi-award me-2"></i>Winners by Hole</h5>
            </div>
            <div className="card-body">
              {Object.entries(skinsResults).filter(([, r]) => r.winner !== 'No Winner').length === 0 && (
                <p className="text-muted mb-0">No skins won this round.</p>
              )}
              {Object.entries(skinsResults)
                .filter(([, r]) => r.winner !== 'No Winner')
                .map(([hole, result]) => (
                  <div key={hole} className="d-flex justify-content-between align-items-center border-bottom border-danger py-3">
                    <div>
                      <i className="bi bi-flag-fill text-matador-red me-2"></i>
                      <span className="fw-bold">{result.winner}</span>
                      <span className="text-muted ms-2">won hole {hole}</span>
                    </div>
                    <span className="badge badge-matador">1 skin</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {selectedRound && players.length === 0 && (
        <div className="alert alert-info">No Degen players found in this round. Make sure players are marked as Degens in the Admin panel.</div>
      )}
    </div>
  );
}
