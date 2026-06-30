import React, { useState } from 'react';
import { Modal, Box, Alert, CircularProgress, Button, TextField } from '@mui/material';
import { getThemeColors } from '../../constants';

interface DbResetDialogProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
  theme: 'dark' | 'light';
}

export const DbResetDialog: React.FC<DbResetDialogProps> = ({
  open,
  onClose,
  token,
  theme,
}) => {
  const [dbResetPhrase, setDbResetPhrase] = useState('');
  const [dbResetLoading, setDbResetLoading] = useState(false);
  const [dbResetResult, setDbResetResult] = useState<{ ok: boolean; msg: string; details?: any } | null>(null);

  const colors = getThemeColors(theme);
  const RED = colors.RED;

  const handleDbReset = async () => {
    if (dbResetPhrase !== 'RESET') return;
    setDbResetLoading(true);
    setDbResetResult(null);
    try {
      const res = await fetch('/_/backend/admin/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ confirm: true, confirmPhrase: 'RESET' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      setDbResetResult({ ok: true, msg: data.message, details: data });
      setDbResetPhrase('');
    } catch (err: any) {
      setDbResetResult({ ok: false, msg: err.message || 'Reset failed' });
    } finally {
      setDbResetLoading(false);
    }
  };

  const handleClose = () => {
    setDbResetPhrase('');
    setDbResetResult(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--card-bg)', border: `1px solid ${RED}30`, borderRadius: '12px',
        p: 4, width: 440, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: RED, marginBottom: '8px' }}>🚨 Wipe Operational Database</div>

        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5', padding: '10px', background: `${RED}10`, border: `1px solid ${RED}20`, borderRadius: '6px' }}>
          <strong>WARNING:</strong> This will delete all historical telemetry, GPS history, alerts, AI predictions, notifications, and maintenance records.
          <br /><br />
          Structural data (plants, chutes, organizations, users) will be preserved, and fresh hardware baselines will be generated. This action cannot be undone.
        </div>

        {dbResetResult && (
          <Alert severity={dbResetResult.ok ? 'success' : 'error'} style={{ marginBottom: '14px', fontSize: '12px' }}>
            {dbResetResult.msg}
          </Alert>
        )}

        {dbResetLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
            <CircularProgress size={36} style={{ color: RED, marginBottom: '10px' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Executing database wipe &amp; re-seeding...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
                Type <span style={{ color: RED, fontWeight: 800 }}>RESET</span> to confirm:
              </div>
              <TextField
                fullWidth
                size="small"
                value={dbResetPhrase}
                onChange={(e) => setDbResetPhrase(e.target.value)}
                placeholder="RESET"
                required
                slotProps={{ input: { style: { color: 'var(--text-primary)', fontWeight: 700 } } }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <Button
                onClick={handleClose}
                variant="outlined"
                fullWidth
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 700 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDbReset}
                disabled={dbResetPhrase !== 'RESET' || dbResetLoading}
                variant="contained"
                fullWidth
                style={{
                  background: dbResetPhrase === 'RESET' ? `linear-gradient(135deg, ${RED} 0%, #b91c1c 100%)` : 'var(--border)',
                  color: 'white',
                  fontWeight: 700
                }}
              >
                Wipe Database
              </Button>
            </div>
          </div>
        )}
      </Box>
    </Modal>
  );
};
