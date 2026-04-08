import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ManageDegens() {
  const [players, setPlayers] = useState([]);
  const [degens, setDegens] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [playersRes, degensRes] = await Promise.all([
      supabase.from('players').select('id, name').order('name'),
      supabase.from('degens').select('player_id').eq('active', true),
    ]);
    if (playersRes.data) setPlayers(playersRes.data);
    if (degensRes.data) setDegens(new Set(degensRes.data.map(d => d.player_id)));
    setLoading(false);
  }

  async function toggleDegen(playerId, playerName) {
    const isDegen = degens.has(playerId);
    if (isDegen) {
      const { error } = await supabase.from('degens').delete().eq('player_id', playerId);
      if (error) { setMessage({ type: 'error', text: error.message }); return; }
      setDegens(prev => { const next = new Set(prev); next.delete(playerId); return next; });
      setMessage({ type: 'success', text: `${playerName} removed from Degens.` });
    } else {
      const { error } = await supabase.from('degens').upsert({ player_id: playerId, active: true }, { onConflict: 'player_id' });
      if (error) { setMessage({ type: 'error', text: error.message }); return; }
      setDegens(prev => new Set([...prev, playerId]));
      setMessage({ type: 'success', text: `${playerName} added to Degens.` });
    }
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-dice-5 me-2 text-matador-red"></i>Manage Degens</h5>
      <p className="text-muted mb-4">
        The Degens are a sub-group of players who participate in the skins game and weekly low net competition.
        Toggle players on or off below. Changes take effect immediately.
      </p>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <div className="row g-2">
          {players.length === 0 && <div className="col-12 text-muted">No players yet. Upload a round first.</div>}
          {players.map(p => {
            const isDegen = degens.has(p.id);
            return (
              <div className="col-12 col-sm-6 col-md-4" key={p.id}>
                <div
                  className={`d-flex align-items-center justify-content-between p-3 rounded border ${isDegen ? 'border-matador bg-white' : 'border-secondary-subtle bg-light'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleDegen(p.id, p.name)}
                >
                  <span className="fw-semibold">{p.name}</span>
                  <span className={`badge ${isDegen ? 'badge-matador' : 'bg-secondary'}`}>
                    {isDegen ? 'Degen ✓' : 'Not Degen'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
