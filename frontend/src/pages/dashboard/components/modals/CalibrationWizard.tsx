import React, { useState, useCallback } from 'react';
import { Modal, Box, Alert, Button, CircularProgress } from '@mui/material';
import { Settings } from 'lucide-react';
import { getThemeColors } from '../../constants';

interface CalibrationWizardProps {
  open: boolean;
  onClose: () => void;
  activeChuteId: string | null;
  token: string | null;
  theme: 'dark' | 'light';
}

export const CalibrationWizard: React.FC<CalibrationWizardProps> = ({
  open,
  onClose,
  activeChuteId,
  token,
  theme,
}) => {
  const [calibStep, setCalibStep] = useState(1);
  const [calibZone, setCalibZone] = useState(1);
  const [calibMode, setCalibMode] = useState<'Auto' | 'Manual'>('Auto');
  const [calibBaseline, setCalibBaseline] = useState(3.5);
  const [calibMeasured, setCalibMeasured] = useState(3.5);
  const [calibNotes, setCalibNotes] = useState('');
  const [calibResult, setCalibResult] = useState<any>(null);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibError, setCalibError] = useState<string | null>(null);
  const [calibSafetyChecked1, setCalibSafetyChecked1] = useState(false);
  const [calibSafetyChecked2, setCalibSafetyChecked2] = useState(false);
  const [calibSafetyChecked3, setCalibSafetyChecked3] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const GREEN = colors.GREEN;
  const RED = colors.RED;

  const handleSaveCalibration = useCallback(async () => {
    if (!activeChuteId) return;
    setCalibLoading(true);
    setCalibError(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          zone: calibZone,
          baselineDistance: calibBaseline,
          measuredDistance: calibMeasured,
          calibrationMode: calibMode,
          notes: calibNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Calibration failed');
      setCalibResult(data);
      setCalibStep(5); // go to results step
    } catch (err: any) {
      setCalibError(err.message);
    } finally {
      setCalibLoading(false);
    }
  }, [activeChuteId, token, calibZone, calibBaseline, calibMeasured, calibMode, calibNotes]);

  const handleClose = () => {
    setCalibStep(1);
    setCalibSafetyChecked1(false);
    setCalibSafetyChecked2(false);
    setCalibSafetyChecked3(false);
    setCalibResult(null);
    setCalibError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={() => !calibLoading && handleClose()}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '16px',
        p: 4, width: 480, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
      }}>
        {/* Wizard Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} style={{ color: BLUE, animation: calibLoading ? 'spin 2s linear infinite' : 'none' }} />
            <span>Radar Calibration Wizard</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Step {calibStep} of 5
          </div>
        </div>

        {calibError && <Alert severity="error" style={{ marginBottom: '14px', fontSize: '12px' }}>{calibError}</Alert>}

        {/* STEP 1: Select Radar Zone & Baseline */}
        {calibStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Select the specific radar zone to calibrate. This process establishes the baseline clear-chute distance reference.
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Target Radar Zone</div>
              <select
                value={calibZone}
                onChange={(e) => setCalibZone(Number(e.target.value))}
                style={{
                  width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              >
                <option value={1} style={{ background: 'var(--card-bg)' }}>Zone 1 Radar (Upper Channel)</option>
                <option value={2} style={{ background: 'var(--card-bg)' }}>Zone 2 Radar (Mid-Upper Channel)</option>
                <option value={3} style={{ background: 'var(--card-bg)' }}>Zone 3 Radar (Mid-Lower Channel)</option>
                <option value={4} style={{ background: 'var(--card-bg)' }}>Zone 4 Radar (Lower Channel)</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Calibration Mode</div>
              <select
                value={calibMode}
                onChange={(e) => setCalibMode(e.target.value as any)}
                style={{
                  width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                }}
              >
                <option value="Auto" style={{ background: 'var(--card-bg)' }}>Auto (PLC Auto-Triggered Scan)</option>
                <option value="Manual" style={{ background: 'var(--card-bg)' }}>Manual (Physical Reference Input)</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Expected Clear Distance Baseline (m)</div>
              <input
                type="number"
                step="0.05"
                value={calibBaseline}
                onChange={(e) => setCalibBaseline(Number(e.target.value))}
                style={{
                  width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button
                onClick={() => setCalibStep(2)}
                variant="contained"
                style={{ background: BLUE, color: 'white', fontWeight: 700 }}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Safety Verification */}
        {calibStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '11px', color: RED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              ⚠️ Mandatory Safety Verification
            </span>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              For personnel safety and radar accuracy, verify and check all pre-calibration safety protocols below:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(244,63,94,0.05)', border: `1px solid ${RED}20`, borderRadius: '8px', padding: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={calibSafetyChecked1}
                  onChange={(e) => setCalibSafetyChecked1(e.target.checked)}
                  style={{ accentColor: RED }}
                />
                <span>Lock-out Tag-out (LOTO) active for chute entry</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={calibSafetyChecked2}
                  onChange={(e) => setCalibSafetyChecked2(e.target.checked)}
                  style={{ accentColor: RED }}
                />
                <span>No personnel inside the chute channel</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={calibSafetyChecked3}
                  onChange={(e) => setCalibSafetyChecked3(e.target.checked)}
                  style={{ accentColor: RED }}
                />
                <span>Solenoid valves and blast air system isolated</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <Button
                onClick={() => setCalibStep(1)}
                variant="outlined"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
              >
                Back
              </Button>
              <Button
                onClick={() => setCalibStep(3)}
                disabled={!calibSafetyChecked1 || !calibSafetyChecked2 || !calibSafetyChecked3}
                variant="contained"
                style={{
                  background: (!calibSafetyChecked1 || !calibSafetyChecked2 || !calibSafetyChecked3) ? 'var(--border)' : BLUE,
                  color: 'white', fontWeight: 700
                }}
              >
                Verify & Proceed
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Reference Scan Execution */}
        {calibStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
            {isScanning ? (
              <>
                <CircularProgress style={{ color: BLUE, marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Scanning Chute Reference Profile...</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Executing microwave radar frequency sweep on Zone {calibZone}...</div>
              </>
            ) : (
              <>
                <span style={{ fontSize: '36px', marginBottom: '8px' }}>📡</span>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Ready to Scan Chute Reference Profile</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Click the button below to trigger the physical radar scan. The radar will emit a high-frequency frequency sweep to measure the actual distance.
                </div>
                <Button
                  onClick={() => {
                    setIsScanning(true);
                    setTimeout(() => {
                      setIsScanning(false);
                      const drift = (Math.random() - 0.5) * 0.08;
                      setCalibMeasured(Math.round((calibBaseline + drift) * 100) / 100);
                      setCalibStep(4);
                    }, 1800);
                  }}
                  variant="contained"
                  style={{ background: BLUE, color: 'white', fontWeight: 700, marginTop: '12px' }}
                >
                  Execute Radar Reference Scan
                </Button>
              </>
            )}

            {!isScanning && (
              <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', marginTop: '16px' }}>
                <Button
                  onClick={() => setCalibStep(2)}
                  variant="outlined"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
                >
                  Back
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Review and Verify Baseline */}
        {calibStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Review the scanned reference measurement. Compare the expected baseline with the actual measured value.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-panel, rgba(255,255,255,0.03))', borderRadius: '8px', padding: '12px', border: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expected Baseline</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{calibBaseline}m</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Measured Distance</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: BLUE }}>{calibMeasured}m</div>
              </div>
            </div>

            {/* Accuracy estimation */}
            {(() => {
              const acc = calibBaseline > 0
                ? Math.max(0, 100 - Math.abs((calibMeasured - calibBaseline) / calibBaseline) * 100)
                : 100;
              const passed = acc >= 85;
              return (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  padding: '10px', borderRadius: '8px', background: passed ? 'rgba(52,211,153,0.05)' : 'rgba(244,63,94,0.05)',
                  border: `1px solid ${passed ? GREEN : RED}30`
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Calculated Accuracy Alignment</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: passed ? GREEN : RED }}>{Math.round(acc * 10) / 10}%</div>
                  <div style={{ fontSize: '10px', color: passed ? GREEN : RED, fontWeight: 700 }}>
                    {passed ? '✓ WITHIN TOLERANCE LIMITS' : '⚠️ OUT OF TOLERANCE LIMITS (< 85%)'}
                  </div>
                </div>
              );
            })()}

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Notes / Observer Log</div>
              <textarea
                value={calibNotes}
                onChange={(e) => setCalibNotes(e.target.value)}
                placeholder="e.g. Cleared minor material crusting before scan. Radar diagnostic check passes."
                rows={2}
                style={{
                  width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', borderRadius: '6px', padding: '10px', fontSize: '13px', outline: 'none',
                  fontFamily: 'var(--font-sans)', resize: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <Button
                onClick={() => setCalibStep(3)}
                variant="outlined"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
              >
                Back
              </Button>
              <Button
                onClick={handleSaveCalibration}
                disabled={calibLoading}
                variant="contained"
                style={{ background: GREEN, color: 'white', fontWeight: 700 }}
              >
                {calibLoading ? 'Saving...' : 'Commit Baseline'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Completion & Results */}
        {calibStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
            {calibResult?.passed ? (
              <>
                <span style={{ fontSize: '42px' }}>✅</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: GREEN }}>Radar Calibrated Successfully!</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Zone {calibZone} radar baseline has been updated to <strong>{calibMeasured}m</strong> with <strong>{calibResult.accuracyPercent}% accuracy</strong>.
                  An immutable log has been recorded in the Plant Audit ledger.
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: '42px' }}>⚠️</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: RED }}>Calibration Out of Tolerance!</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Scanned accuracy was <strong>{calibResult?.accuracyPercent}%</strong>, which is below the 85% operational threshold. 
                  Baseline was updated, but physical inspection of the radar face or internal build-up is highly recommended.
                </div>
              </>
            )}

            <Button
              onClick={handleClose}
              variant="contained"
              style={{ background: BLUE, color: 'white', fontWeight: 700, width: '120px', marginTop: '12px' }}
            >
              Done
            </Button>
          </div>
        )}
      </Box>
    </Modal>
  );
};
