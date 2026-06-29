import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Alert, CircularProgress } from '@mui/material';
import { Activity, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

interface ComponentPrediction {
  component: string;
  blasterNumber?: number;
  valveNumber?: number;
  zone?: number;
  totalBlasts?: number;
  totalCycles?: number;
  lifespanBlasts?: number;
  lifespanCycles?: number;
  runtimeHours?: number;
  pressure?: number;
  driftMetres?: number;
  rulPercent?: number; // only for wear-tracked components
  healthScore: number;
  status: 'Optimal' | 'Warning' | 'Critical';
  priority: number;
}

interface PredictionData {
  chuteId: string;
  overallBlockageProbability: number;
  overallTrend: 'rising' | 'stable' | 'clearing';
  components: ComponentPrediction[];
  recommendedActions: string[];
  lastUpdated: string;
}

interface Props {
  activeChuteId: string | null;
}

export default function PredictivePanel({ activeChuteId }: Props) {
  const { token } = useAuthStore();
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    if (!activeChuteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000/ai/predictions/${activeChuteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch AI predictions');
      const predictions = await res.json();
      setData(predictions);
    } catch (err: any) {
      setError(err.message || 'Failed to load predictive analytics.');
    } finally {
      setLoading(false);
    }
  }, [activeChuteId, token]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  if (!activeChuteId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        Select a chute to load predictive analytics.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
        <CircularProgress size={32} style={{ color: 'var(--accent-primary)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>Running Weibull Reliability Solvers...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '16px 0' }}>
        <Alert severity="error" style={{ fontSize: '12.5px' }}>{error || 'No predictive telemetry available.'}</Alert>
      </div>
    );
  }

  const blockageColor = data.overallBlockageProbability > 75 ? '#F43F5E' : data.overallBlockageProbability > 40 ? '#FB923C' : '#34D399';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header with refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>AI Component Reliability Engine</h3>
        </div>
        <button
          onClick={fetchPredictions}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700
          }}
          title="Recalculate Reliability"
        >
          <RefreshCw size={11} />
          <span>Sync</span>
        </button>
      </div>

      {/* Blockage Risk Dial Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', background: 'var(--bg-panel, rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {/* Circular dial simulation */}
          <svg width="100" height="100" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--border)"
              strokeWidth="2.5"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={blockageColor}
              strokeDasharray={`${data.overallBlockageProbability}, 100`}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: blockageColor }}>{data.overallBlockageProbability}%</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Risk</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Blockage Status</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: blockageColor }}>{data.overallBlockageProbability > 75 ? 'HIGH RISK' : data.overallBlockageProbability > 40 ? 'ELEVATED RISK' : 'NOMINAL'}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Material flow is exhibiting a <strong>{data.overallTrend}</strong> accumulation trend.
          </div>
        </div>
      </div>

      {/* Component Wear RUL List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset Wear & Remaining Useful Life (RUL)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
          {data.components.map((c, idx) => {
            const isCritical = c.status === 'Critical';
            const isWarning = c.status === 'Warning';
            const barColor = isCritical ? '#F43F5E' : isWarning ? '#FB923C' : '#34D399';
            const showRul = c.rulPercent !== undefined;

            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-panel, rgba(255,255,255,0.02))', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{c.component}</span>
                  <span style={{
                    fontSize: '9.5px', fontWeight: 800, color: barColor,
                    background: barColor + '18', border: `1px solid ${barColor}35`,
                    padding: '2px 8px', borderRadius: '10px'
                  }}>
                    {c.status.toUpperCase()}
                  </span>
                </div>

                {/* Sub-text stats */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  {c.totalBlasts !== undefined && (
                    <span>Usage: {c.totalBlasts.toLocaleString()} / {c.lifespanBlasts?.toLocaleString()} blasts</span>
                  )}
                  {c.totalCycles !== undefined && (
                    <span>Usage: {c.totalCycles.toLocaleString()} / {c.lifespanCycles?.toLocaleString()} cycles</span>
                  )}
                  {c.runtimeHours !== undefined && (
                    <span>Runtime: {c.runtimeHours.toLocaleString()}h | Pressure: {c.pressure} PSI</span>
                  )}
                  {c.driftMetres !== undefined && (
                    <span>Telemetry drift: {c.driftMetres > 0 ? `+${c.driftMetres}m` : `${c.driftMetres}m`}</span>
                  )}
                  <span>Health: <strong>{c.healthScore}%</strong></span>
                </div>

                {/* RUL Progress Bar */}
                {showRul && (
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div
                      style={{
                        width: `${c.rulPercent}%`, height: '100%', background: barColor,
                        borderRadius: '3px', transition: 'width 0.8s ease'
                      }}
                    />
                  </div>
                )}
                {showRul && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>Remaining Useful Life (RUL)</span>
                    <span style={{ color: barColor }}>{c.rulPercent}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prescriptive Maintenance Actions</div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.18)',
          borderRadius: '10px', padding: '12px 14px'
        }}>
          {data.recommendedActions.map((act, idx) => {
            const isImmediate = act.startsWith('IMMEDIATE:');
            const isPreventive = act.startsWith('PREVENTIVE:');
            const iconColor = isImmediate ? '#F43F5E' : isPreventive ? '#FB923C' : '#34D399';

            return (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {isImmediate || isPreventive ? (
                  <ShieldAlert size={14} style={{ color: iconColor, marginTop: '2.5px', flexShrink: 0 }} />
                ) : (
                  <CheckCircle size={14} style={{ color: iconColor, marginTop: '2.5px', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {act}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
