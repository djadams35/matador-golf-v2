import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { friendlyAdminError } from '../../utils/errorUtils';

export default function ManageAdmins() {
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  async function changePassword(e) {
    e.preventDefault();
    setMessage(null);
    if (cpNew !== cpConfirm) { setMessage({ type: 'error', text: 'Passwords do not match.' }); return; }
    if (cpNew.length < 6) { setMessage({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: cpNew });
    if (error) setMessage({ type: 'error', text: friendlyAdminError(error) });
    else {
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setCpNew(''); setCpConfirm('');
    }
    setSaving(false);
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
        <div className="col-12 col-md-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-matador-black text-white">
              <strong><i className="bi bi-key me-2"></i>Change Password</strong>
            </div>
            <div className="card-body">
              <form onSubmit={changePassword}>
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
                <button type="submit" className="btn btn-matador w-100" disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : null}
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-matador-black text-white">
              <strong><i className="bi bi-people me-2"></i>Managing Admin Users</strong>
            </div>
            <div className="card-body text-muted small">
              <p>Admin accounts are managed directly in the Supabase Dashboard.</p>
              <p className="mb-1">To add or remove an admin:</p>
              <ol className="mb-0">
                <li>Go to <strong>supabase.com</strong> → your project</li>
                <li>Navigate to <strong>Authentication → Users</strong></li>
                <li>Add or delete users there</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
