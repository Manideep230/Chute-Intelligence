import React from 'react';
import { Sun, Moon } from 'lucide-react';
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
  theme: 'dark' | 'light';
  handleThemeToggle: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = React.memo(({
  chutes,
  activeChuteId,
  setActiveChute,
  chuteStatus,
  chuteKpis,
  chuteHealthScore,
  unreadAlerts,
  clearUnreadAlerts,
  setExpandedTile,
  theme,
  handleThemeToggle,
}) => {
  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const AMBER = colors.AMBER;

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
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: chuteKpis.uptimePercent24h >= 90 ? GREEN : chuteKpis.uptimePercent24h >= 75 ? AMBER : RED }}>
                {chuteKpis.uptimePercent24h}%
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>uptime</span>
            </div>
            {chuteKpis.consecutiveFailedBlasts > 0 && (
              <div style={{
                padding: '2px 8px', borderRadius: '4px', background: 'rgba(244,63,94,0.1)',
                border: `1px solid ${RED}30`, fontSize: '10px', fontWeight: 800, color: RED
              }}>
                ⚠️ {chuteKpis.consecutiveFailedBlasts} Blast Failure{chuteKpis.consecutiveFailedBlasts > 1 ? 's' : ''}
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
});
