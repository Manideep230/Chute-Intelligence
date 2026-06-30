import React from 'react';
import { Home, Bell, FileText, Settings } from 'lucide-react';
import { getThemeColors } from '../constants';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  expandedTile: string | null;
  setExpandedTile: (tile: string | null) => void;
  theme: 'dark' | 'light';
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  expandedTile,
  setExpandedTile,
  theme,
}) => {
  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const RED = colors.RED;

  return (
    <div className="mobile-bottom-nav glass-panel" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px',
      display: 'none',
      justifyContent: 'space-around', alignItems: 'center',
      zIndex: 100, borderTop: `1px solid var(--border)`,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
    }}>
      <button
        onClick={() => { setActiveTab('dashboard'); setExpandedTile(null); }}
        style={{
          background: 'none', border: 'none', color: activeTab === 'dashboard' ? BLUE : 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
        }}
      >
        <Home size={18} />
        <span style={{ fontSize: '9px', fontWeight: activeTab === 'dashboard' ? 700 : 500 }}>Home</span>
      </button>

      <button
        onClick={() => { setActiveTab('dashboard'); setExpandedTile('timeline'); }}
        style={{
          background: 'none', border: 'none', color: expandedTile === 'timeline' ? RED : 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
        }}
      >
        <Bell size={18} />
        <span style={{ fontSize: '9px', fontWeight: expandedTile === 'timeline' ? 700 : 500 }}>Alerts</span>
      </button>

      <button
        onClick={() => { setActiveTab('audit'); setExpandedTile(null); }}
        style={{
          background: 'none', border: 'none', color: activeTab === 'audit' ? BLUE : 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
        }}
      >
        <FileText size={18} />
        <span style={{ fontSize: '9px', fontWeight: activeTab === 'audit' ? 700 : 500 }}>Reports</span>
      </button>

      <button
        onClick={() => { setActiveTab('profile'); setExpandedTile(null); }}
        style={{
          background: 'none', border: 'none', color: activeTab === 'profile' ? BLUE : 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
        }}
      >
        <Settings size={18} />
        <span style={{ fontSize: '9px', fontWeight: activeTab === 'profile' ? 700 : 500 }}>Settings</span>
      </button>
    </div>
  );
};
