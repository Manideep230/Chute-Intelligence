import React, { useState } from 'react';
import { Modal, Box, Alert, Button, TextField } from '@mui/material';
import { getThemeColors } from '../../constants';

interface PhoneChangeModalProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
  updateUser: (fields: any) => void;
  theme: 'dark' | 'light';
}

export const PhoneChangeModal: React.FC<PhoneChangeModalProps> = ({
  open,
  onClose,
  token,
  updateUser,
  theme,
}) => {
  const [newPhone, setNewPhone] = useState('');
  const [oldPhoneOtp, setOldPhoneOtp] = useState('');
  const [newPhoneOtp, setNewPhoneOtp] = useState('');
  const [phoneChangeStep, setPhoneChangeStep] = useState<1 | 2>(1);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneInfo, setPhoneInfo] = useState<string | null>(null);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;

  const handleRequestPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setPhoneInfo(null);
    try {
      const res = await fetch('/_/backend/auth/request-phone-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPhoneInfo('Verification codes sent to old and new numbers. Check terminal log!');
      setPhoneChangeStep(2);
    } catch (err: any) {
      setPhoneError(err.message);
    }
  };

  const handleVerifyPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    try {
      const res = await fetch('/_/backend/auth/verify-phone-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldPhoneOtp, newPhoneOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser({ phone: data.phone });
      setPhoneInfo('Phone number changed successfully!');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setPhoneError(err.message);
    }
  };

  const handleClose = () => {
    setNewPhone('');
    setOldPhoneOtp('');
    setNewPhoneOtp('');
    setPhoneChangeStep(1);
    setPhoneError(null);
    setPhoneInfo(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
        p: 4, width: 420, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Modify Phone Signature</div>
        {phoneError && <Alert severity="error" style={{ marginBottom: '12px', fontSize: '12px' }}>{phoneError}</Alert>}
        {phoneInfo && <Alert severity="info" style={{ marginBottom: '12px', fontSize: '12px' }}>{phoneInfo}</Alert>}
        {phoneChangeStep === 1 ? (
          <form onSubmit={handleRequestPhoneChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>New Phone Signature</div>
              <TextField fullWidth value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+919999999999" required slotProps={{ input: { style: { color: 'var(--text-primary)' } } }} />
            </div>
            <Button type="submit" variant="contained" style={{ background: BLUE, color: 'white', fontWeight: 700 }}>Dispatch Verification Codes</Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyPhoneChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>OTP (Current signature log)</div>
              <TextField fullWidth value={oldPhoneOtp} onChange={(e) => setOldPhoneOtp(e.target.value)} placeholder="123456" required slotProps={{ input: { style: { color: 'var(--text-primary)' } } }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>OTP (New signature log)</div>
              <TextField fullWidth value={newPhoneOtp} onChange={(e) => setNewPhoneOtp(e.target.value)} placeholder="123456" required slotProps={{ input: { style: { color: 'var(--text-primary)' } } }} />
            </div>
            <Button type="submit" variant="contained" style={{ background: BLUE, color: 'white', fontWeight: 700 }}>Authenticate and Commit</Button>
          </form>
        )}
      </Box>
    </Modal>
  );
};
