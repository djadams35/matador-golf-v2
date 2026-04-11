import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ManageAdmins({ currentUsername }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Change password form
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpSaving, setCpSaving] = useState(false);

  // Add admin form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => { fetchAdmins(); }, []);

  async function fetchAdmins() {
    setLoading(true);
    const { data, error } = await supabase.from('admin_users').select('id, username').order('username');
    if (error) setMessage({ type: 'error', text: error.message });
    else setAdmins(data || []);
    setLoading(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    setMessage(null);
    if (cpNew !== cpConfirm) { setMessage({ type: 'error', text: 'New passwords do not match.' }); return; }
    if (cpNew.length < 6) { setMessage({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }

    setCpSaving(true);
    // Verify current password
    const { data: match } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', currentUsername)
      .eq('password', cpCurrent)
      .maybeSingle();

    if (!match) {
      setMessage({ type: 'error', text: 'Current password is incorrect.' });
      setCpSaving(false);
      return;
    }

    const { error } = await supabase
      .from('admin_users')
      .update({ password: cpNew })
      .eq('username', currentUsername);

    if (error) setMessage({ type: 'error', text: error.message });
    else {
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setCpCurrent(''); setCpNew(''); setCpConfirm('');
    }
    setCpSaving(false);
  }

  async function addAdmin(e) {
    e.preventDefault();
    setMessage(null);
    if (!newUsername.trim()) { setMessage({ type: 'error', text: 'Username is required.' }); return; }
    if (newPassword.length < 6) { setMessage({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }

    setAddSaving(true);
    const { error } = await supabase
      .from('admin_users')
      .insert({ username: newUsername.trim().toLowerCase(), password: newPassword });

    if (error) setMessage({ type: 'error', text: error.message.includes('unique') ? `Username "${newUsername}" is already taken.` : error.message });
    else {
      setMessage({ type: 'success', text: `Admin "${newUsername}" added.` });
      setNewUsername(''); setNewPassword('');
      fetchAdmins();
    }
    setAddSaving(false);
  }

  async function deleteAdmin(admin) {
    if (!window.confirm(`Remove admin "${admin.username}"?`)) return;
    setMessage(null);
    const { error } = await supabase.from('admin_users').delete().eq('id', admin.id);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: `Removed "${admin.username}".` }); fetchAdmins(); }
  }

  return (
    <div>
      <h5 className="fw-bold mb-4"><i className="bi bi-shield-lock me-2 text-matador-red"></i>Admin Settings</h5>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} py-2 mb-4`}>
          {message.text}
        </div>
      )}

      <div className="row g-4">
        {/* Change password */}
        <div className="col-12 col-md-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-matador-black text-white">
              <strong><i className="bi bi-key me-2"></i>Change Your Password</strong>
              <span className="ms-2 text-muted small">({currentUsername})</span>
            </div>
            <div className="card-body">
              <form onSubmit={changePassword}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Current Password</label>
                  <input type="password" className="form-control" value={cpCurrent}
                    onChange={e => setCpCurrent(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">New Password</label>
                  <input type="password" className="form-control" value={cpNew}
                    onChange={e => setCpNew(e.target.value)} required minLength={6} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Confirm New Password</label>
                  <input type="password" className="form-control" value={cpConfirm}
                    onChange={e => setCpConfirm(e.target.value)} required minLength={6} />
                </div>
                <button type="submit" className="btn btn-matador w-100" disabled={cpSaving}>
                  {cpSaving ? <span className="spinner-border spinner-border-sm me-2"></span> : null}
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Admin users list + add */}
        <div className="col-12 col-md-7">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-matador-black text-white">
              <strong><i className="bi bi-people me-2"></i>Admin Users</strong>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-3"><span className="spinner-border spinner-border-sm text-matador-red"></span></div>
              ) : (
                <table className="table table-hover align-middle mb-0">
                  <tbody>
                    {admins.map(a => (
                      <tr key={a.id}>
                        <td className="fw-semibold ps-3">
                          {a.username}
                          {a.username === currentUsername && (
                            <span className="badge bg-secondary ms-2 fw-normal">you</span>
                          )}
                        </td>
                        <td className="text-end pe-3">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteAdmin(a)}
                            disabled={a.username === currentUsername}
                            title={a.username === currentUsername ? "Can't remove your own account" : 'Remove admin'}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-matador-black text-white">
              <strong><i className="bi bi-person-plus me-2"></i>Add Admin</strong>
            </div>
            <div className="card-body">
              <form onSubmit={addAdmin}>
                <div className="row g-2">
                  <div className="col-12 col-sm-5">
                    <input type="text" className="form-control" placeholder="Username"
                      value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
                  </div>
                  <div className="col-12 col-sm-5">
                    <input type="password" className="form-control" placeholder="Password (min 6)"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="col-12 col-sm-2">
                    <button type="submit" className="btn btn-matador w-100" disabled={addSaving}>
                      {addSaving ? <span className="spinner-border spinner-border-sm"></span> : 'Add'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
