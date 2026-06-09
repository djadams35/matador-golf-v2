import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { friendlyAdminError } from '../../utils/errorUtils';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  if (!y || !m || !d) return dateStr;
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ManageSubs() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchSubs(); }, []);

  async function fetchSubs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('round_subs')
      .select(`
        id,
        rounds(week_number, played_date),
        sub:players!sub_player_id(name),
        original:players!original_player_id(name)
      `);

    if (error) {
      setMessage({ type: 'error', text: friendlyAdminError(error) });
      setSubs([]);
    } else {
      const rows = (data || []).map(r => ({
        id: r.id,
        week: r.rounds?.week_number ?? null,
        playedDate: r.rounds?.played_date ?? null,
        subName: r.sub?.name ?? '—',
        originalName: r.original?.name ?? '—',
      }));
      // Most recent week first; unknown weeks sink to the bottom
      rows.sort((a, b) => (b.week ?? -1) - (a.week ?? -1));
      setSubs(rows);
    }
    setLoading(false);
  }

  // Total appearances per sub
  const totals = {};
  subs.forEach(s => { totals[s.subName] = (totals[s.subName] || 0) + 1; });
  const totalsList = Object.entries(totals)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  if (loading) {
    return <div className="text-center py-4"><span className="spinner-border text-matador-red"></span></div>;
  }

  return (
    <div>
      <h5 className="fw-bold mb-3"><i className="bi bi-arrow-left-right me-2 text-matador-red"></i>Subs</h5>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-3`}>
          {message.text}
        </div>
      )}

      {subs.length === 0 ? (
        <p className="text-muted">No subs recorded yet. Subs are tracked automatically when you assign them during round upload.</p>
      ) : (
        <div className="row g-4">
          {/* Totals */}
          <div className="col-12 col-md-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-matador-black text-white">
                <strong><i className="bi bi-trophy me-2"></i>Total Times Subbed</strong>
              </div>
              <div className="card-body p-0">
                <table className="table table-hover align-middle mb-0">
                  <tbody>
                    {totalsList.map(t => (
                      <tr key={t.name}>
                        <td className="fw-semibold ps-3">{t.name}</td>
                        <td className="text-end pe-3">
                          <span className="badge bg-matador-red">{t.count}×</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail log */}
          <div className="col-12 col-md-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-matador-black text-white">
                <strong><i className="bi bi-list-ul me-2"></i>Sub Log</strong>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-3">Week</th>
                        <th>Sub</th>
                        <th>Subbed For</th>
                        <th className="pe-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map(s => (
                        <tr key={s.id}>
                          <td className="ps-3">{s.week != null ? `Week ${s.week}` : '—'}</td>
                          <td className="fw-semibold">{s.subName}</td>
                          <td className="text-muted">{s.originalName}</td>
                          <td className="small text-muted pe-3">{formatDate(s.playedDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
