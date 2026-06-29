import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { TextField, Button, CircularProgress, Alert } from '@mui/material';

export const Login: React.FC = () => {
  const { setAuth } = useAuthStore();
  const [phone, setPhone] = useState('+919999999999');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [receivedOtp, setReceivedOtp] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('http://localhost:5000/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to request OTP');
      
      const backdoorMsg = data.otp
        ? `OTP code generated! Use ${data.otp} (or 778899 as testing backdoor)`
        : `OTP code generated! (Use 778899 as testing backdoor)`;
      setInfo(backdoorMsg);
      setReceivedOtp(data.otp || '778899');
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:5000/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');

      setAuth(data.user, data.accessToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="login-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
        padding: '20px'
      }}
    >
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        .demo-otp-badge {
          position: fixed;
          top: 20px;
          left: 20px;
          background: rgba(255, 107, 53, 0.15);
          border: 1px solid rgba(255, 107, 53, 0.4);
          border-radius: 6px;
          padding: 8px 14px;
          color: #ff6b35;
          cursor: pointer;
          z-index: 100;
          backdrop-filter: blur(8px);
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          letter-spacing: 1px;
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.1);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s, transform 0.2s;
        }
        .demo-otp-badge:hover {
          background: rgba(255, 107, 53, 0.25);
          transform: scale(1.03);
        }
        @media (max-width: 800px) {
          .demo-otp-badge {
            position: relative;
            top: auto;
            left: auto;
            margin-bottom: 20px;
            width: 100%;
            justify-content: center;
            box-sizing: border-box;
          }
          .login-container {
            flex-direction: column;
            justify-content: flex-start !important;
            padding-top: 40px !important;
          }
        }
      `}</style>

      {step === 2 && receivedOtp && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setOtp(receivedOtp)}
          className="demo-otp-badge"
        >
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff6b35', animation: 'pulse 1.5s infinite' }}></span>
          DEMO OTP: <strong style={{ letterSpacing: '2px', marginLeft: '4px' }}>{receivedOtp}</strong> (Click to auto-fill)
        </motion.div>
      )}

      {/* Background industrial gird */}
      <div 
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage: 'radial-gradient(rgba(255, 107, 53, 0.08) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          opacity: 0.5,
          zIndex: 1
        }}
      ></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px 30px',
          zIndex: 5
        }}
        className="glass-panel"
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '2px', color: '#ff6b35', margin: 0 }}>
            NIGHA RADAR
          </h1>
          <p style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1.5px', marginTop: '6px', textTransform: 'uppercase' }}>
            Enterprise Industrial AI Platform
          </p>
        </div>

        {error && <Alert severity="error" style={{ marginBottom: '20px', fontSize: '12px' }}>{error}</Alert>}
        {info && <Alert severity="info" style={{ marginBottom: '20px', fontSize: '12px' }}>{info}</Alert>}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleRequestOtp}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              <div>
                <label style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                  Mobile Phone Number
                </label>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919999999999"
                  required
                  slotProps={{
                    input: {
                      style: { color: 'white', background: 'rgba(0,0,0,0.2)', fontFamily: 'Share Tech Mono' }
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover fieldset': { borderColor: '#ff6b35' },
                      '&.Mui-focused fieldset': { borderColor: '#ff6b35' },
                    }
                  }}
                />
              </div>

              <Button
                type="submit"
                fullWidth
                disabled={loading}
                style={{
                  background: '#ff6b35',
                  color: 'white',
                  fontWeight: 600,
                  padding: '12px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 107, 53, 0.3)';
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Get Verification Code'}
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerifyOtp}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              <div>
                <label style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                  6-Digit OTP Code
                </label>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="778899"
                  required
                  slotProps={{
                    input: {
                      style: { color: 'white', background: 'rgba(0,0,0,0.2)', fontFamily: 'Share Tech Mono', letterSpacing: '8px', textAlign: 'center' }
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover fieldset': { borderColor: '#ff6b35' },
                      '&.Mui-focused fieldset': { borderColor: '#ff6b35' },
                    }
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setStep(1)}
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#9ca3af',
                    fontWeight: 600,
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={loading}
                  style={{
                    background: '#ff6b35',
                    color: 'white',
                    fontWeight: 600,
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Login'}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
          By logging in, you agree to Nigha Chute security terms.
        </div>
      </motion.div>
    </div>
  );
};
export default Login;
