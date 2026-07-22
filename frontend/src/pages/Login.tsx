import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { TextField, Button, CircularProgress, Alert } from '@mui/material';

export const Login: React.FC = () => {
  const { setAuth } = useAuthStore();
  const [phone, setPhone] = useState('9391888104');
  const [otpVal, setOtpVal] = useState<string[]>(Array(6).fill(''));
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resending OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    // Basic length/character verification
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setError('Please enter a valid mobile number.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/_/backend/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to request OTP');
      
      setInfo('OTP sent successfully.');
      setStep(2);
      setCountdown(60);
      setOtpVal(Array(6).fill(''));
      
      // Auto focus first OTP input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
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

    const fullOtp = otpVal.join('');
    if (fullOtp.length < 6) {
      setError('Please enter a 6-digit OTP code.');
      setLoading(false);
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    try {
      const res = await fetch('/_/backend/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: fullOtp }),
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

  // Segmented input handlers
  const handleOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpVal];
    newOtp[index] = cleanVal;
    setOtpVal(newOtp);

    // Auto next
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpVal[index] && index > 0) {
        const newOtp = [...otpVal];
        newOtp[index - 1] = '';
        setOtpVal(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else if (otpVal[index]) {
        const newOtp = [...otpVal];
        newOtp[index] = '';
        setOtpVal(newOtp);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 6) {
      const newOtp = pasteData.split('');
      setOtpVal(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  return (
    <div 
      className="login-container"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#040814',
        color: '#E2E8F0',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <style>{`
        
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(140px);
          z-index: 1;
          opacity: 0.4;
          pointer-events: none;
        }
        .orb-left {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #f97316 0%, transparent 70%);
          left: -150px;
          top: -100px;
        }
        .orb-right {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, #0284c7 0%, transparent 70%);
          right: -100px;
          bottom: -150px;
        }
        .glass-card {
          background: rgba(10, 15, 30, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          border-radius: 16px;
        }
        .glow-input:focus {
          border-color: #f97316 !important;
          box-shadow: 0 0 10px rgba(249, 115, 22, 0.2) !important;
        }
        .segmented-input {
          width: 48px;
          height: 54px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
          outline: none;
          font-family: var(--font-mono);
          transition: all 0.2s ease;
        }
        .segmented-input:focus {
          border-color: #f97316;
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.3);
          background: rgba(0, 0, 0, 0.6);
        }
        .ripple-btn {
          position: relative;
          overflow: hidden;
          transition: all 0.2s ease-in-out;
        }
        .ripple-btn:active {
          transform: scale(0.98);
        }
        @media (max-width: 900px) {
          .splitscreen-hero {
            display: none !important;
          }
          .splitscreen-form {
            width: 100% !important;
            padding: 24px !important;
          }
        }
      `}</style>

      {/* Decorative Orbs */}
      <div className="ambient-orb orb-left"></div>
      <div className="ambient-orb orb-right"></div>

      <div style={{ display: 'flex', width: '100%', position: 'relative', zIndex: 10 }}>
        {/* Left Side: Modern Industrial AI Hero */}
        <div 
          className="splitscreen-hero"
          style={{
            flex: 1.2,
            background: 'linear-gradient(135deg, rgba(8, 14, 32, 0.9) 0%, rgba(3, 7, 18, 0.95) 100%)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px',
            position: 'relative'
          }}
        >
          {/* Logo & Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" stroke="#f97316" strokeWidth="2" strokeDasharray="6 4" />
              <circle cx="16" cy="16" r="8" stroke="#0284c7" strokeWidth="2" />
              <path d="M16 10V22M10 16H22" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFF', letterSpacing: '2px', lineHeight: 1 }}>NIGHA TECH</div>
              <div style={{ fontSize: '9px', color: '#0284c7', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>Chute Intelligence</div>
            </div>
          </div>

          {/* Central Diagnostic Illustration */}
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <h2 style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.5px', color: '#FFF', maxWidth: '500px' }}>
              Real-time Flow Analytics & <span style={{ color: '#f97316' }}>Predictive Safety</span> Control
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.6, maxWidth: '460px' }}>
              Hardened telemetry collection, autonomous acoustic localized blockage detection, and optimized air blaster command sequences on one secure dashboard.
            </p>

            {/* Glowing System Grid Mockup */}
            <div 
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                gap: '20px',
                maxWidth: '480px',
                boxShadow: 'inset 0 0 20px rgba(2, 132, 199, 0.05)'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>System Status</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#FFF', marginTop: '4px' }}>MONITORING ACTIVE</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Radar Link</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>● ONLINE</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>MQTT Broker</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>● CONNECTED</span>
                  </div>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#f97316' }}>98.4%</div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Uptime Avg</div>
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <div style={{ fontSize: '11px', color: '#475569', letterSpacing: '0.5px' }}>
            Nigha Radar Security System • Secure JWT OTP Protocol v2.1
          </div>
        </div>

        {/* Right Side: Authentication Panel */}
        <div 
          className="splitscreen-form"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
        >
          <div 
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '40px 32px'
            }}
          >
            {/* Header / Description */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🔑</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Secure Terminal Access
                </span>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFF', margin: 0 }}>
                {step === 1 ? 'Operator Login' : 'Verify Identity'}
              </h3>
              <p style={{ fontSize: '13.5px', color: '#94A3B8', marginTop: '8px', margin: 0, lineHeight: 1.6 }}>
                {step === 1 ? (
                  'Enter your registered mobile number to request a security OTP.'
                ) : (
                  <>
                    <strong style={{ color: '#FFF', display: 'block', marginBottom: '4px', fontSize: '14.5px' }}>Welcome to Chute Intelligence App</strong>
                    OTP has been requested.
                    <span style={{ display: 'block', fontSize: '12.5px', color: '#64748B', marginTop: '6px' }}>
                      If you don't receive it within a few seconds, you can resend after the timer expires.
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Error / Success Notifications */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Alert severity="error" style={{ marginBottom: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12.5px' }}>
                    {error}
                  </Alert>
                </motion.div>
              )}
              {info && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Alert severity="success" style={{ marginBottom: '20px', background: 'rgba(16, 185, 129, 0.1)', color: '#A7F3D0', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '12.5px' }}>
                    {info}
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* STEP 1: Phone input */}
            {step === 1 ? (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                    Mobile Number
                  </label>
                  <TextField
                    fullWidth
                    variant="outlined"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9391888104"
                    required
                    slotProps={{
                      input: {
                        style: { color: 'white', background: 'rgba(0,0,0,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                        '&:hover fieldset': { borderColor: '#f97316' },
                        '&.Mui-focused fieldset': { borderColor: '#f97316' },
                      }
                    }}
                  />
                </div>

                <Button
                  className="ripple-btn"
                  type="submit"
                  fullWidth
                  disabled={loading}
                  style={{
                    background: loading ? 'rgba(249, 115, 22, 0.2)' : 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                    color: 'white',
                    fontWeight: 700,
                    padding: '13px',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.2)',
                    fontSize: '13px'
                  }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Send OTP'}
                </Button>
              </form>
            ) : (
              /* STEP 2: Segmented OTP input */
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '12px' }}>
                    6-Digit Verification Code
                  </label>
                  
                  {/* Segmented Inputs Container */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    {otpVal.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className="segmented-input"
                      />
                    ))}
                  </div>
                </div>

                <Button
                  className="ripple-btn"
                  type="submit"
                  fullWidth
                  disabled={loading}
                  style={{
                    background: loading ? 'rgba(2, 132, 199, 0.2)' : 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)',
                    color: 'white',
                    fontWeight: 700,
                    padding: '13px',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.2)',
                    fontSize: '13px'
                  }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Verify & Login'}
                </Button>

                {/* Resend and Timer actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12.5px' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: 'underline'
                    }}
                  >
                    Edit Phone
                  </button>

                  {countdown > 0 ? (
                    <span style={{ color: '#64748B' }}>
                      Resend in <strong style={{ color: '#94A3B8' }}>{countdown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRequestOtp()}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f97316',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 700
                      }}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
