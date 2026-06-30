import React from 'react';
import { Sun, Moon, Mic } from 'lucide-react';
import { getThemeColors, getStatusColor, getStatusBg } from '../constants';

interface HeaderBarProps {
  chutes: any[];
  activeChuteId: string | null;
  setActiveChute: (id: string | null) => void;
  chuteStatus: string;
  chuteKpis: any;
  chuteHealthScore: number;
  unreadAlerts: number;
  clearUnreadAlerts: () => void;
  setExpandedTile: (tile: string | null) => void;
  voice: {
    isSupported: boolean;
    isListening: boolean;
    toggleListening: () => void;
  };
  theme: 'dark' | 'light';
  handleThemeToggle: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  chutes,
  activeChuteId,
  setActiveChute,
  chuteStatus,
  chuteKpis,
  chuteHealthScore,
  unreadAlerts,
  clearUnreadAlerts,
  setExpandedTile,
  voice,
  theme,
  handleThemeToggle,
}) => {
  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const PURPLE = colors.PURPLE;

  const statusColor = getStatusColor(chuteStatus, colors);
  const statusBg = getStatusBg(chuteStatus);
  const healthColor = chuteHealthScore >= 80 ? GREEN : chuteHealthScore >= 50 ? colors.AMBER : RED;

  return (
    <div className="glass-panel" style={{
      borderBottom: `1px solid var(--border)`,
      padding: '0 24px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      zIndex: 10
    }}>
      {/* Chute drop selector & Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <select
          value={activeChuteId || ''}
          onChange={(e) => setActiveChute(e.target.value)}
          style={{
            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            border: `1px solid var(--border)`, padding: '6px 12px', borderRadius: '8px'
          }}
        >
          {chutes.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        {/* Status capsule */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '20px',
          background: statusBg, border: `1px solid ${statusColor}30`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: 'blink-active 1s infinite alternate' }} />
          <span style={{ fontSize: '10px', fontWeight: 800, color: statusColor, letterSpacing: '0.8px' }}>
            {chuteStatus.toUpperCase()}
          </span>
        </div>

        {/* Top summary KPIs */}
        {chuteKpis && (
          <div className="mobile-hidden" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: healthColor }}>{chuteHealthScore}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>health</span>
            </div>
            <span style={{ color: 'var(--border)', fontSize: '14px' }}>·</span>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: GREEN }}>{chuteKpis.uptimePercent24h}%</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>uptime</span>
            </div>
            {chuteKpis.consecutiveFailedBlasts >= 2 && (
              <div style={{
                padding: '2px 8px', borderRadius: '4px', background: 'rgba(244,63,94,0.1)',
                border: `1px solid ${RED}30`, fontSize: '10px', fontWeight: 800, color: RED
              }}>
                ⚠️ {chuteKpis.consecutiveFailedBlasts} Blast Failures
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header controls: alerts and theme toggling */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {unreadAlerts > 0 && (
          <button
            onClick={() => { setExpandedTile('timeline'); clearUnreadAlerts(); }}
            style={{
              position: 'relative', padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(244,63,94,0.1)', border: `1px solid ${RED}30`,
              color: RED, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            🔔 {unreadAlerts} alerts
          </button>
        )}

        {/* Voice Command Widget — Real Web Speech API */}
        <button
          onClick={() => {
            if (!voice.isSupported) {
              return;
            }
            voice.toggleListening();
          }}
          className={`glass-card ${voice.isListening ? 'voice-mic-active' : ''}`}
          style={{
            background: voice.isListening ? 'rgba(167, 139, 250, 0.15)' : 'var(--card-bg)',
            borderColor: voice.isListening ? PURPLE : 'var(--border)',
            color: voice.isListening ? PURPLE : 'var(--text-secondary)',
            padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px', position: 'relative',
          }}
          title={voice.isListening ? '🎤 Listening… (say a command)' : voice.isSupported ? 'Enable Voice Command (Hey Nigha)' : 'Voice not supported in this browser'}
        >
          <Mic size={16} />
          {voice.isListening && (
            <span style={{
              position: 'absolute', top: -4, right: -4, width: 8, height: 8,
              borderRadius: '50%', background: PURPLE, animation: 'pulseGlow 1s infinite',
            }} />
          )}
        </button>

        <button
          onClick={handleThemeToggle}
          style={{
            padding: '6px 10px', borderRadius: '8px', background: 'var(--card-bg)',
            border: `1px solid var(--border)`, color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
          className="rotate-switch"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Day Shift' : 'Night Ops'}
        </button>
      </div>
    </div>
  );
};
