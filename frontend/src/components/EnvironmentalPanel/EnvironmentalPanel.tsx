import React from 'react';
import { motion } from 'framer-motion';
import { useTelemetryStore } from '../../store/telemetryStore';

interface EnvironmentalPanelProps {
  isDark: boolean;
  themeTextSec: string;
  themeBorder: string;
}

const SolenoidIndicator: React.FC<{ valveNumber: number; healthScore: number; isDark: boolean; themeTextSec: string }> = ({
  valveNumber, healthScore, isDark, themeTextSec
}) => {
  const status = healthScore >= 80 ? 'good' : healthScore >= 50 ? 'warn' : 'critical';
  const colors = { good: '#10b981', warn: '#f59e0b', critical: '#ef4444' };
  const color = colors[status];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      {/* Solenoid body */}
      <div style={{
        width: '28px',
        height: '40px',
        borderRadius: '4px 4px 6px 6px',
        background: isDark ? '#1f2937' : '#e5e7eb',
        border: `2px solid ${color}`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 6px ${color}40`,
      }}>
        {/* Coil lines */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            top: `${8 + i * 8}px`,
            left: '3px',
            right: '3px',
            height: '2px',
            background: `${color}60`,
            borderRadius: '1px',
          }} />
        ))}
        {/* Status dot */}
        <div style={{
          position: 'absolute',
          top: '3px',
          right: '3px',
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 4px ${color}`,
        }} />
      </div>
      <span style={{ fontSize: '9px', color: themeTextSec, fontFamily: 'Share Tech Mono' }}>V{valveNumber}</span>
      <span style={{ fontSize: '9px', color, fontWeight: 700 }}>{healthScore}%</span>
    </div>
  );
};

const GaugeArc: React.FC<{ value: number; max: number; color: string; label: string; unit: string; warn?: number; critical?: number }> = ({
  value, max, color, label, unit, warn, critical
}) => {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = 28;
  const cx = 36;
  const cy = 36;
  const arcStart = Math.PI * 0.8;
  const arcEnd = Math.PI * 2.2;
  const totalArc = arcEnd - arcStart;

  const polarX = (angle: number) => cx + r * Math.cos(angle);
  const polarY = (angle: number) => cy + r * Math.sin(angle);

  const bgPath = `M ${polarX(arcStart)} ${polarY(arcStart)} A ${r} ${r} 0 1 1 ${polarX(arcEnd)} ${polarY(arcEnd)}`;
  
  const valueAngle = arcStart + pct * totalArc;
  const valuePath = pct > 0
    ? `M ${polarX(arcStart)} ${polarY(arcStart)} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${polarX(valueAngle)} ${polarY(valueAngle)}`
    : '';

  const activeColor = (critical && value >= critical) ? '#ef4444' : (warn && value >= warn) ? '#f59e0b' : color;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="72" height="52" viewBox="0 0 72 52">
        {/* Background arc */}
        <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round" />
        {/* Value arc */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={activeColor} strokeWidth="5" strokeLinecap="round" />
        )}
        {/* Center value text */}
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill={activeColor} fontFamily="Share Tech Mono">
          {value.toFixed(value < 10 ? 1 : 0)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.4)" fontFamily="Share Tech Mono">
          {unit}
        </text>
      </svg>
      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '-4px', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
};

export const EnvironmentalPanel: React.FC<EnvironmentalPanelProps> = ({ isDark, themeTextSec, themeBorder }) => {
  const { telemetryHistory, solenoids, health, compressor } = useTelemetryStore();

  // Get latest temperature & humidity from telemetry history
  const latest = telemetryHistory.length > 0 ? telemetryHistory[telemetryHistory.length - 1] : null;
  const temperature = latest?.temperature ?? 30;
  const humidity = latest?.humidity ?? 45;
  const pressure = compressor?.pressure ?? 110;
  const motorTemp = compressor?.motorTemperature ?? 28;

  const bgPanel = isDark ? '#111827' : '#ffffff';
  const bgCell = isDark ? '#0f1622' : '#f8fafc';

  return (
    <div style={{
      background: bgPanel,
      borderRadius: '12px',
      border: `1px solid ${themeBorder}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: `1px solid ${themeBorder}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: '#ff6b35' }}>
          ENVIRONMENTAL & MECHANICAL SENSORS
        </span>
        {/* Hub health indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: health?.isOnline ? '#10b981' : '#ef4444',
              boxShadow: `0 0 6px ${health?.isOnline ? '#10b981' : '#ef4444'}`,
            }}
          />
          <span style={{ fontSize: '9px', color: themeTextSec, letterSpacing: '0.5px' }}>
            HUB {health?.isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Environmental Gauges Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
        }}>
          <div style={{ background: bgCell, borderRadius: '8px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${themeBorder}` }}>
            <GaugeArc value={temperature} max={60} color="#3b82f6" label="TEMPERATURE" unit="°C" warn={40} critical={50} />
          </div>
          <div style={{ background: bgCell, borderRadius: '8px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${themeBorder}` }}>
            <GaugeArc value={humidity} max={100} color="#06b6d4" label="HUMIDITY" unit="%" warn={75} critical={90} />
          </div>
          <div style={{ background: bgCell, borderRadius: '8px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${themeBorder}` }}>
            <GaugeArc value={pressure} max={140} color="#ff6b35" label="AIR PRESSURE" unit="PSI" warn={0} critical={80} />
          </div>
          <div style={{ background: bgCell, borderRadius: '8px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${themeBorder}` }}>
            <GaugeArc value={motorTemp} max={100} color="#8b5cf6" label="MOTOR TEMP" unit="°C" warn={70} critical={85} />
          </div>
        </div>

        {/* Solenoid Valves Row */}
        <div style={{ background: bgCell, borderRadius: '8px', padding: '14px 16px', border: `1px solid ${themeBorder}` }}>
          <div style={{ fontSize: '10px', color: themeTextSec, letterSpacing: '1px', marginBottom: '12px', textTransform: 'uppercase' }}>
            Solenoid Valve Array — 8-Valve Manifold
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
            {Array.from({ length: 8 }, (_, i) => {
              const solenoidData = solenoids.find(s => s.valveNumber === i + 1);
              return (
                <SolenoidIndicator
                  key={i}
                  valveNumber={i + 1}
                  healthScore={solenoidData?.healthScore ?? 100}
                  isDark={isDark}
                  themeTextSec={themeTextSec}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', borderTop: `1px solid ${themeBorder}`, paddingTop: '8px' }}>
            {[
              { label: 'Avg Health', val: solenoids.length > 0 ? Math.round(solenoids.reduce((a, s) => a + s.healthScore, 0) / solenoids.length) : 100, color: '#10b981', unit: '%' },
              { label: 'Total Cycles', val: solenoids.reduce((a, s) => a + (s.totalCycles ?? 0), 0), color: '#fbbf24', unit: '' },
              { label: 'Lifespan Rem.', val: solenoids.length > 0 ? Math.min(...solenoids.map(s => s.lifespanCycles - (s.totalCycles ?? 0))) : 50000, color: '#3b82f6', unit: ' cyc' },
            ].map((item, i) => (
              <div key={i}>
                <span style={{ fontSize: '9px', color: themeTextSec, display: 'block' }}>{item.label}</span>
                <strong style={{ fontSize: '13px', color: item.color, fontFamily: 'Share Tech Mono' }}>
                  {item.val.toLocaleString()}{item.unit}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
