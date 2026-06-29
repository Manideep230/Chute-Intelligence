import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useRoleAccess } from '../hooks/useRoleAccess';

const API = 'http://localhost:5000';

interface TimelineEntry {
  timestamp: string;
  action: string;
  note: string;
  performedBy: { name: string; role: string } | null;
}

interface Incident {
  _id: string;
  chuteId: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Investigating' | 'Escalated' | 'Resolved';
  incidentType: string;
  rootCause: string;
  correctionAction: string;
  affectedZone: number | null;
  timeline: TimelineEntry[];
  reportedBy: { name: string; role: string; ngId: string } | null;
  assignedTo: { name: string; role: string } | null;
  closedBy: { name: string; role: string } | null;
  closedAt: string | null;
  createdAt: string;
}

const SEV_COLORS: Record<string, string> = {
  Critical: '#F43F5E',
  High: '#FB923C',
  Medium: '#FBBF24',
  Low: '#34D399',
};

const STATUS_COLORS: Record<string, string> = {
  Open: '#00D4FF',
  Investigating: '#A78BFA',
  Escalated: '#FB923C',
  Resolved: '#34D399',
};

function badge(label: string, color: string) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1,
      background: color + '22', color, border: `1px solid ${color}55`,
    }}>{label}</span>
  );
}

interface Props {
  activeChuteId?: string;
}

export default function IncidentCenter({ activeChuteId }: Props) {
  const { token } = useAuthStore();
  const access = useRoleAccess();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSev, setFilterSev] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create form
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', severity: 'Medium', incidentType: 'Other', affectedZone: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Close modal
  const [closing, setClosing] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState({ rootCause: '', correctionAction: '', note: '' });
  const [closeError, setCloseError] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeChuteId) params.set('chuteId', activeChuteId);
      if (filterSev) params.set('severity', filterSev);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`${API}/incidents?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load incidents.');
    } finally {
      setLoading(false);
    }
  }, [token, activeChuteId, filterSev, filterStatus]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required.');
      return;
    }
    if (!activeChuteId) {
      setFormError('No active chute selected.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch(`${API}/incidents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          chuteId: activeChuteId,
          affectedZone: form.affectedZone ? Number(form.affectedZone) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setCreating(false);
      setForm({ title: '', description: '', severity: 'Medium', incidentType: 'Other', affectedZone: '', notes: '' });
      fetchIncidents();
    } catch {
      setFormError('Failed to create incident. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async (id: string) => {
    await fetch(`${API}/incidents/${id}/escalate`, { method: 'POST', headers });
    fetchIncidents();
  };

  const handleClose = async () => {
    if (!closeForm.rootCause.trim() || !closeForm.correctionAction.trim()) {
      setCloseError('Root cause and corrective action are required to close.');
      return;
    }
    try {
      const res = await fetch(`${API}/incidents/${closing}/close`, {
        method: 'POST', headers,
        body: JSON.stringify(closeForm),
      });
      if (!res.ok) throw new Error('Failed');
      setClosing(null);
      setCloseForm({ rootCause: '', correctionAction: '', note: '' });
      fetchIncidents();
    } catch {
      setCloseError('Failed to close incident.');
    }
  };

  const selected = incidents.find(i => i._id === selectedId) ?? null;

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflowY: 'auto', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 22, margin: 0 }}>
            🚨 Incident Center
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Report, track, and resolve operational incidents
          </p>
        </div>
        {access.canManageIncidents && (
          <button
            onClick={() => setCreating(true)}
            style={{
              background: 'linear-gradient(135deg, #F43F5E, #FB923C)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
            }}
          >
            + Report Incident
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {['', 'Critical', 'High', 'Medium', 'Low'].map(s => (
          <button
            key={s}
            onClick={() => setFilterSev(s)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filterSev === s ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
              background: filterSev === s ? 'var(--accent-primary-alpha)' : 'transparent',
              color: s ? SEV_COLORS[s] || 'var(--text-secondary)' : 'var(--text-secondary)',
            }}
          >{s || 'All Severity'}</button>
        ))}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="Investigating">Investigating</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {error && (
        <div style={{ background: '#F43F5E22', border: '1px solid #F43F5E55', color: '#F43F5E', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: 20 }}>
        {/* Incident List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 100, borderRadius: 12, background: 'var(--card-bg)', animation: 'pulse 1.5s infinite', opacity: 0.6 }} />
            ))
          ) : incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>No incidents found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>All clear — no active incidents match your filters</div>
            </div>
          ) : incidents.map(inc => (
            <div
              key={inc._id}
              onClick={() => setSelectedId(selectedId === inc._id ? null : inc._id)}
              style={{
                background: 'var(--card-bg)', border: `1px solid ${selectedId === inc._id ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                borderLeft: `4px solid ${SEV_COLORS[inc.severity] || '#666'}`,
                transition: 'border-color 0.2s, transform 0.15s',
                transform: selectedId === inc._id ? 'scale(1.01)' : 'scale(1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
                    {inc.description.slice(0, 100)}{inc.description.length > 100 ? '…' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {badge(inc.severity, SEV_COLORS[inc.severity] || '#888')}
                    {badge(inc.status, STATUS_COLORS[inc.status] || '#888')}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.incidentType}</span>
                    {inc.affectedZone && (
                      <span style={{ fontSize: 11, color: 'var(--accent-primary)' }}>Zone {inc.affectedZone}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <div>{new Date(inc.createdAt).toLocaleDateString()}</div>
                  <div style={{ marginTop: 4 }}>{inc.reportedBy?.name || 'Unknown'}</div>
                </div>
              </div>

              {/* Action buttons */}
              {selectedId !== inc._id && inc.status !== 'Resolved' && access.canManageIncidents && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {inc.status !== 'Escalated' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleEscalate(inc._id); }}
                      style={{
                        background: '#FB923C22', color: '#FB923C', border: '1px solid #FB923C55',
                        borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >↑ Escalate</button>
                  )}
                  {access.canCloseIncident && (
                    <button
                      onClick={e => { e.stopPropagation(); setClosing(inc._id); }}
                      style={{
                        background: '#34D39922', color: '#34D399', border: '1px solid #34D39955',
                        borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >✓ Close</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '20px', position: 'sticky', top: 0, maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>
                {selected.title}
              </h3>
              <button onClick={() => setSelectedId(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer',
              }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {badge(selected.severity, SEV_COLORS[selected.severity])}
              {badge(selected.status, STATUS_COLORS[selected.status])}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              {selected.description}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                ['Type', selected.incidentType],
                ['Zone', selected.affectedZone ? `Zone ${selected.affectedZone}` : 'N/A'],
                ['Reported By', selected.reportedBy?.name || 'Unknown'],
                ['Assigned To', selected.assignedTo?.name || 'Unassigned'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>

            {selected.rootCause && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Root Cause</div>
                <div style={{ background: '#F43F5E11', border: '1px solid #F43F5E33', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {selected.rootCause}
                </div>
              </div>
            )}

            {selected.correctionAction && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Corrective Action</div>
                <div style={{ background: '#34D39911', border: '1px solid #34D39933', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {selected.correctionAction}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selected.timeline.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)',
                      marginTop: 4, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{e.note}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(e.timestamp).toLocaleString()} {e.performedBy ? `· ${e.performedBy.name}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {selected.status !== 'Resolved' && access.canManageIncidents && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {selected.status !== 'Escalated' && (
                  <button
                    onClick={() => handleEscalate(selected._id)}
                    style={{
                      flex: 1, background: '#FB923C22', color: '#FB923C', border: '1px solid #FB923C55',
                      borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >↑ Escalate</button>
                )}
                {access.canCloseIncident && (
                  <button
                    onClick={() => setClosing(selected._id)}
                    style={{
                      flex: 1, background: '#34D39922', color: '#34D399', border: '1px solid #34D39955',
                      borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >✓ Close Incident</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {creating && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 20 }}>
              🚨 Report New Incident
            </h3>

            {formError && (
              <div style={{ background: '#F43F5E22', border: '1px solid #F43F5E55', color: '#F43F5E', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                {formError}
              </div>
            )}

            {[
              { label: 'Incident Title', key: 'title', type: 'input', placeholder: 'e.g. Compressor pressure drop on Zone 2' },
              { label: 'Description', key: 'description', type: 'textarea', placeholder: 'Describe what happened in detail…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{f.label} *</label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    rows={3}
                    style={{
                      width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px', fontSize: 13,
                      resize: 'vertical', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px', fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Severity *</label>
                <select
                  value={form.severity}
                  onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                  style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Incident Type *</label>
                <select
                  value={form.incidentType}
                  onChange={e => setForm(p => ({ ...p, incidentType: e.target.value }))}
                  style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
                >
                  <option value="Radar">Radar</option>
                  <option value="Compressor">Compressor</option>
                  <option value="Solenoid">Solenoid</option>
                  <option value="Structural">Structural</option>
                  <option value="Process">Process</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Affected Zone (optional)</label>
              <select
                value={form.affectedZone}
                onChange={e => setForm(p => ({ ...p, affectedZone: e.target.value }))}
                style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
              >
                <option value="">None</option>
                <option value="1">Zone 1</option>
                <option value="2">Zone 2</option>
                <option value="3">Zone 3</option>
                <option value="4">Zone 4</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setCreating(false); setFormError(''); }}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                style={{
                  flex: 2, background: 'linear-gradient(135deg, #F43F5E, #FB923C)',
                  border: 'none', color: '#fff', borderRadius: 10, padding: '12px', fontSize: 14,
                  fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}
              >{submitting ? 'Reporting…' : '🚨 Report Incident'}</button>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE MODAL */}
      {closing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 28, width: '100%', maxWidth: 480,
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginBottom: 20 }}>
              ✓ Close Incident
            </h3>
            {closeError && (
              <div style={{ background: '#F43F5E22', border: '1px solid #F43F5E55', color: '#F43F5E', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                {closeError}
              </div>
            )}
            {[
              { label: 'Root Cause *', key: 'rootCause', placeholder: 'What caused this incident?' },
              { label: 'Corrective Action *', key: 'correctionAction', placeholder: 'What was done to resolve it?' },
              { label: 'Closure Note (optional)', key: 'note', placeholder: 'Additional notes…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <textarea
                  value={(closeForm as any)[f.key]}
                  onChange={e => setCloseForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={2}
                  style={{
                    width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px', fontSize: 13,
                    resize: 'vertical', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setClosing(null); setCloseError(''); }}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleClose}
                style={{
                  flex: 2, background: 'linear-gradient(135deg, #34D399, #059669)',
                  border: 'none', color: '#fff', borderRadius: 10, padding: '12px', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >✓ Close Incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
