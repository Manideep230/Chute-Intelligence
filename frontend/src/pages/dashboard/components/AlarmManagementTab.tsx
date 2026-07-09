import React, { useState, useEffect, useCallback } from 'react';
import { CircularProgress, Alert } from '@mui/material';
import { Bell, Check, Eye, AlertTriangle } from 'lucide-react';

interface AlarmManagementTabProps {
  activeChuteId: string;
  token: string;
}

export const AlarmManagementTab: React.FC<AlarmManagementTabProps> = React.memo(({ activeChuteId, token }) => {
  const [alarms, setAlarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const fetchAlarms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/_/backend/industry/alerts?chuteId=${activeChuteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve alarms feed');
      const data = await res.json();
      setAlarms(data);
    } catch (err: any) {
      setError(err.message || 'Error loading alarms feed.');
    } finally {
      setLoading(false);
    }
  }, [activeChuteId, token]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  const handleAcknowledge = async (id: string) => {
    try {
      const res = await fetch(`/_/backend/industry/alerts/${id}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlarms();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSilence = async (id: string) => {
    try {
      const res = await fetch(`/_/backend/industry/alerts/${id}/silence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlarms();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch(`/_/backend/industry/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlarms();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      const res = await fetch(`/_/backend/industry/alerts/${id}/escalate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlarms();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAlarms = alarms.filter(a => {
    if (filterSeverity === 'all') return true;
    return a.severity.toLowerCase() === filterSeverity.toLowerCase();
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🚨 Alarm Management & Dispatch</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Prioritize alarms, view acknowledgements, silence warnings, and manage escalation chains.</p>
        </div>
        <button onClick={fetchAlarms} style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          Refresh Feeds
        </button>
      </div>

      {/* FILTER SEVERITY */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {['all', 'info', 'warning', 'critical', 'emergency'].map(sev => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: filterSeverity === sev ? 'var(--border-light)' : 'transparent',
              color: filterSeverity === sev ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: filterSeverity === sev ? 'bold' : 'normal',
              textTransform: 'capitalize',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {sev}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <CircularProgress style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : filteredAlarms.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          No active alarms matching selected priority
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredAlarms.map((alarm) => {
            const sevColor = alarm.severity.toUpperCase() === 'EMERGENCY' ? 'var(--accent-red)'
              : alarm.severity.toUpperCase() === 'CRITICAL' ? 'var(--accent-red)'
              : alarm.severity.toUpperCase() === 'WARNING' ? 'var(--accent-amber)'
              : 'var(--accent-blue)';

            return (
              <div key={alarm._id} style={{
                padding: '16px',
                background: 'var(--card-bg)',
                border: `1px solid var(--border)`,
                borderLeft: `5px solid ${sevColor}`,
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: alarm.isResolved ? 0.6 : 1
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Bell size={20} style={{ color: sevColor }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: sevColor, fontSize: '11px', textTransform: 'uppercase' }}>
                        [{alarm.severity}]
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Source: {alarm.source}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontWeight: 600, fontSize: '13px' }}>{alarm.message}</p>
                    
                    {/* ACK / SILENCED STATUS */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {alarm.acknowledgedAt ? (
                        <span style={{ color: 'var(--accent-green)' }}>✓ Acknowledged</span>
                      ) : (
                        <span>Not Acknowledged</span>
                      )}
                      {alarm.isSilenced && (
                        <span style={{ color: 'var(--accent-blue)' }}>🔇 Silenced</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* CONTROLS */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!alarm.acknowledgedAt && !alarm.isResolved && (
                    <button onClick={() => handleAcknowledge(alarm._id)} title="Acknowledge" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                      <Check size={12} /> <span style={{ marginLeft: '4px', fontSize: '10px' }}>Ack</span>
                    </button>
                  )}
                  {!alarm.isSilenced && !alarm.isResolved && (
                    <button onClick={() => handleSilence(alarm._id)} title="Silence" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                      <Eye size={12} /> <span style={{ marginLeft: '4px', fontSize: '10px' }}>Silence</span>
                    </button>
                  )}
                  {!alarm.isResolved && (
                    <button onClick={() => handleEscalate(alarm._id)} title="Escalate" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--accent-amber)' }}>
                      <AlertTriangle size={12} /> <span style={{ marginLeft: '4px', fontSize: '10px' }}>Escalate</span>
                    </button>
                  )}
                  {!alarm.isResolved ? (
                    <button onClick={() => handleResolve(alarm._id)} style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                      Resolve
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Resolved</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
