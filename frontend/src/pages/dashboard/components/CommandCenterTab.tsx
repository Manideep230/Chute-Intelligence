import React, { useState, useEffect, useCallback } from 'react';
import { CircularProgress, Alert, Paper } from '@mui/material';
import { Play, RotateCcw, XCircle, Settings } from 'lucide-react';

interface CommandCenterTabProps {
  activeChuteId: string;
  token: string;
}

export const CommandCenterTab: React.FC<CommandCenterTabProps> = React.memo(({ activeChuteId, token }) => {
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form for Manual Execute
  const [customAction, setCustomAction] = useState('blast');
  const [customPayload, setCustomPayload] = useState('{\n  "sabNumber": 1,\n  "solenoidNumbers": [1, 2],\n  "blastDurationMs": 4000\n}');
  const [executing, setExecuting] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const fetchCommands = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/_/backend/hardware/commands/${activeChuteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch command log');
      const data = await res.json();
      setCommands(data);
    } catch (err: any) {
      setError(err.message || 'Error loading commands.');
    } finally {
      setLoading(false);
    }
  }, [activeChuteId, token]);

  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  const handleReplay = async (cmdId: string) => {
    try {
      const res = await fetch(`/_/backend/hardware/commands/${cmdId}/replay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Command re-dispatched successfully.');
        fetchCommands();
      } else {
        const d = await res.json();
        alert(`Failed to replay command: ${d.message}`);
      }
    } catch (err: any) {
      alert(`Replay failed: ${err.message}`);
    }
  };

  const handleRetry = async (cmdId: string) => {
    try {
      const res = await fetch(`/_/backend/hardware/retry-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ commandId: cmdId })
      });
      if (res.ok) {
        alert('Retry request sent.');
        fetchCommands();
      } else {
        const d = await res.json();
        alert(`Failed to retry: ${d.message}`);
      }
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  const handleCancel = async (cmdId: string) => {
    try {
      const res = await fetch(`/_/backend/hardware/commands/${cmdId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Command cancelled successfully.');
        fetchCommands();
      } else {
        const d = await res.json();
        alert(`Failed to cancel: ${d.message}`);
      }
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    }
  };

  const handleManualExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecuting(true);
    setFormMsg('');
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(customPayload);
      } catch (err) {
        throw new Error('Invalid JSON payload');
      }

      const res = await fetch(`/_/backend/hardware/commands/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          chuteId: activeChuteId,
          action: customAction,
          payload: parsedPayload
        })
      });

      if (res.ok) {
        setFormMsg('Manual command executed successfully.');
        fetchCommands();
      } else {
        const d = await res.json();
        throw new Error(d.message || 'Execution error');
      }
    } catch (err: any) {
      setFormMsg(`Error: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>⚡ Advanced Command Center</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Monitor queues, inspect execution latencies, replay commands, and execute manual overrides.</p>
        </div>
        <button onClick={fetchCommands} style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          Refresh Queue
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        {/* COMMAND HISTORY & CONTROLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh' }}>
              <CircularProgress style={{ color: 'var(--accent-primary)' }} />
            </div>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : commands.length === 0 ? (
            <Paper style={{ padding: '32px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No commands recorded in this chute queue
            </Paper>
          ) : (
            commands.map((cmd) => (
              <div key={cmd._id} style={{ padding: '16px', background: 'var(--card-bg)', border: `1px solid ${cmd.status === 'FAILED' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      background: 'rgba(255, 107, 53, 0.1)',
                      color: 'var(--accent-primary)'
                    }}>
                      {cmd.action}
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      ID: {cmd.commandId}
                    </span>
                  </div>

                  <span style={{
                    fontWeight: 700,
                    fontSize: '11px',
                    color: cmd.status === 'COMPLETED' ? 'var(--accent-green)' : cmd.status === 'FAILED' ? 'var(--accent-red)' : 'var(--accent-amber)'
                  }}>
                    {cmd.status}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  <div>Source: <strong style={{ color: 'var(--text-primary)' }}>{cmd.triggerSource}</strong></div>
                  <div>Retry Count: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{cmd.retryCount}/{cmd.maxRetries}</strong></div>
                  <div>Latency: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{cmd.executionTimeMs ?? 'N/A'} ms</strong></div>
                  {cmd.verificationScore !== null && (
                    <div>Verify Score: <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{cmd.verificationScore}/100</strong></div>
                  )}
                  {cmd.publishedAt && (
                    <div>Dispatched: <strong style={{ color: 'var(--text-primary)' }}>{new Date(cmd.publishedAt).toLocaleTimeString()}</strong></div>
                  )}
                </div>

                {/* PAYLOAD VIEW */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Command Payload:</span>
                  <pre style={{ margin: 0, fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflowX: 'auto' }}>
                    {JSON.stringify(cmd.payload, null, 2)}
                  </pre>
                </div>

                {/* DYNAMIC ACTION BUTTONS */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                  <button onClick={() => handleReplay(cmd.commandId)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                    <Play size={10} /> Replay
                  </button>
                  {cmd.status === 'FAILED' && (
                    <button onClick={() => handleRetry(cmd.commandId)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                      <RotateCcw size={10} /> Retry
                    </button>
                  )}
                  {['CREATED', 'QUEUED', 'PUBLISHED', 'RECEIVED', 'EXECUTING'].includes(cmd.status) && (
                    <button onClick={() => handleCancel(cmd.commandId)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                      <XCircle size={10} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* MANUAL COMMAND INJECT FORM */}
        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={16} /> Execute Custom Command
          </span>

          <form onSubmit={handleManualExecute} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Select Action Type</label>
              <select value={customAction} onChange={(e) => setCustomAction(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }}>
                <option value="blast">blast</option>
                <option value="calibrate">calibrate</option>
                <option value="diagnostics">diagnostics</option>
                <option value="firmware_update">firmware_update</option>
                <option value="restart">restart</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Payload parameters (JSON format)</label>
              <textarea value={customPayload} onChange={(e) => setCustomPayload(e.target.value)} rows={6} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'var(--font-mono)' }} />
            </div>

            <button type="submit" disabled={executing} style={{ padding: '8px 12px', background: 'var(--accent-primary)', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px' }}>
              {executing ? <CircularProgress size={16} color="inherit" /> : 'Dispatch Command'}
            </button>
          </form>

          {formMsg && (
            <div style={{ fontSize: '11px', color: formMsg.includes('Error') ? 'var(--accent-red)' : 'var(--accent-green)', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
              {formMsg}
            </div>
          )}
        </div>

      </div>
    </div>
  );
});
