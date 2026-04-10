import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ManageDegens() {
  const [players, setPlayers] = useState([]);
  const [degens, setDegens] = useState({}); // playerId -> { active, has_paid }
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [playersRes, degensRes] = await Promise.all([
      supabase.from('players').select('id, name').order('name'),
      supabase.from('degens').select('player_id, has_paid').eq('active', true),
    ]);
    if (playersRes.data) setPlayers(playersRes.data);
    if (degensRes.data) {
      const map = {};
      degensRes.data.forEach(d => { map[d.player_id] = { active: true, has_paid: d.has_paid }; });
      setDegens(map);
    }
    setLoading(false);
  }

  async function toggleDegen(playerId, playerName) {
    const isDegen = !!degens[playerId];
    if (isDegen) {
      const { error } = await supabase.from('degens').delete().eq('player_id', playerId);
      if (error) { setMessage({ type: 'error', text: error.message }); return; }
      setDegens(prev => { const next = { ...prev }; delete next[playerId]; return next; });
      setMessage({ type: 'success', text: `${playerName} removed from Degens.` });
    } else {
      const { error } = await supabase.from('degens').upsert({ player_id: playerId, active: true, has_paid: false }, { onConflict: 'player_id' });
      if (error) { setMessage({ type: 'error', text: error.message }); return; }
      setDegens(prev => ({ ...prev, [playerId]: { active: true, has_paid: false } }));
      setMessage({ type: 'success', text: `${playerName} added to Degens.` });
    }
  }

  async function togglePaid(e, playerId, playerName) {
    e.stopPropagation();
    const hasPaid = !degens[playerId]?.has_paid;
    const { error } = await supabase.from('degens').update({ has_paid: hasPaid }).eq('player_id', playerId);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setDegens(prev => ({ ...prev, [playerId]: { ...prev[playerId], has_paid: hasPaid } }));
    setMessage({ type: 'success', text: `${playerName} marked as ${hasPaid ? 'paid' : 'unpaid'}.` });
  }

  const degenPlayers = players.filter(p => degens[p.id]);
  const unpaidCount = degenPlayers.filter(p => !degens[p.id]?.has_paid).length;

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-dice-5 me-2 text-matador-red"></i>Manage Degens</h5>
      <p className="text-muted mb-4">
        Toggle players as Degens below. Use the paid checkbox to track who has paid their dues.
      </p>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <>
          {degenPlayers.length > 0 && (
            <div className="mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold mb-0">Degens ({degenPlayers.length})</h6>
                {unpaidCount > 0
                  ? <span className="badge bg-warning text-dark">{unpaidCount} unpaid</span>
                  : <span className="badge bg-success">All paid</span>}
              </div>
              <table className="table table-sm table-bordered align-middle mb-0">
                <thead className="bg-matador-black text-white">
                  <tr>
                    <th>Player</th>
                    <th className="text-center" style={{ width: 100 }}>Paid</th>
                    <th className="text-center" style={{ width: 80 }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {degenPlayers.map(p => {
                    const hasPaid = degens[p.id]?.has_paid;
                    return (
                      <tr key={p.id} className={hasPaid ? '' : 'table-warning'}>
                        <td className="fw-semibold">{p.name}</td>
                        <td className="text-center">
                          <div className="form-check d-flex justify-content-center mb-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={!!hasPaid}
                              onChange={e => togglePaid(e, p.id, p.name)}
                              style={{ cursor: 'pointer', width: '1.2em', height: '1.2em' }}
                            />
                          </div>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-outline-danger" onClick={() => toggleDegen(p.id, p.name)}>
                            <i className="bi bi-x"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h6 className="fw-bold mb-2">All Players</h6>
          <div className="row g-2">
            {players.length === 0 && <div className="col-12 text-muted">No players yet. Upload a round first.</div>}
            {players.filter(p => !degens[p.id]).map(p => (
              <div className="col-12 col-sm-6 col-md-4" key={p.id}>
                <div
                  className="d-flex align-items-center justify-content-between p-3 rounded border border-secondary-subtle bg-light"
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleDegen(p.id, p.name)}
                >
                  <span className="fw-semibold">{p.name}</span>
                  <span className="badge bg-secondary">+ Add</span>
                </div>
              </div>
            ))}
            {players.filter(p => !degens[p.id]).length === 0 && (
              <div className="col-12 text-muted small">All players are Degens.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
