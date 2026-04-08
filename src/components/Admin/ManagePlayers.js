import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ManagePlayers() {
  const [players, setPlayers] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchPlayers(); }, []);

  async function fetchPlayers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name');
    if (error) setMessage({ type: 'error', text: error.message });
    else setPlayers(data || []);
    setLoading(false);
  }

  async function addPlayer(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('players').insert({ name: newName.trim() });
    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setNewName('');
      setMessage({ type: 'success', text: `Added ${newName.trim()}` });
      fetchPlayers();
    }
    setSaving(false);
  }

  async function deletePlayer(id, name) {
    if (!window.confirm(`Delete player "${name}"? This will also remove all their scores.`)) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setMessage({ type: 'success', text: `Deleted ${name}` });
      fetchPlayers();
    }
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-person me-2 text-matador-red"></i>Manage Players</h5>
      <p className="text-muted mb-4">Players are also added automatically when you upload a round CSV.</p>

      <form onSubmit={addPlayer} className="d-flex gap-2 mb-4">
        <input
          type="text"
          className="form-control"
          placeholder="Player name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button type="submit" className="btn btn-matador text-nowrap" disabled={saving}>
          <i className="bi bi-plus-circle me-1"></i>Add
        </button>
      </form>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead className="bg-matador-black text-white">
              <tr><th>Name</th><th style={{width: 80}}>Actions</th></tr>
            </thead>
            <tbody>
              {players.length === 0 && (
                <tr><td colSpan={2} className="text-center text-muted py-4">No players yet. Upload a round to add them automatically.</td></tr>
              )}
              {players.map(p => (
                <tr key={p.id}>
                  <td className="fw-semibold">{p.name}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deletePlayer(p.id, p.name)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
