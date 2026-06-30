import React from 'react';
import { getThemeColors } from '../constants';
import type { NavItem } from '../types';

interface SidebarProps {
  navItems: NavItem[];
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isMqttConnected: boolean;
  user: any;
  logout: () => void;
  theme: 'dark' | 'light';
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  navItems,
  activeTab,
  setActiveTab,
  isMqttConnected,
  user,
  logout,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const GREEN = colors.GREEN;
  const RED = colors.RED;

  return (
    <div className="glass-panel sidebar-container" style={{
      width: '240px',
      borderRight: `1px solid var(--border)`,
      padding: '24px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 20
    }}>
      {/* Branded Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: `1px solid var(--border-light)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🛰️</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: BLUE, letterSpacing: '1px', lineHeight: 1 }}>
              NIGHA TECH
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.8px', fontWeight: 700, textTransform: 'uppercase' }}>
              Chute Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: activeTab === item.id ? 'var(--bg-hover)' : 'transparent',
              color: activeTab === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === item.id ? 700 : 500,
              fontSize: '12.5px',
              transition: 'all 0.2s ease',
              textAlign: 'left'
            }}
            className={activeTab === item.id ? '' : 'glass-card'}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* System status connection & User profile footer */}
      <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: `1px solid var(--border-light)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isMqttConnected ? GREEN : RED,
            boxShadow: isMqttConnected ? `0 0 6px ${GREEN}` : 'none',
            animation: isMqttConnected ? 'blink-active 1.5s infinite alternate' : 'none'
          }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {isMqttConnected ? 'TELEMETRY LIVE' : 'DISCONNECTED'}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>{user?.name || 'Operator'}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>
          {user?.role || 'Operator'}
        </div>
        <button
          onClick={logout}
          style={{
            marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
});
