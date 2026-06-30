import React, { useState, useRef } from 'react';
import { getThemeColors } from '../../constants';
import { useTelemetryStore } from '../../../../store/telemetryStore';

interface BlastControlPanelProps {
  activeChuteId: string | null;
  nearestSolenoidGroup: number;
  chuteStatus: string;
  simulationMode: boolean;
  token: string | null;
  roleAccess: any;
  theme: 'dark' | 'light';
}

export const BlastControlPanel: React.FC<BlastControlPanelProps> = ({
  activeChuteId,
  nearestSolenoidGroup,
  chuteStatus,
  simulationMode,
  token,
  roleAccess,
  theme,
}) => {
  const [blastSelectedGroup, setBlastSelectedGroup] = useState<number>(1);
  const [blastHolding, setBlastHolding] = useState(false);
  const [blastHoldProgress, setBlastHoldProgress] = useState(0);
  const [blastFiring, setBlastFiring] = useState(false);
  const [blastResult, setBlastResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const blastHoldTimerRef = useRef<any>(null);

  const {
    compressor,
    setActiveBlasterNumber,
    setActiveSolenoidValves,
    updateStatus,
  } = useTelemetryStore();

  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const AMBER = colors.AMBER;
  const BLUE = colors.BLUE;

  const handleBlastGroupFire = async () => {
    if (!activeChuteId || blastFiring) return;
    setBlastFiring(true);
    setBlastResult(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ blasterNumber: blastSelectedGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (simulationMode) {
        setActiveBlasterNumber(blastSelectedGroup);
        setActiveSolenoidValves([blastSelectedGroup * 2 - 1, blastSelectedGroup * 2]);
      }

      updateStatus('Blasting');
      setBlastResult({ ok: true, msg: data.message || `Blast Group ${blastSelectedGroup} fired successfully.` });
    } catch (err: any) {
      setBlastResult({ ok: false, msg: err.message || 'Blast failed' });
    } finally {
      setBlastFiring(false);
      setBlastHolding(false);
      setBlastHoldProgress(0);
    }
  };

  const startBlastHold = () => {
    if (!roleAccess.canTriggerManualBlast || blastFiring) return;
    setBlastHolding(true);
    setBlastHoldProgress(0);
    let elapsed = 0;
    blastHoldTimerRef.current = setInterval(() => {
      elapsed += 50;
      const pct = Math.min(100, (elapsed / 2000) * 100);
      setBlastHoldProgress(pct);
      if (elapsed >= 2000) {
        if (blastHoldTimerRef.current) clearInterval(blastHoldTimerRef.current);
        blastHoldTimerRef.current = null;
        handleBlastGroupFire();
      }
    }, 50);
  };

  const cancelBlastHold = () => {
    if (blastHoldTimerRef.current) {
      clearInterval(blastHoldTimerRef.current);
      blastHoldTimerRef.current = null;
    }
    setBlastHolding(false);
    setBlastHoldProgress(0);
  };

  return (
    <div className="bento-span-full bento-tile" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            🔥 Blast Control Panel
          </span>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Select solenoid group → Hold FIRE BLAST for 2 seconds to activate
          </div>
        </div>
        {compressor && compressor.pressure < 80 && (
          <div style={{ fontSize: '9px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(244,63,94,0.1)', color: RED, fontWeight: 800, border: `1px solid ${RED}30` }}>
            ⚠️ LOW PRESSURE — {compressor.pressure.toFixed(0)} PSI
          </div>
        )}
      </div>

      {/* Group Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map(grp => {
          const isRecommended = grp === nearestSolenoidGroup && chuteStatus !== 'Normal';
          const isSelected = grp === blastSelectedGroup;
          return (
            <button
              key={grp}
              id={`blast-group-btn-${grp}`}
              onClick={() => { setBlastSelectedGroup(grp); setBlastResult(null); }}
              style={{
                flex: 1, minWidth: '80px', padding: '10px 8px',
                borderRadius: '8px', border: `2px solid ${isSelected ? BLUE : isRecommended ? AMBER : 'var(--border)'}`,
                background: isSelected ? `${BLUE}18` : isRecommended ? `${AMBER}12` : 'var(--card-bg)',
                color: isSelected ? BLUE : isRecommended ? AMBER : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: 800, fontSize: '11px',
                transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>G{grp}</span>
              <span style={{ fontSize: '8px', color: isRecommended ? AMBER : 'var(--text-muted)', fontWeight: 700 }}>
                {[`S${grp}A`, `S${grp}B`, `S${grp}C`, `S${grp}D`].join(' ')}
              </span>
              {isRecommended && (
                <span style={{ fontSize: '7px', padding: '1px 5px', borderRadius: '4px', background: `${AMBER}20`, color: AMBER, fontWeight: 900 }}>RECOMMENDED</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hold-to-Fire Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {blastHolding && (
          <div style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--border-light)', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${blastHoldProgress}%`,
              background: blastHoldProgress < 60 ? AMBER : RED,
              transition: 'width 0.05s linear',
              boxShadow: blastHoldProgress > 90 ? `0 0 8px ${RED}` : 'none',
            }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            id="blast-fire-button"
            disabled={blastFiring || (compressor !== null && compressor.pressure < 80)}
            onMouseDown={startBlastHold}
            onMouseUp={cancelBlastHold}
            onMouseLeave={cancelBlastHold}
            onTouchStart={startBlastHold}
            onTouchEnd={cancelBlastHold}
            style={{
              flex: 1, padding: '14px 20px',
              borderRadius: '10px', border: 'none',
              background: blastFiring
                ? 'rgba(0,212,255,0.2)'
                : blastHolding
                ? `linear-gradient(135deg, ${RED} 0%, #ff6b35 100%)`
                : `linear-gradient(135deg, rgba(244,63,94,0.85) 0%, rgba(239,68,68,0.9) 100%)`,
              color: '#fff',
              cursor: blastFiring || (compressor !== null && compressor.pressure < 80) ? 'not-allowed' : 'pointer',
              fontWeight: 900, fontSize: '13px', letterSpacing: '1.5px',
              textTransform: 'uppercase',
              boxShadow: blastHolding ? `0 0 20px ${RED}60` : '0 4px 12px rgba(244,63,94,0.3)',
              transition: 'all 0.15s ease',
              userSelect: 'none',
              opacity: (compressor !== null && compressor.pressure < 80) ? 0.5 : 1,
            }}
          >
            {blastFiring ? '⚡ FIRING...' : blastHolding ? `🔥 HOLD ${Math.round(blastHoldProgress)}%` : `🔥 FIRE BLAST — GROUP ${blastSelectedGroup}`}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', minWidth: '54px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>PRESSURE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 900, color: compressor && compressor.pressure < 80 ? RED : GREEN }}>
              {compressor ? `${compressor.pressure.toFixed(0)}` : '--'} <span style={{ fontSize: '8px', fontWeight: 600 }}>PSI</span>
            </div>
          </div>
        </div>

        {blastResult && (
          <div style={{
            padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
            background: blastResult.ok ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)',
            border: `1px solid ${blastResult.ok ? GREEN : RED}30`,
            color: blastResult.ok ? GREEN : RED,
          }}>
            {blastResult.ok ? '✓' : '✗'} {blastResult.msg}
          </div>
        )}

        <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
          Hold the button for 2 seconds to confirm blast. Release early to cancel.
        </div>
      </div>
    </div>
  );
};
