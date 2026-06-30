import React from 'react';
import { Drawer, CircularProgress, Button } from '@mui/material';
import { getThemeColors } from '../../constants';
import { TelemetryChart } from '../../../../components/TelemetryChart/TelemetryChart';

// Lazy load heavy components for route/bundle optimization
const ChuteDigitalTwin = React.lazy(() => import('../../../../components/DigitalTwin/ChuteDigitalTwin').then(module => ({ default: module.ChuteDigitalTwin })));
const PredictivePanel = React.lazy(() => import('../../../../components/PredictiveEngine/PredictivePanel'));

interface DrillDownDrawerProps {
  expandedTile: string | null;
  onClose: () => void;
  activeChuteId: string | null;
  theme: 'dark' | 'light';
  twinRotationX: number;
  radars: any[];
  chuteHealthScore: number;
  chuteKpis: any;
  avgBlasterHealth: number;
  blastEffScore: number;
  compHealth: number;
  solenoids: any[];
  liveTemperature: number;
  liveHumidity: number;
  timelineEvents: any[];
  roleAccess: any;
  handleResolveAlert: (id: string) => Promise<void>;
  wearIndex: number;
}

export const DrillDownDrawer: React.FC<DrillDownDrawerProps> = ({
  expandedTile,
  onClose,
  activeChuteId,
  theme,
  twinRotationX,
  radars,
  chuteHealthScore,
  chuteKpis,
  avgBlasterHealth,
  blastEffScore,
  compHealth,
  solenoids,
  liveTemperature,
  liveHumidity,
  timelineEvents,
  roleAccess,
  handleResolveAlert,
  wearIndex,
}) => {
  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const BLUE = colors.BLUE;
  const AMBER = colors.AMBER;

  const isDark = theme === 'dark';
  const healthColor = chuteHealthScore >= 80 ? GREEN : chuteHealthScore >= 50 ? AMBER : RED;

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

  return (
    <Drawer
      anchor="right"
      open={expandedTile !== null}
      onClose={onClose}
      slotProps={{
        paper: {
          style: {
            width: window.innerWidth < 600 ? '100%' : '550px',
            background: 'var(--card-bg)',
            borderLeft: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '24px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 40px rgba(0,0,0,0.5)'
          }
        }
      }}
    >
      {expandedTile ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: BLUE, textTransform: 'uppercase', letterSpacing: '1px' }}>DRILL-DOWN MATRIX</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0 0', textTransform: 'capitalize' }}>{expandedTile} Overview</h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--border-light)', border: 'none', color: 'var(--text-secondary)',
                borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {expandedTile === 'hero' && (
              <>
                <div className="glass-panel" style={{ height: '320px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  <React.Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      <CircularProgress color="inherit" size={30} />
                    </div>
                  }>
                    <ChuteDigitalTwin theme={theme} rotationX={twinRotationX} />
                  </React.Suspense>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Telemetry Zones Summary</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {radars.map((r, i) => (
                      <div key={i} className="glass-card" style={{ padding: '12px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>ZONE {i + 1} SENSOR</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{r.distance.toFixed(2)}m</span>
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: r.buildupDetected ? 'rgba(244,63,94,0.1)' : 'rgba(52,211,153,0.1)', color: r.buildupDetected ? RED : GREEN, fontWeight: 800 }}>
                            {r.buildupDetected ? 'BUILDUP' : 'CLEAR'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {expandedTile === 'health' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                  {renderRadialGauge(chuteHealthScore, healthColor)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Health Matrix Breakdowns</h3>
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { name: 'Uptime Index (24h)', val: `${chuteKpis?.uptimePercent24h ?? 100}%`, status: GREEN },
                      { name: 'Air Blaster Health', val: `${Math.round(avgBlasterHealth)}%`, status: avgBlasterHealth > 70 ? GREEN : AMBER },
                      { name: 'Blast Effectiveness', val: `${blastEffScore}/100`, status: blastEffScore > 75 ? GREEN : AMBER },
                      { name: 'Compressor Health', val: `${compHealth}%`, status: compHealth > 80 ? GREEN : RED },
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                        <span style={{ fontWeight: 800, color: item.status }}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {expandedTile === 'throughput' && (
              <>
                <div style={{ padding: '10px 0' }}>
                  <TelemetryChart isDark={isDark} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Throughput Performance Details</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Real-time flow sensors monitor bulk material velocity and volume cross-sections to generate continuous throughput calculations.
                  </p>
                </div>
              </>
            )}

            {expandedTile === 'ai' && (
              <React.Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <CircularProgress color="inherit" size={30} />
                </div>
              }>
                <PredictivePanel activeChuteId={activeChuteId} />
              </React.Suspense>
            )}

            {expandedTile === 'wear' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Chute Liner Wear (Est)</h3>
                    <div className="progress-track" style={{ height: '8px', marginBottom: '6px' }}>
                      <div className="progress-fill" style={{ width: `${wearIndex}%`, background: wearIndex < 50 ? RED : GREEN }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Remaining Liner Life:</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{wearIndex.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Solenoids Health Register</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {solenoids?.map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                          <span>Solenoid Valve SV{s.valveNumber}</span>
                          <span style={{ fontWeight: 700, color: s.healthScore > 80 ? GREEN : AMBER }}>{s.healthScore}% health</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {expandedTile === 'environment' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 }}>TEMPERATURE</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{liveTemperature.toFixed(1)}°C</div>
                  </div>
                  <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 }}>RELATIVE HUMIDITY</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{liveHumidity.toFixed(0)}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Telemetry Logs</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Sensors calibrate atmospheric humidity and temperature inside the chute housing to predict material adhesion factors (limestone, coal).
                  </p>
                </div>
              </>
            )}

            {expandedTile === 'timeline' && (
              <>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Full Chronological Events Logs</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {timelineEvents.map((ev) => (
                    <div key={ev.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '4px', alignSelf: 'stretch', borderRadius: '2px', background: ev.color }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 800, color: ev.color, textTransform: 'uppercase' }}>{ev.type}</span>
                          <span>{ev.timestamp}</span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{ev.label}</div>
                      </div>
                      {ev.type === 'alert' && roleAccess.isManager && (
                        <button
                          onClick={() => handleResolveAlert(ev.id)}
                          style={{
                            padding: '4px 8px', fontSize: '10px', background: 'rgba(52,211,153,0.1)',
                            border: `1px solid ${GREEN}30`, color: GREEN, borderRadius: '4px', cursor: 'pointer'
                          }}
                        >
                          RESOLVE
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <Button fullWidth variant="outlined" onClick={onClose} style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              Close Overview
            </Button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
};
