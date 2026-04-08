import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function RoundLog() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

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

  async function deleteRound(round) {
    if (!window.confirm(`Delete round "${round.file_name}"? This will permanently remove all scores, skins, and match results for this round.`)) return;

    // Delete from storage
    await supabase.storage.from('round-csvs').remove([round.storage_path]);

    // Delete from DB (cascades to player_scores, skins_results, match_results, round_net_totals)
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
          <table className="table table-hover">
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
              {rounds.map(r => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.file_name}</td>
                  <td>{r.played_date || '—'}</td>
                  <td>{r.week_number ?? '—'}</td>
                  <td>
                    <span className={`badge ${r.holes_played === 'front' ? 'bg-success' : 'bg-primary'}`}>
                      {r.holes_played === 'front' ? 'Front 9' : 'Back 9'}
                    </span>
                  </td>
                  <td className="text-muted small">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRound(r)}>
                      <i className="bi bi-trash me-1"></i>Delete
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
