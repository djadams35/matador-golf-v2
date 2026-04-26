import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateSkins } from '../../utils/skinsCalculator';
import { getHoleHandicaps, formatHandicap } from '../../utils/handicapUtils';

const HDCP_OPTIONS = [
  { label: 'Full', value: 1 },
  { label: '75%',  value: 0.75 },
  { label: '50%',  value: 0.5 },
  { label: '25%',  value: 0.25 },
];

export default function SkinsGame() {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [players, setPlayers] = useState([]);
  const [skinsResults, setSkinsResults] = useState({});
  const [section, setSection] = useState('front');
  const [loading, setLoading] = useState(true);
  const [seasonSkins, setSeasonSkins] = useState({}); // keyed by multiplier string
  const [multiplier, setMultiplier] = useState(1);
  const [showAllSkins, setShowAllSkins] = useState(false);

  useEffect(() => { fetchRounds(); calculateSeasonSkins(); }, []); // eslint-disable-line

  async function fetchRounds() {
    setLoading(true);
    const { data } = await supabase
      .from('rounds')
      .select('id, file_name, played_date, holes_played, week_number')
      .order('played_date', { ascending: false });
    const roundList = data || [];
    setRounds(roundList);
    setLoading(false);
    if (roundList.length > 0) loadRound(roundList[0].id);
  }

  async function calculateSeasonSkins() {
    const { data: scores } = await supabase
      .from('player_scores')
      .select('round_id, hole_number, gross_score, full_handicap, players(name), rounds(holes_played)');

    if (!scores) return;

    const roundMap = {};
    scores.forEach(s => {
      if (!s.players || !s.rounds) return;
      const roundId = s.round_id;
      if (!roundMap[roundId]) roundMap[roundId] = { section: s.rounds.holes_played, playerMap: {} };
      const name = s.players.name;
      if (!roundMap[roundId].playerMap[name]) {
        roundMap[roundId].playerMap[name] = {
          name,
          fullHandicap: s.full_handicap,
          scores: [],
          originalIndex: Object.keys(roundMap[roundId].playerMap).length,
        };
      }
      roundMap[roundId].playerMap[name].scores.push({ hole: s.hole_number, gross: s.gross_score });
    });

    const counts = { 1: {}, 0.75: {}, 0.5: {}, 0.25: {} };

    Object.values(roundMap).forEach(round => {
      const playerList = Object.values(round.playerMap).map(p => ({
        ...p,
        scores: p.scores.sort((a, b) => a.hole - b.hole).map(s => s.gross),
      }));
      HDCP_OPTIONS.forEach(({ value: m }) => {
        const skins = calculateSkins(playerList, round.section, m);
        Object.values(skins).forEach(result => {
          if (result.winner !== 'No Winner') {
            counts[m][result.winner] = (counts[m][result.winner] || 0) + 1;
          }
        });
      });
    });

    const toSorted = c => Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .map(([name, skins]) => ({ name, skins }));

    setSeasonSkins({
      1: toSorted(counts[1]),
      0.75: toSorted(counts[0.75]),
      0.5: toSorted(counts[0.5]),
      0.25: toSorted(counts[0.25]),
    });
  }

  async function loadRound(roundId) {
    if (!roundId) { setPlayers([]); setSkinsResults({}); setSelectedRound(null); return; }

    const { data: round } = await supabase
      .from('rounds')
      .select('holes_played')
      .eq('id', roundId)
      .single();

    const { data: scores } = await supabase
      .from('player_scores')
      .select('hole_number, gross_score, full_handicap, players(id, name)')
      .eq('round_id', roundId);

    if (!scores || scores.length === 0) {
      setPlayers([]); setSkinsResults({}); setSelectedRound(roundId); return;
    }

    const sec = round?.holes_played || 'front';
    setSection(sec);

    const playerMap = {};
    scores.forEach(s => {
      if (!s.players) return;
      const name = s.players.name;
      if (!playerMap[name]) {
        playerMap[name] = { name, fullHandicap: s.full_handicap, scores: [], originalIndex: Object.keys(playerMap).length };
      }
      playerMap[name].scores.push({ hole: s.hole_number, gross: s.gross_score });
    });

    const playerList = Object.values(playerMap).map(p => ({
      ...p,
      scores: p.scores.sort((a, b) => a.hole - b.hole).map(s => s.gross),
    }));

    setPlayers(playerList);
    setSkinsResults(calculateSkins(playerList, sec, multiplier));
    setSelectedRound(roundId);
  }

  const holeHandicaps = getHoleHandicaps(section);

  // Recalculate when multiplier changes
  React.useEffect(() => {
    if (players.length > 0) setSkinsResults(calculateSkins(players, section, multiplier));
    setShowAllSkins(false);
  }, [multiplier]); // eslint-disable-line

  const currentSeasonData = seasonSkins[multiplier] || [];
  const currentLabel = HDCP_OPTIONS.find(o => o.value === multiplier)?.label;

  // Effective HC for display — multiply and format
  const effectiveHC = (player) => {
    const val = player.fullHandicap * multiplier;
    // Show as integer if whole, otherwise 1 decimal
    const display = val % 1 === 0 ? val : parseFloat(val.toFixed(2));
    return formatHandicap(display);
  };

  return (
    <div>
      {/* Handicap toggle — top of page so it controls both leaderboard and round view */}
      <div className="d-flex align-items-center gap-2 mb-4">
        <span className="text-muted small fw-semibold">Handicap:</span>
        <div className="btn-group btn-group-sm">
          {HDCP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`btn ${multiplier === opt.value ? 'btn-matador' : 'btn-outline-secondary'}`}
              onClick={() => setMultiplier(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Season Skins Leaderboard */}
      {currentSeasonData.length > 0 && (
        <div className="card border-0 shadow-sm mb-4 border-matador">
          <div className="card-header bg-matador-red text-white">
            <h6 className="mb-0"><i className="bi bi-trophy-fill me-2"></i>Season Skins — {currentLabel} Handicap</h6>
          </div>
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead className="bg-matador-black text-white">
                <tr><th>Rank</th><th>Player</th><th className="text-center">Skins</th></tr>
              </thead>
              <tbody>
                {(showAllSkins ? currentSeasonData : currentSeasonData.slice(0, 3)).map((row, i) => (
                  <tr key={row.name} className={i === 0 ? 'table-matador-success' : ''}>
                    <td className="fw-bold">{i + 1}</td>
                    <td>{row.name}</td>
                    <td className="text-center"><span className="badge badge-matador">{row.skins}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentSeasonData.length > 3 && (
              <div className="text-center py-2 border-top">
                <button className="btn btn-sm btn-link text-muted" onClick={() => setShowAllSkins(s => !s)}>
                  <i className={`bi bi-chevron-${showAllSkins ? 'up' : 'down'} me-1`}></i>
                  {showAllSkins ? 'Show less' : `Show all ${currentSeasonData.length} players`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && rounds.length > 0 && (
        <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
          <span className="text-muted small fw-semibold">Week:</span>
          <div className="d-flex flex-wrap gap-1">
            {[...rounds].reverse().map(r => (
              <button
                key={r.id}
                className={`btn btn-sm ${selectedRound === r.id ? 'btn-matador' : 'btn-outline-secondary'}`}
                onClick={() => loadRound(r.id)}
              >
                {r.week_number ? r.week_number : (r.played_date || 'Unknown')}
              </button>
            ))}
          </div>
        </div>
      )}

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
                      <th className="text-center">{currentLabel} HC</th>
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
                        <td className="text-center">{effectiveHC(player)}</td>
                        {[...Array(9)].map((_, i) => {
                          const holeNumber = section === 'front' ? i + 1 : i + 10;
                          const result = skinsResults[holeNumber];
                          const score = result?.scores.find(s => s.name === player.name);
                          return (
                            <td key={holeNumber} className={`text-center ${result?.winner === player.name ? 'table-matador-success' : ''}`}>
                              <div className="fw-bold">{score?.net}</div>
                              <small className="text-muted">({score?.gross}{score?.strokes > 0 ? `-${score.strokes}` : score?.strokes < 0 ? `+${Math.abs(score.strokes)}` : ''})</small>
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
        <div className="alert alert-info">No players found in this round.</div>
      )}
    </div>
  );
}
