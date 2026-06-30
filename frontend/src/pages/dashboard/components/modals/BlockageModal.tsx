import React, { useState } from 'react';
import { Modal, Box, Button } from '@mui/material';
import { getThemeColors } from '../../constants';

interface BlockageModalProps {
  open: boolean;
  onClose: () => void;
  onInject: (zone: number, distance: number) => void;
  theme: 'dark' | 'light';
}

export const BlockageModal: React.FC<BlockageModalProps> = ({
  open,
  onClose,
  onInject,
  theme,
}) => {
  const [injZone, setInjZone] = useState<number>(1);
  const [injDistance, setInjDistance] = useState<number>(0.55);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const AMBER = colors.AMBER;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInject(injZone, injDistance);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
        p: 4, width: 420, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Inject Simulated Blockage</div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
          <span style={{ color: BLUE, fontWeight: 700 }}>Note:</span> Distance controls which solenoid valve is designated as the target.
          <br />• Distance <span style={{ color: AMBER }}>&lt; 0.65m</span> targets the <span style={{ fontWeight: 700 }}>upper valve</span> (odd numbers: SV1, SV3, SV5, SV7).
          <br />• Distance <span style={{ color: AMBER }}>&ge; 0.65m</span> targets the <span style={{ fontWeight: 700 }}>lower valve</span> (even numbers: SV2, SV4, SV6, SV8).
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Target Zone</div>
            <select
              value={injZone}
              onChange={(e) => setInjZone(Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--input-bg, rgba(255,255,255,0.05))',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '10px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            >
              <option value={1} style={{ background: 'var(--card-bg)' }}>Zone 1 (SV1 / SV2)</option>
              <option value={2} style={{ background: 'var(--card-bg)' }}>Zone 2 (SV3 / SV4)</option>
              <option value={3} style={{ background: 'var(--card-bg)' }}>Zone 3 (SV5 / SV6)</option>
              <option value={4} style={{ background: 'var(--card-bg)' }}>Zone 4 (SV7 / SV8)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
              <span>Radar Distance (m)</span>
              <span style={{ color: BLUE, fontFamily: 'var(--font-mono)' }}>{injDistance.toFixed(2)}m</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="3.00"
              step="0.05"
              value={injDistance}
              onChange={(e) => setInjDistance(Number(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: BLUE
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>0.10m (Critical)</span>
              <span>0.65m (Threshold)</span>
              <span>3.00m (Clear)</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <Button
              onClick={onClose}
              variant="outlined"
              fullWidth
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
                fontWeight: 700
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              style={{
                background: BLUE,
                color: 'white',
                fontWeight: 700
              }}
            >
              Inject Blockage
            </Button>
          </div>
        </form>
      </Box>
    </Modal>
  );
};
