import React, { useState, useEffect, useRef } from 'react';
import { Modal, Box, Alert, CircularProgress, Button, TextField } from '@mui/material';
import { getThemeColors } from '../../constants';

interface QrOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  activeChuteId: string | null;
  activeChuteName?: string;
  token: string | null;
  theme: 'dark' | 'light';
}

export const QrOnboardingModal: React.FC<QrOnboardingModalProps> = ({
  open,
  onClose,
  activeChuteId,
  activeChuteName,
  token,
  theme,
}) => {
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDeviceId, setQrDeviceId] = useState('');
  const [qrClaimResult, setQrClaimResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [qrClaimLoading, setQrClaimLoading] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const GREEN = colors.GREEN;
  const AMBER = colors.AMBER;

  // Fetch QR Token when modal opens
  useEffect(() => {
    if (!open || !activeChuteId) return;

    const loadQrToken = async () => {
      setQrLoading(true);
      setQrClaimResult(null);
      setQrData(null);
      try {
        const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/qr-token`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load QR');
        setQrData(data);
      } catch (err: any) {
        setQrData(null);
        setQrClaimResult({ ok: false, msg: err.message || 'Failed to load QR token' });
      } finally {
        setQrLoading(false);
      }
    };

    loadQrToken();
  }, [open, activeChuteId, token]);

  // Generate QR code canvas when qrData changes
  useEffect(() => {
    if (open && qrData && qrCanvasRef.current) {
      import('qrcode').then((QRCode) => {
        const payloadString = JSON.stringify(qrData.qrPayload || qrData);
        QRCode.toCanvas(qrCanvasRef.current!, payloadString, {
          width: 220,
          margin: 2,
          color: {
            dark: '#1e293b', // dark QR blocks
            light: '#ffffff' // white background
          }
        }, (error) => {
          if (error) console.error('Failed to generate QR canvas:', error);
        });
      }).catch(err => {
        console.error('Failed to load qrcode library:', err);
      });
    }
  }, [open, qrData]);

  const handleClaimDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChuteId || !qrDeviceId.trim()) return;
    setQrClaimLoading(true);
    setQrClaimResult(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/claim-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deviceId: qrDeviceId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Claim failed');
      setQrClaimResult({ ok: true, msg: data.message });
      setQrData((prev: any) => prev ? { ...prev, linkedDeviceId: qrDeviceId.trim(), deviceLinkedAt: new Date().toISOString() } : prev);
      setQrDeviceId('');
    } catch (err: any) {
      setQrClaimResult({ ok: false, msg: err.message || 'Failed to claim device' });
    } finally {
      setQrClaimLoading(false);
    }
  };

  const handleClose = () => {
    setQrData(null);
    setQrDeviceId('');
    setQrClaimResult(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
        p: 4, width: 440, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>⚙️ Chute Hardware Onboarding</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Link a physical edge gateway hub to <strong>{activeChuteName || 'this chute'}</strong>
        </div>

        {qrLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
            <CircularProgress size={40} style={{ color: BLUE, marginBottom: '12px' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generating secure onboarding token...</div>
          </div>
        )}

        {qrClaimResult && (
          <Alert severity={qrClaimResult.ok ? 'success' : 'error'} style={{ marginBottom: '16px', fontSize: '12px' }}>
            {qrClaimResult.msg}
          </Alert>
        )}

        {!qrLoading && qrData && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <canvas ref={qrCanvasRef} style={{ display: 'block', margin: '0 auto 16px', background: '#ffffff', padding: '8px', borderRadius: '8px' }} />

            <div style={{ width: '100%', fontSize: '11.5px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Chute Code:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{qrData.chuteCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Plant Code:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{qrData.plantCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
                <span style={{ color: qrData.linkedDeviceId ? GREEN : AMBER, fontWeight: 800 }}>
                  {qrData.linkedDeviceId ? `Linked to ${qrData.linkedDeviceId}` : 'Awaiting Hub Scan'}
                </span>
              </div>
            </div>

            <form onSubmit={handleClaimDevice} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Manual Device ID Association</div>
                <TextField
                  fullWidth
                  size="small"
                  value={qrDeviceId}
                  onChange={(e) => setQrDeviceId(e.target.value)}
                  placeholder="e.g. HUB-MAC-01:23:45"
                  required
                  slotProps={{ input: { style: { color: 'var(--text-primary)', fontSize: '13px' } } }}
                />
              </div>
              <Button
                type="submit"
                disabled={qrClaimLoading}
                variant="contained"
                style={{ background: BLUE, color: 'white', fontWeight: 700, textTransform: 'none' }}
              >
                {qrClaimLoading ? 'Linking...' : 'Link Device ID'}
              </Button>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            size="small"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 700 }}
          >
            Close
          </Button>
        </div>
      </Box>
    </Modal>
  );
};
