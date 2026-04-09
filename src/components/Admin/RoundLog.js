import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function RoundLog() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState({}); // roundId -> { played_date, week_number }
  const [saving, setSaving] = useState({});

  useEffect(() => { fetchRounds(); }, []);

  async function fetchRounds() {
    setLoading(true);
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setMessage({ type: 'error', text: error.message });
    else setRounds(data || []);
    setLoading(false);
  }

  function startEdit(r) {
    setEditing(prev => ({
      ...prev,
      [r.id]: { played_date: r.played_date || '', week_number: r.week_number ?? '' },
    }));
  }

  function cancelEdit(id) {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveEdit(r) {
    setSaving(prev => ({ ...prev, [r.id]: true }));
    const { played_date, week_number } = editing[r.id];
    const { error } = await supabase.from('rounds').update({
      played_date: played_date || null,
      week_number: week_number !== '' ? parseInt(week_number) : null,
    }).eq('id', r.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: `Updated "${r.file_name}"` });
      cancelEdit(r.id);
      fetchRounds();
    }
    setSaving(prev => ({ ...prev, [r.id]: false }));
  }

  async function deleteRound(round) {
    if (!window.confirm(`Delete round "${round.file_name}"? This will permanently remove all scores, skins, and match results for this round.`)) return;

    await supabase.storage.from('round-csvs').remove([round.storage_path]);

    const { error } = await supabase.from('rounds').delete().eq('id', round.id);
    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setMessage({ type: 'success', text: `Deleted "${round.file_name}"` });
      fetchRounds();
    }
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-journal-text me-2 text-matador-red"></i>Round Log</h5>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="bg-matador-black text-white">
              <tr>
                <th>File</th>
                <th>Date Played</th>
                <th>Week #</th>
                <th>Holes</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rounds.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No rounds uploaded yet.</td></tr>
              )}
              {rounds.map(r => {
                const isEditing = !!editing[r.id];
                const isSaving = !!saving[r.id];
                const edit = editing[r.id] || {};

                return (
                  <tr key={r.id}>
                    <td className="fw-semibold">{r.file_name}</td>
                    <td>
                      {isEditing
                        ? <input type="date" className="form-control form-control-sm" style={{ minWidth: 140 }}
                            value={edit.played_date}
                            onChange={e => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], played_date: e.target.value } }))} />
                        : r.played_date || '—'}
                    </td>
                    <td>
                      {isEditing
                        ? <input type="number" className="form-control form-control-sm" style={{ width: 80 }}
                            value={edit.week_number}
                            min="1"
                            onChange={e => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], week_number: e.target.value } }))} />
                        : r.week_number ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${r.holes_played === 'front' ? 'bg-success' : 'bg-primary'}`}>
                        {r.holes_played === 'front' ? 'Front 9' : 'Back 9'}
                      </span>
                    </td>
                    <td className="text-muted small">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      {isEditing ? (
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-matador" onClick={() => saveEdit(r)} disabled={isSaving}>
                            {isSaving ? <span className="spinner-border spinner-border-sm"></span> : 'Save'}
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => cancelEdit(r.id)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => startEdit(r)}>
                            <i className="bi bi-pencil me-1"></i>Edit
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRound(r)}>
                            <i className="bi bi-trash me-1"></i>Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
