import React, { useState, useRef } from 'react';
import { RefreshCw, Maximize2, Thermometer, Droplets, Clock, ChevronRight } from 'lucide-react';
import { CircularProgress } from '@mui/material';
import { getThemeColors, getStatusColor } from '../../constants';
import { useTelemetryStore } from '../../../../store/telemetryStore';
import { useAuthStore } from '../../../../store/authStore';
import { BlastControlPanel } from './BlastControlPanel';
import { TelemetryChart } from '../../../../components/TelemetryChart/TelemetryChart';

// Lazy load heavy components for route/bundle optimization
const ChuteDigitalTwin = React.lazy(() => import('../../../../components/DigitalTwin/ChuteDigitalTwin').then(module => ({ default: module.ChuteDigitalTwin })));
const GlobalMap = React.lazy(() => import('../../../../components/Map/GlobalMap').then(module => ({ default: module.GlobalMap })));

interface OperationsGridProps {
  chutes: any[];
  theme: 'dark' | 'light';
  roleAccess: any;
  setExpandedTile: (tile: string | null) => void;
  expandedTile: string | null;
  twinRotationX: number;
  setTwinRotationX: React.Dispatch<React.SetStateAction<number>>;
  triggerPullToRefresh: () => void;
  isRefreshing: boolean;
  setReportModalOpen: (open: boolean) => void;
  setCalibModalOpen: (open: boolean) => void;
  setBlockageModalOpen: (open: boolean) => void;
  chuteHealthScore: number;
  blastEffScore: number;
  timelineEvents: any[];
  throughput: number;
  throughputHistory: number[];
  wearIndex: number;
  avgBlasterHealth: number;
  energy: number;
  chuteKpis: any;
}

export const OperationsGrid: React.FC<OperationsGridProps> = ({
  chutes,
  theme,
  roleAccess,
  setExpandedTile,
  expandedTile,
  twinRotationX,
  setTwinRotationX,
  triggerPullToRefresh,
  isRefreshing,
  setReportModalOpen,
  setCalibModalOpen,
  setBlockageModalOpen,
  chuteHealthScore,
  blastEffScore,
  timelineEvents,
  throughput,
  throughputHistory,
  wearIndex,
  avgBlasterHealth,
  energy,
  chuteKpis,
}) => {
  const { token } = useAuthStore();
  const {
    activeChuteId,
    chuteStatus,
    activePath,
    simulationMode,
    blockagePosition,
    blockageDistance,
    nearestSolenoidGroup,
    activeSolenoidValves,
    applyLocalization,
    setActiveBlasterNumber,
    setActiveSolenoidValves,
    updateStatus,
    radars,
    solenoids,
    compressor,
    liveTemperature,
    liveHumidity,
    prediction,
    commandsList,
    fetchCommandsList,
  } = useTelemetryStore();

  const [injZone, setInjZone] = useState<number>(1);
  const [injDistance, setInjDistance] = useState<number>(0.55);
  const [injPosition, setInjPosition] = useState('');

  const handleRetryCommand = async (commandId: string) => {
    try {
      const res = await fetch(`/_/backend/hardware/retry-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ commandId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Retry failed');
      }
      // Refresh list in store
      fetchCommandsList(activeChuteId, token);
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  const touchStartRef = useRef<{ x: number, y: number } | null>(null);

  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const AMBER = colors.AMBER;
  const BLUE = colors.BLUE;
  const PURPLE = colors.PURPLE;

  const isDark = theme === 'dark';
  const statusColor = getStatusColor(chuteStatus, colors);

  const healthColor = chuteHealthScore >= 80 ? GREEN : chuteHealthScore >= 50 ? AMBER : RED;

  // Local static histories to simulate sparklines
  const healthHistory = [95, 96, 94, 95, 92, 90, 89, 92, 94, chuteHealthScore];

  const handleToggleSimulationMode = async (mode: boolean) => {
    if (!activeChuteId) return;
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to toggle mode');
      const chute = data.chute;
      if (chute) {
        applyLocalization({
          activePath: chute.activePath || 'LEFT_SLANT',
          simulationMode: chute.simulationMode ?? mode,
          blockagePosition: chute.blockagePosition || 'None',
          blockageDistance: chute.blockageDistance ?? 3.5,
          nearestSolenoidGroup: chute.nearestSolenoidGroup ?? 1,
          status: chute.status || 'Normal',
        });
      }
    } catch (err: any) {
      alert(`Failed to toggle operational mode: ${err.message}`);
    }
  };

  const handleManualBlockageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChuteId) return;
    try {
      const path: 'LEFT_SLANT' | 'RIGHT_SLANT' = (injZone === 1 || injZone === 4) ? 'LEFT_SLANT' : 'RIGHT_SLANT';
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          activePath: path,
          blockagePosition: injPosition || `Zone ${injZone}`,
          blockageDistance: injDistance,
          nearestSolenoidGroup: injZone,
          injectRadarZone: injZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Blockage injection failed');
      const chute = data.chute;
      if (chute) {
        applyLocalization({
          activePath: chute.activePath || path,
          simulationMode: true,
          blockagePosition: chute.blockagePosition || injPosition || `Zone ${injZone}`,
          blockageDistance: chute.blockageDistance ?? injDistance,
          nearestSolenoidGroup: chute.nearestSolenoidGroup ?? injZone,
          status: chute.status || 'Normal',
        });
      }
    } catch (err: any) {
      alert(`Blockage injection failed: ${err.message}`);
    }
  };

  const handleManualValveBlast = async (valveNumber: number) => {
    if (!activeChuteId) return;
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/blast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ valveNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (simulationMode) {
        setActiveBlasterNumber(Math.ceil(valveNumber / 2));
        setActiveSolenoidValves([valveNumber]);
      }
      updateStatus('Blasting');
    } catch (err: any) {
      alert(`Manual blast failed: ${err.message}`);
    }
  };

  // Sparkline chart renderer
  const renderSparkline = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data) + 1;
    const min = Math.min(...data) - 1;
    const range = max - min || 1;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * 60;
      const y = 20 - ((val - min) / range) * 16;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="60" height="24" viewBox="0 0 60 24">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        <circle cx="60" cy={20 - ((data[data.length - 1] - min) / range) * 16} r="2" fill={color} />
      </svg>
    );
  };

  // Compact Area Sparkline
  const renderAreaSparkline = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data) + 2;
    const min = Math.min(...data) - 2;
    const range = max - min || 1;

    const width = 100;
    const height = 30;

    const linePoints = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - 2 - ((val - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const fillPoints = `${linePoints} ${width},${height} 0,${height}`;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#areaGrad)" points={fillPoints} />
        <polyline fill="none" stroke={color} strokeWidth="1.2" points={linePoints} />
      </svg>
    );
  };

  // Hero custom synapse dots background
  const renderSynapsesBg = () => (
    <svg className="synapses-bg" viewBox="0 0 400 400" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="40" cy="80" r="1.5" fill="var(--accent-primary)" opacity="0.3" />
      <circle cx="150" cy="180" r="2" fill="var(--accent-primary)" opacity="0.5" />
      <circle cx="280" cy="110" r="1.5" fill="var(--accent-primary)" opacity="0.4" />
      <circle cx="340" cy="240" r="2" fill="var(--accent-primary)" opacity="0.4" />
      <circle cx="100" cy="320" r="2" fill="var(--accent-primary)" opacity="0.3" />
      <path d="M40 80 L150 180 M150 180 L280 110 M280 110 L340 240 M150 180 L100 320 M100 320 L340 240" stroke="var(--accent-primary)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
    </svg>
  );

  // Radial Gauge renderer
  const renderRadialGauge = (score: number, color: string) => {
    const radius = 46;
    const strokeWidth = 8;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (score / 100) * circ;

    return (
      <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-light)" strokeWidth={strokeWidth} />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: color }}>{score}</span>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '-2px', fontWeight: 600 }}>HEALTH</span>
        </div>
      </div>
    );
  };

  // Touch start ref for pull-to-refresh
  const touchStartLocal = useRef<{ x: number; y: number } | null>(null);

  const isArActive = activeSolenoidValves.length > 0;

  return (
    <div
      className="main-content-scroll"
      style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      onTouchStart={(e) => {
        if (e.currentTarget.scrollTop === 0) {
          touchStartLocal.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
          };
        }
      }}
      onTouchEnd={(e) => {
        if (touchStartLocal.current) {
          const diffY = e.changedTouches[0].clientY - touchStartLocal.current.y;
          if (diffY > 80) {
            triggerPullToRefresh();
          }
          touchStartLocal.current = null;
        }
      }}
    >
      {isRefreshing && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', background: 'var(--bg-hover)', color: BLUE, fontSize: '11px', fontWeight: 700 }}>
          <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />
          REFRESHING RADAR DATA...
        </div>
      )}

      <div className="bento-container">

        {/* 1. HERO TILE (spans 2 cols × 2 rows) */}
        <div
          className="bento-tile bento-span-2 bento-row-span-2 visualization-tile"
          style={{ padding: 0 }}
        >
          {renderSynapsesBg()}

          {/* Header HUD overlay */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
            background: 'linear-gradient(to bottom, rgba(10,15,26,0.7) 0%, rgba(10,15,26,0) 100%)',
            pointerEvents: 'none'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: BLUE, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                Live Chute Digital Twin
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Vizag Plant · 3D Isometric Feed
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
              <span className="shimmer-badge" style={{ borderColor: isArActive ? PURPLE : 'var(--border)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isArActive ? PURPLE : 'var(--text-muted)' }} />
                AR OVERLAY ACTIVE
              </span>
            </div>
          </div>

          {/* 3D viewport canvas */}
          <div className="visualization-canvas" style={{ position: 'relative', width: '100%' }}
            onTouchStart={(e) => {
              touchStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
              };
            }}
            onTouchEnd={(e) => {
              if (touchStartRef.current) {
                const diffX = e.changedTouches[0].clientX - touchStartRef.current.x;
                if (Math.abs(diffX) > 80) {
                  setTwinRotationX(r => (r + (diffX > 0 ? 45 : -45)) % 360);
                }
                touchStartRef.current = null;
              }
            }}
          >
            <React.Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <CircularProgress color="inherit" size={30} />
              </div>
            }>
              {expandedTile !== 'hero' ? (
                <ChuteDigitalTwin theme={theme} rotationX={twinRotationX} />
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%', 
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  gap: '6px',
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  <span style={{ width: '6px', height: '6px', backgroundColor: BLUE, borderRadius: '50%', boxShadow: `0 0 6px ${BLUE}` }} />
                  <span style={{ letterSpacing: '1px', fontWeight: 600 }}>3D VIEW ACTIVE IN OVERVIEW</span>
                </div>
              )}
            </React.Suspense>
          </div>

          {/* Footer overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
            background: 'linear-gradient(to top, rgba(10,15,26,0.85) 0%, rgba(10,15,26,0) 100%)',
            borderTop: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Flow Rate</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: BLUE, fontFamily: 'var(--font-mono)' }}>
                  {throughput.toFixed(1)} t/h
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Fill Level</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: statusColor, fontFamily: 'var(--font-mono)' }}>
                  {Math.min(100, Math.round(98 - (radars[0]?.distance ?? 3.5) * 25))}%
                </div>
              </div>
            </div>

            <button
              onClick={() => setExpandedTile('hero')}
              style={{
                background: 'rgba(0, 212, 255, 0.1)', color: BLUE, border: 'none',
                borderRadius: '6px', padding: '6px 12px', fontSize: '10px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Maximize2 size={10} />
              EXPAND VIEW
            </button>
          </div>
        </div>

        {/* 11. GNSS TRACKER MAP (2cols × 2rows) */}
        <div
          className="bento-tile bento-span-2 bento-row-span-2 visualization-tile"
          style={{ padding: '16px' }}
        >
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: BLUE, textTransform: 'uppercase', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-sans)' }}>
            GNSS Geofence Tracker
          </span>
          <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', background: 'var(--border-light)', height: 'calc(100% - 30px)' }}>
            <React.Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <CircularProgress color="inherit" size={24} />
              </div>
            }>
              {chutes.length > 0 && <GlobalMap chutes={chutes} />}
            </React.Suspense>
          </div>
        </div>

        {/* 13. BLAST CONTROL PANEL (full width) */}
        {roleAccess.canTriggerManualBlast && (
          <BlastControlPanel
            activeChuteId={activeChuteId}
            nearestSolenoidGroup={nearestSolenoidGroup}
            chuteStatus={chuteStatus}
            simulationMode={simulationMode}
            token={token}
            roleAccess={roleAccess}
            theme={theme}
          />
        )}

        {/* 2. HEALTH SCORE TILE (1col × 1row) */}
        <div
          className="bento-tile"
          onClick={() => setExpandedTile('health')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Chute Health
            </span>
            {renderSparkline(healthHistory, healthColor)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '12px 0' }}>
            {renderRadialGauge(chuteHealthScore, healthColor)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS:</span>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: healthColor, letterSpacing: '0.5px' }}>
              {chuteHealthScore >= 80 ? 'STABLE' : chuteHealthScore >= 50 ? 'DEGRADED' : 'CRITICAL'}
            </span>
          </div>
        </div>

        {/* 3. THROUGHPUT TILE (1col × 1row) */}
        <div
          className="bento-tile"
          onClick={() => setExpandedTile('throughput')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Throughput
            </span>
            <span style={{ fontSize: '11px', color: GREEN, fontWeight: 700 }}>
              ↑ 1.4%
            </span>
          </div>

          <div style={{ margin: '14px 0' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: BLUE, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {throughput.toFixed(1)}
            </div>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>TONS PER HOUR</span>
          </div>

          <div style={{ width: '100%', height: '30px' }}>
            {renderAreaSparkline(throughputHistory, BLUE)}
          </div>
        </div>

        {/* 4. PREDICTIVE DIAGNOSTICS TILE (2cols × 1row) */}
        <div
          className="bento-tile bento-span-2 ai-pulse-tile"
          style={{ background: 'var(--panel-bg)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="ai-active-dot" />
              <span className="shimmer-badge">PREDICTIVE</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Flow Analytics</span>
            </div>

            <button
              onClick={() => setExpandedTile('predictive')}
              style={{
                background: 'none', color: PURPLE, fontSize: '9.5px', fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '2px'
              }}
            >
              DETAILS <ChevronRight size={10} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', margin: '12px 0 6px 0' }}>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4, fontWeight: 500 }}>
                {prediction ? prediction.recommendedActions[0] : 'Flow dynamics operating nominally. No anomalies detected.'}
              </div>
              <div style={{ fontSize: '9px', color: PURPLE, fontWeight: 700, marginTop: '8px', letterSpacing: '0.2px' }}>
                Inference Latency: 12ms · Stable Mode
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px dashed var(--border)', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Blockage Prob</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: (prediction?.blockageProbability ?? 0) > 30 ? AMBER : GREEN }}>
                  {prediction?.blockageProbability ?? 3}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Confidence Score</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {prediction && (prediction as any).confidence ? `${(prediction as any).confidence}%` : '94.8%'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Flow State</span>
                <span style={{ fontWeight: 800, color: GREEN, fontSize: '9px', textTransform: 'uppercase' }}>
                  {chuteStatus || 'STABLE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. WEAR & TEAR TILE (1col × 1row) */}
        <div
          className="bento-tile"
          onClick={() => setExpandedTile('wear')}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Wear & Tear
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', margin: '10px 0' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Liner Wear</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wearIndex.toFixed(1)}% life</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${wearIndex}%`, background: wearIndex < 50 ? RED : GREEN }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Solenoids</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(avgBlasterHealth)}% life</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${avgBlasterHealth}%`, background: avgBlasterHealth < 50 ? RED : GREEN }} />
              </div>
            </div>
          </div>

          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Est. maintenance cycle: 42 days
          </span>
        </div>

        {/* 6. ENVIRONMENT TILE (1col × 1row) */}
        <div
          className="bento-tile"
          onClick={() => setExpandedTile('environment')}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Local Env
          </span>

          <div style={{ display: 'flex', gap: '12px', margin: '8px 0', width: '100%' }}>
            <div className="glass-card" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Thermometer size={14} style={{ color: PURPLE }} />
              <div>
                <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>TEMP</div>
                <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{liveTemperature.toFixed(1)}°C</div>
              </div>
            </div>
            <div className="glass-card" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Droplets size={14} style={{ color: BLUE }} />
              <div>
                <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>HUMID</div>
                <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{liveHumidity.toFixed(0)}%</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Clock size={12} />
            <span>Vizag Standard Time</span>
          </div>
        </div>

        {/* 7. ALERT TIMELINE TILE (2cols × 1row) */}
        <div
          className="bento-tile bento-span-2"
          style={{ justifyContent: 'space-between', paddingBottom: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Alerts & Operations Timeline
            </span>
            <button
              onClick={() => setExpandedTile('timeline')}
              style={{ background: 'none', border: 'none', color: BLUE, fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
            >
              VIEW HISTORY
            </button>
          </div>

          {timelineEvents.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center', width: '100%' }}>
              No active alerts or events logged in system timeline.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflowX: 'auto', width: '100%', padding: '6px 2px' }}>
              {timelineEvents.slice(0, 4).map((ev: any) => (
                <div
                  key={ev.id}
                  className="glass-card"
                  style={{
                    minWidth: '170px', padding: '10px', borderLeft: `3px solid ${ev.color}`,
                    display: 'flex', flexDirection: 'column', gap: '3px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span style={{ fontWeight: 800, color: ev.color, textTransform: 'uppercase' }}>{ev.type}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ev.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NIGH RADAR LOCALIZATION ENGINE & CONTROL PANEL (Bento Span-2) */}
        <div className="glass-panel bento-span-2 bento-tile" style={{ minHeight: '250px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: BLUE, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Nigha Radar Localization Engine
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Operational State & Simulation Control
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: simulationMode ? AMBER : GREEN }}>
                {simulationMode ? 'MANUAL MODE' : 'PRODUCTION MODE'}
              </span>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: simulationMode ? AMBER : GREEN,
                boxShadow: simulationMode ? `0 0 6px ${AMBER}` : `0 0 6px ${GREEN}`
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
            {/* Left: Localization Engine Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Path</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: BLUE }}>
                    {activePath === 'LEFT_SLANT' ? 'LEFT SLANT (\\)' : 'RIGHT SLANT (/)'}
                  </span>
                  <div style={{ display: 'flex', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 900, lineHeight: 1, letterSpacing: '1px' }}>
                    <span style={{ color: activePath === 'LEFT_SLANT' ? BLUE : 'var(--text-muted)', opacity: activePath === 'LEFT_SLANT' ? 1 : 0.25 }}>\</span>
                    <span style={{ color: activePath === 'RIGHT_SLANT' ? BLUE : 'var(--text-muted)', opacity: activePath === 'RIGHT_SLANT' ? 1 : 0.25 }}>/</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Blockage Zone</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: blockagePosition !== 'None' ? RED : GREEN }}>
                  {blockagePosition || 'None'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Blockage Distance</span>
                <span style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: blockagePosition !== 'None' ? RED : GREEN }}>
                  {blockagePosition !== 'None' && typeof blockageDistance === 'number' ? `${blockageDistance.toFixed(2)}m` : '3.50m (Clear)'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Nearest Solenoid Group</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: blockagePosition !== 'None' ? AMBER : 'var(--text-muted)' }}>
                  {blockagePosition !== 'None' ? `Group ${nearestSolenoidGroup} (S${nearestSolenoidGroup}A-D)` : 'None'}
                </span>
              </div>

              {/* Recommendation Box */}
              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                background: blockagePosition !== 'None' ? 'rgba(244,63,94,0.06)' : 'rgba(52,211,153,0.06)',
                border: `1px solid ${blockagePosition !== 'None' ? RED : GREEN}25`,
                fontSize: '9.5px', color: blockagePosition !== 'None' ? RED : GREEN,
                fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px'
              }}>
                <span style={{ textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Blast Recommendation</span>
                <span>
                  {blockagePosition !== 'None'
                    ? `⚠️ FIRE SOLENOID GROUP ${nearestSolenoidGroup} TO CLEAR BUILDUP`
                    : '✅ SYSTEM OPERATING NOMINALLY. NO AIR BLAST REQUIRED.'}
                </span>
              </div>
            </div>

            {/* Right: Operational Mode & Manual Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px dashed var(--border-light)', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational Mode</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(0,0,0,0.15)', padding: '3px', borderRadius: '6px' }}>
                  <button
                    onClick={() => handleToggleSimulationMode(false)}
                    style={{
                      padding: '5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: !simulationMode ? GREEN : 'transparent',
                      color: !simulationMode ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    PRODUCTION
                  </button>
                  <button
                    onClick={() => handleToggleSimulationMode(true)}
                    style={{
                      padding: '5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: simulationMode ? AMBER : 'transparent',
                      color: simulationMode ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    MANUAL SIM
                  </button>
                </div>
              </div>

              {/* Manual Simulation Form */}
              {simulationMode ? (
                <form onSubmit={handleManualBlockageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>ZONE</span>
                      <select
                        value={injZone}
                        onChange={(e) => setInjZone(Number(e.target.value))}
                        style={{
                          width: '100%', padding: '4px 6px', background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px'
                        }}
                      >
                        <option value={1} style={{ background: 'var(--card-bg)' }}>Zone 1 (L-Top)</option>
                        <option value={2} style={{ background: 'var(--card-bg)' }}>Zone 2 (R-Top)</option>
                        <option value={3} style={{ background: 'var(--card-bg)' }}>Zone 3 (R-Bot)</option>
                        <option value={4} style={{ background: 'var(--card-bg)' }}>Zone 4 (L-Bot)</option>
                      </select>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>POSITION DESC</span>
                      <input
                        type="text"
                        value={injPosition}
                        onChange={(e) => setInjPosition(e.target.value)}
                        placeholder="Zone 1"
                        style={{
                          width: '100%', padding: '4px 6px', background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                      <span>DISTANCE</span>
                      <span style={{ color: BLUE, fontFamily: 'var(--font-mono)' }}>{injDistance.toFixed(2)}m</span>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max="3.00"
                      step="0.05"
                      value={injDistance}
                      onChange={(e) => setInjDistance(Number(e.target.value))}
                      style={{ width: '100%', accentColor: BLUE, height: '4px', cursor: 'pointer' }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      padding: '6px', background: 'rgba(0, 212, 255, 0.1)', color: BLUE, border: `1px solid ${BLUE}40`,
                      borderRadius: '4px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', width: '100%',
                      textAlign: 'center', transition: 'all 0.15s ease'
                    }}
                  >
                    INJECT BLOCKAGE
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '6px', opacity: 0.7 }}>
                  <span style={{ fontSize: '20px' }}>📡</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>
                    Localization engine is processing live telemetry from physical radars 1-4.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 9. RADAR Sparkline detail & manual override Valves (Bento Span-2) */}
        <div className="glass-panel bento-span-2 bento-tile" style={{ minHeight: '250px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: BLUE, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Active Blasters Override Panel
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Compressor status: {compressor ? `${compressor.pressure.toFixed(0)} PSI` : 'OFFLINE'}
              </div>
            </div>
            {chuteKpis && (
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Blast Effectiveness Score: <span style={{ color: GREEN, fontWeight: 800 }}>{blastEffScore}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', width: '100%', margin: '14px 0 0 0' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((valveNo) => {
              const sv = solenoids?.find(s => s.valveNumber === valveNo);
              const sHealth = sv?.healthScore ?? 98;
              const zoneIndex = Math.ceil(valveNo / 2) - 1;
              const radar = radars[zoneIndex];
              const isBlocked = radar?.buildupDetected;
              const isTargetValve = isBlocked && (
                radar.distance < 0.65 ? (valveNo % 2 !== 0) : (valveNo % 2 === 0)
              );
              const isOtherValveInBlockedZone = isBlocked && !isTargetValve;

              const isBlasting = activeSolenoidValves.includes(valveNo);
              const canBlast = roleAccess.canTriggerManualBlast && 
                               !(compressor && compressor.pressure < 80) &&
                               !isOtherValveInBlockedZone;

              return (
                <div
                  key={valveNo}
                  className="glass-card"
                  style={{
                    padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px',
                    border: `1px solid ${isBlasting ? BLUE : isTargetValve ? RED : isBlocked ? 'rgba(244,63,94,0.1)' : 'var(--border-light)'}`,
                    background: isBlasting ? 'rgba(0, 212, 255, 0.08)' : 'var(--card-bg)',
                    opacity: isOtherValveInBlockedZone ? 0.45 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>SV{valveNo}</span>
                      {isTargetValve && (
                        <span style={{ fontSize: '7px', padding: '1px 3px', borderRadius: '3px', background: 'rgba(244,63,94,0.15)', color: RED, fontWeight: 800 }}>TARGET</span>
                      )}
                    </div>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: isBlasting ? BLUE : isBlocked ? (isTargetValve ? RED : 'var(--text-muted)') : GREEN,
                      boxShadow: isBlasting ? `0 0 6px ${BLUE}` : 'none'
                    }} />
                  </div>

                  <button
                    disabled={!canBlast}
                    onClick={() => handleManualValveBlast(valveNo)}
                    style={{
                      padding: '4px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '4px',
                      background: isBlasting ? BLUE : isTargetValve ? 'rgba(244,63,94,0.2)' : isOtherValveInBlockedZone ? 'transparent' : 'rgba(0, 212, 255, 0.1)',
                      color: isBlasting ? '#fff' : isTargetValve ? RED : isOtherValveInBlockedZone ? 'var(--text-muted)' : BLUE,
                      cursor: canBlast ? 'pointer' : 'not-allowed',
                      border: isOtherValveInBlockedZone ? '1px dashed var(--border)' : 'none',
                      width: '100%', textAlign: 'center', transition: 'all 0.15s ease'
                    }}
                    title={isOtherValveInBlockedZone ? 'Ineffective valve for current blockage position' : ''}
                  >
                    {isBlasting ? 'BLAST' : isOtherValveInBlockedZone ? 'INACTIVE' : 'FIRE'}
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div className="progress-track" style={{ height: '2px' }}>
                      <div className="progress-fill" style={{ width: `${sHealth}%`, background: sHealth < 50 ? RED : GREEN }} />
                    </div>
                    <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', textAlign: 'right' }}>HLTH: {sHealth}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 10. REAL-TIME DISTANCE SVG TREND CHART (2cols × 1row) */}
        <div className="glass-panel bento-span-2 bento-tile" style={{ padding: '16px' }}>
          <div style={{ flex: 1, minHeight: '170px' }}>
            <TelemetryChart isDark={isDark} />
          </div>
        </div>

        {/* LIVE HARDWARE COMMAND QUEUE PANEL (2cols × 1row) */}
        <div className="glass-panel bento-span-2 bento-tile" style={{ padding: '16px', minHeight: '202px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Live Hardware Command Queue
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="shimmer-badge" style={{ borderColor: 'var(--border)' }}>
                <span className="ai-active-dot" style={{ background: GREEN }} />
                ACTIVE LISTENER
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', overflowY: 'auto', maxHeight: '140px' }}>
            {commandsList.length === 0 ? (
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center', width: '100%' }}>
                No hardware commands logged yet.
              </div>
            ) : (
              commandsList.slice(0, 5).map((cmd) => {
                let statusColor = 'var(--text-muted)';
                if (cmd.status === 'COMPLETED') statusColor = GREEN;
                else if (cmd.status === 'FAILED' || cmd.status === 'TIMEOUT') statusColor = RED;
                else if (cmd.status === 'PUBLISHED' || cmd.status === 'RECEIVED') statusColor = AMBER;
                else if (cmd.status === 'EXECUTING') statusColor = BLUE;

                return (
                  <div
                    key={cmd.commandId}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      borderLeft: `3px solid ${statusColor}`,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                          {cmd.action.replace('_', ' ')}
                        </span>
                        <span style={{
                          fontSize: '8px',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: cmd.triggerSource === 'ai' ? 'rgba(168,85,247,0.15)' : 'rgba(0,212,255,0.15)',
                          color: cmd.triggerSource === 'ai' ? PURPLE : BLUE,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {cmd.triggerSource}
                        </span>
                      </div>
                      <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        ID: {cmd.commandId.substring(0, 8)}... · {new Date(cmd.createdAt).toLocaleTimeString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '9.5px',
                        color: statusColor,
                      }}>
                        {cmd.status}
                      </span>
                      {(cmd.status === 'FAILED' || cmd.status === 'TIMEOUT') && (cmd.retryCount || 0) < (cmd.maxRetries || 3) && (
                        <button
                          onClick={() => handleRetryCommand(cmd.commandId)}
                          style={{
                            background: 'rgba(0, 212, 255, 0.1)',
                            color: BLUE,
                            border: `1px solid ${BLUE}40`,
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '8.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          RETRY
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 8. QUICK ACTIONS TILE (1col × 1row) */}
        <div className="bento-tile">
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Quick Tools
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', margin: '10px 0' }}>
            <button
              onClick={() => setReportModalOpen(true)}
              className="glass-card"
              style={{
                padding: '8px 12px', border: 'none', width: '100%',
                fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
              }}
            >
              <span>📄 EXPORT REPORT</span>
              <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
            </button>

            {roleAccess.canRunCalibration && (
              <button
                onClick={() => setCalibModalOpen(true)}
                className="glass-card"
                style={{
                  padding: '8px 12px', border: 'none', width: '100%',
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                }}
              >
                <span>⚙️ CALIBRATE RADARS</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}

            <button
              onClick={() => setBlockageModalOpen(true)}
              className="glass-card"
              style={{
                padding: '8px 12px', border: 'none', width: '100%',
                fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
              }}
            >
              <span>⚠️ INJECT BLOCKAGE</span>
              <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Calibrates Zone 1-4 telemetry models
          </span>
        </div>

        {/* 12. COMPRESSOR & PRESSURE TILE (1col × 1row) */}
        <div className="bento-tile">
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Compressor Load
          </span>

          {compressor ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', margin: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Pressure:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, color: compressor.pressure < 80 ? RED : BLUE }}>
                  {compressor.pressure.toFixed(0)} PSI
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${compressor.pressure}%`, background: compressor.pressure < 80 ? RED : GREEN }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                <span>Energy Used:</span>
                <span style={{ fontWeight: 600 }}>{energy.toFixed(1)} kWh</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>OFFLINE</div>
          )}

          <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Alert limit threshold &lt; 80 PSI
          </span>
        </div>

      </div>
    </div>
  );
};
