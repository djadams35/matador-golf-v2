import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { friendlyAdminError } from '../../utils/errorUtils';
import { formatHandicap } from '../../utils/handicapUtils';

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
    const [subsRes, netsRes, matchesRes] = await Promise.all([
      supabase.from('round_subs').select(`
        id, round_id, sub_player_id,
        rounds(week_number, played_date),
        sub:players!sub_player_id(name),
        original:players!original_player_id(name)
      `),
      supabase.from('round_net_totals').select('round_id, player_id, gross_total, net_total'),
      supabase.from('match_results').select('week_number, low_match_detail, high_match_detail'),
    ]);

    if (subsRes.error) {
      setMessage({ type: 'error', text: friendlyAdminError(subsRes.error) });
      setSubs([]);
      setLoading(false);
      return;
    }

    // Handicap that week = gross - net (net_total is stored as gross - full_handicap)
    const hcMap = {};
    (netsRes.data || []).forEach(n => {
      if (n.gross_total != null && n.net_total != null) {
        hcMap[`${n.round_id}|${n.player_id}`] = n.gross_total - n.net_total;
      }
    });

    // Find a player's head-to-head match for a given week → opponent + result
    const matches = matchesRes.data || [];
    const findMatch = (week, name) => {
      for (const m of matches) {
        if (m.week_number !== week) continue;
        for (const d of [m.low_match_detail, m.high_match_detail]) {
          if (!d || !d.playerA || !d.playerB) continue;
          if (d.playerA === name) {
            return { opp: d.playerB, result: d.winner === 'A' ? 'W' : d.winner === 'B' ? 'L' : 'T' };
          }
          if (d.playerB === name) {
            return { opp: d.playerA, result: d.winner === 'B' ? 'W' : d.winner === 'A' ? 'L' : 'T' };
          }
        }
      }
      return null;
    };

    const rows = (subsRes.data || []).map(r => {
      const week = r.rounds?.week_number ?? null;
      const subName = r.sub?.name ?? '—';
      const hc = hcMap[`${r.round_id}|${r.sub_player_id}`];
      const match = findMatch(week, subName);
      return {
        id: r.id,
        week,
        playedDate: r.rounds?.played_date ?? null,
        subName,
        originalName: r.original?.name ?? '—',
        hc: hc != null ? hc : null,
        opponent: match?.opp ?? null,
        result: match?.result ?? null,
      };
    });
    rows.sort((a, b) => (b.week ?? -1) - (a.week ?? -1));
    setSubs(rows);
    setLoading(false);
  }

  // Total appearances per sub
  const totals = {};
  subs.forEach(s => { totals[s.subName] = (totals[s.subName] || 0) + 1; });
  const totalsList = Object.entries(totals)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const resultBadge = (r) => {
    if (!r) return <span className="text-muted">—</span>;
    const cls = r === 'W' ? 'bg-success' : r === 'L' ? 'bg-danger' : 'bg-secondary';
    const label = r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Tie';
    return <span className={`badge ${cls}`}>{label}</span>;
  };

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
          <div className="col-12 col-lg-4">
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

          {/* Detail log with handicap + result */}
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-matador-black text-white">
                <strong><i className="bi bi-clipboard-data me-2"></i>Sub Appearances &amp; Handicaps</strong>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-3">Week</th>
                        <th>Date</th>
                        <th>Sub</th>
                        <th className="text-center">HC</th>
                        <th>Played</th>
                        <th>Subbed For</th>
                        <th className="text-center pe-3">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map(s => (
                        <tr key={s.id}>
                          <td className="ps-3">{s.week != null ? `Wk ${s.week}` : '—'}</td>
                          <td className="small text-muted">{formatDate(s.playedDate)}</td>
                          <td className="fw-semibold">{s.subName}</td>
                          <td className="text-center">{s.hc != null ? formatHandicap(s.hc) : '—'}</td>
                          <td>{s.opponent || <span className="text-muted">—</span>}</td>
                          <td className="text-muted">{s.originalName}</td>
                          <td className="text-center pe-3">{resultBadge(s.result)}</td>
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
