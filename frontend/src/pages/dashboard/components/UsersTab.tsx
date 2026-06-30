import React, { useState } from 'react';
import { Alert } from '@mui/material';
import { getThemeColors } from '../constants';

interface UsersTabProps {
  allUsers: any[];
  userLoading: boolean;
  roleAccess: any;
  token: string | null;
  currentUser: any;
  loadAllUsers: () => Promise<void>;
  loadAssignments: () => Promise<void>;
  theme: 'dark' | 'light';
}

export const UsersTab: React.FC<UsersTabProps> = ({
  allUsers,
  userLoading,
  roleAccess,
  token,
  currentUser,
  loadAllUsers,
  loadAssignments,
  theme,
}) => {
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState('Worker');
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const AMBER = colors.AMBER;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSuccess(null);
    setUserError(null);
    try {
      const res = await fetch('/_/backend/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newUserName,
          phone: newUserPhone,
          role: newUserRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      setUserSuccess(`User ${data.name} created successfully!`);
      setNewUserName('');
      setNewUserPhone('');
      setNewUserRole('Worker');
      loadAllUsers();
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleUpdateUserRole = async (targetId: string, newRole: string) => {
    try {
      const res = await fetch(`/_/backend/auth/users/${targetId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        loadAllUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update role');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleUserActive = async (targetId: string) => {
    try {
      const res = await fetch(`/_/backend/auth/users/${targetId}/toggle-active`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAllUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to toggle status');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (targetId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This will also remove all their assignments.')) return;
    try {
      const res = await fetch(`/_/backend/auth/users/${targetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAllUsers();
        loadAssignments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete user');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>User Access & Credentials Registry</h2>

        {userSuccess && <Alert severity="success" style={{ fontSize: '12px', marginBottom: '10px' }}>{userSuccess}</Alert>}
        {userError && <Alert severity="error" style={{ fontSize: '12px', marginBottom: '10px' }}>{userError}</Alert>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          
          {/* Register New User Form */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', height: 'fit-content' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Register New Operator</div>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Full Name</div>
                <input
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Phone Number</div>
                <input
                  value={newUserPhone}
                  onChange={e => setNewUserPhone(e.target.value)}
                  placeholder="e.g. +919999999999"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>System Role</div>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Worker">Worker (Operator)</option>
                  <option value="Manager">Manager (Supervisor)</option>
                  <option value="Admin">Admin (Plant Admin)</option>
                  <option value="Super Admin">Super Admin (System Owner)</option>
                </select>
              </div>

              <button type="submit" style={{ marginTop: '8px', padding: '10px 20px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Create User Credentials
              </button>
            </form>
          </div>

          {/* Registered Users List */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Active Credentials Registry ({allUsers.length})</div>
            {userLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass-card" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton-shimmer" style={{ height: '13px', width: '140px', borderRadius: '4px' }} />
                      <div className="skeleton-shimmer" style={{ height: '10px', width: '200px', borderRadius: '4px' }} />
                    </div>
                    <div className="skeleton-shimmer" style={{ height: '18px', width: '60px', borderRadius: '12px' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                {allUsers.map((u: any) => (
                  <div key={u._id} className="glass-card" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.ngId} · {u.phone}</div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: u.isActive ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)',
                        color: u.isActive ? GREEN : RED,
                        fontWeight: 800
                      }}>
                        {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid var(--border-light)`, paddingTop: '8px', marginTop: '4px' }}>
                      {/* Role Selector */}
                      {roleAccess.isSuperAdmin && u._id !== currentUser?._id ? (
                        <select
                          value={u.role}
                          onChange={e => handleUpdateUserRole(u._id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '11px', border: `1px solid var(--border)`, borderRadius: '6px' }}
                        >
                          {['Worker', 'Manager', 'Admin', 'Super Admin'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{u.role}</span>
                      )}

                      {/* Toggle Active / Delete controls */}
                      {u._id !== currentUser?._id && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleToggleUserActive(u._id)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: `1px solid ${u.isActive ? AMBER : GREEN}40`,
                              background: `${u.isActive ? AMBER : GREEN}15`,
                              color: u.isActive ? AMBER : GREEN,
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: `1px solid ${RED}40`,
                              background: `${RED}15`,
                              color: RED,
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
