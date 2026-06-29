import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { Alert, CircularProgress } from '@mui/material';

const API = '/_/backend';

interface ChuteKPI {
  chuteId: string;
  chuteName: string;
  status: string;
  materialType: string;
  uptimePercent24h: number;
  blockageMinutesToday: number;
  blockageProbability: number;
  overallTrend: string;
  lastBlastScore: number;
  consecutiveFailedBlasts: number;
  openAlerts: number;
  airLitresToday: number;
}

interface FleetData {
  fleetSize: number;
  fleetUptimePercent24h: number;
  totalBlockageMinutesToday: number;
  criticalChuteCount: number;
  worstPerformer: ChuteKPI | null;
  chutes: ChuteKPI[];
}

export default function FleetAnalytics() {
  const { token } = useAuthStore();
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTrend, setFilterTrend] = useState<string>('all');

  const fetchFleetKpis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/industry/fleet/kpis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch fleet KPIs');
      const kpis = await res.json();
      setData(kpis);
    } catch (err: any) {
      setError(err.message || 'Failed to load fleet analytics.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFleetKpis();
  }, [fetchFleetKpis]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 16 }}>
        <CircularProgress style={{ color: 'var(--accent-primary)' }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Aggregating Fleet Intelligence...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24 }}>
        <Alert severity="error">{error || 'No fleet data available.'}</Alert>
      </div>
    );
  }

  // Filtered chutes
  const filteredChutes = data.chutes.filter(c => {
    if (filterTrend === 'all') return true;
    return c.overallTrend.toLowerCase() === filterTrend.toLowerCase();
  });

  // Calculate estimated maintenance costs (mocked based on open alerts, consecutive failed blasts, and uptime)
  const totalEstimatedCost = data.chutes.reduce((sum, c) => {
    const alertCost = c.openAlerts * 120;
    const failureCost = c.consecutiveFailedBlasts * 450;
    const uptimeLoss = (100 - c.uptimePercent24h) * 95;
    return sum + alertCost + failureCost + uptimeLoss;
  }, 0);

  // Generate SVG Bar Chart helper
  const maxBlockage = Math.max(...data.chutes.map(c => c.blockageMinutesToday), 10);
  const chartHeight = 160;
  const chartWidth = 500;
  const barWidth = Math.max(20, Math.floor(chartWidth / (data.chutes.length || 1)) - 10);

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflowY: 'auto', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📊 Fleet Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Super Admin executive overview of plant assets, downtime, and operational efficiency
          </p>
        </div>
        <button
          onClick={fetchFleetKpis}
          style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 16px', color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center'
          }}
        >
          🔄 Refresh Fleet Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
        {[
          { label: 'Active Fleet Size', value: data.fleetSize, desc: 'Total tracked chutes', color: '#00D4FF' },
          { label: 'Fleet Average Uptime', value: `${data.fleetUptimePercent24h}%`, desc: 'Average 24h operational availability', color: '#34D399' },
          { label: 'Total Blockages Today', value: `${data.totalBlockageMinutesToday} min`, desc: 'Cumulative downtime across fleet', color: '#F43F5E' },
          { label: 'Critical / Failed Chutes', value: data.criticalChuteCount, desc: 'Failed blasts or blocked status', color: data.criticalChuteCount > 0 ? '#FB923C' : '#34D399' },
        ].map((c, i) => (
          <div
            key={i}
            className="glass-panel"
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{c.label}</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Main Analytics Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Downtime & Performance Charts */}
        <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>📉 Downtime Analysis (Blockage Minutes Today)</h3>
          
          {data.chutes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No chutes registered for charting.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width="100%" height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} style={{ overflow: 'visible' }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = chartHeight - (p * chartHeight);
                  const val = Math.round(p * maxBlockage);
                  return (
                    <g key={idx}>
                      <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="var(--border)" strokeDasharray="4 4" strokeWidth="0.5" />
                      <text x="-10" y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{val}m</text>
                    </g>
                  );
                })}

                {/* Bars */}
                {data.chutes.map((chute, idx) => {
                  const x = idx * (barWidth + 10) + 15;
                  const barHeight = (chute.blockageMinutesToday / maxBlockage) * chartHeight;
                  const y = chartHeight - barHeight;
                  const isCritical = chute.blockageMinutesToday > 15;

                  return (
                    <g key={chute.chuteId}>
                      {/* Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, 2)}
                        rx="4"
                        fill={isCritical ? 'url(#red-grad)' : 'url(#blue-grad)'}
                        style={{ transition: 'all 0.5s ease-in-out' }}
                      />
                      {/* Value label */}
                      {chute.blockageMinutesToday > 0 && (
                        <text x={x + barWidth / 2} y={y - 6} fill="var(--text-primary)" fontSize="10" fontWeight="700" textAnchor="middle">
                          {chute.blockageMinutesToday}m
                        </text>
                      )}
                      {/* X-axis labels */}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight + 16}
                        fill="var(--text-secondary)"
                        fontSize="8.5"
                        fontWeight="600"
                        textAnchor="middle"
                        transform={`rotate(12, ${x + barWidth / 2}, ${chartHeight + 16})`}
                      >
                        {chute.chuteName.split(' ')[0]}..
                      </text>
                    </g>
                  );
                })}

                {/* Gradients */}
                <defs>
                  <linearGradient id="blue-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4FF" />
                    <stop offset="100%" stopColor="#005C8A" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="red-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" />
                    <stop offset="100%" stopColor="#991B1B" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
        </div>

        {/* Worst Performer Callout & Cost Estimation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.worstPerformer ? (
            <div
              className="glass-panel"
              style={{
                background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.25)',
                borderRadius: 12, padding: 20, flex: 1
              }}
            >
              <span style={{ fontSize: 11, color: '#F43F5E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                ⚠️ Critical Attention Required
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 12px' }}>
                Worst Performer: {data.worstPerformer.chuteName}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Uptime (24h)</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#F43F5E' }}>{data.worstPerformer.uptimePercent24h}%</div>
                </div>
                <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Blockage Prob.</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#FB923C' }}>{data.worstPerformer.blockageProbability}%</div>
                </div>
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                This chute is exhibiting recurrent blockages with <strong>{data.worstPerformer.consecutiveFailedBlasts} consecutive failed blasts</strong>. 
                Compressor pressure and radar sensor calibration must be verified immediately.
              </p>
              
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Air consumption today: <strong>{data.worstPerformer.airLitresToday.toLocaleString()} Litres</strong>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: 32 }}>✨</span>
                <h4 style={{ margin: '8px 0', fontWeight: 700 }}>All Systems Optimal</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>No critical performance degradation detected across the fleet.</p>
              </div>
            </div>
          )}

          {/* Maintenance Cost Estimator */}
          <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Estimated Operational Loss</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0', color: 'var(--text-primary)' }}>
                  ${Math.round(totalEstimatedCost).toLocaleString()}
                </h3>
              </div>
              <span style={{ fontSize: 12, color: '#34D399', background: '#34D39922', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                Estimated Daily
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Calculated dynamically based on active hardware alerts ($120/ea), consecutive blast failures ($450/ea), and uptime downtime losses ($95/%).
            </p>
          </div>
        </div>
      </div>

      {/* Plant-wise Chute Performance Table */}
      <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🏭 Plant Chute Registry & Performance Matrix</h3>
          
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'stable', 'improving', 'degrading'].map(t => (
              <button
                key={t}
                onClick={() => setFilterTrend(t)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: filterTrend === t ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: filterTrend === t ? 'var(--accent-primary-alpha)' : 'transparent',
                  color: 'var(--text-primary)', textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Chute Name</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Material</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>24h Uptime</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Blockage Prob.</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Air Cons. (L)</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Alerts</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {filteredChutes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                    No chutes matching this trend filter.
                  </td>
                </tr>
              ) : (
                filteredChutes.map(c => {
                  const isBlocked = c.status === 'Blocked';
                  const isWarning = c.status === 'Warning';
                  const statusColor = isBlocked ? '#F43F5E' : isWarning ? '#FB923C' : '#34D399';
                  
                  const trendColor = c.overallTrend === 'improving' ? '#34D399' : c.overallTrend === 'degrading' ? '#F43F5E' : 'var(--text-muted)';

                  return (
                    <tr key={c.chuteId} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '12px 8px', fontWeight: 700 }}>{c.chuteName}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 12, fontWeight: 700, color: statusColor
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{c.materialType}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: c.uptimePercent24h < 90 ? '#F43F5E' : '#34D399' }}>
                        {c.uptimePercent24h}%
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{c.blockageProbability}%</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{c.airLitresToday.toLocaleString()}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {c.openAlerts > 0 ? (
                          <span style={{ background: '#F43F5E22', color: '#F43F5E', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                            {c.openAlerts} Active
                          </span>
                        ) : (
                          <span style={{ color: '#34D399', fontSize: 11, fontWeight: 600 }}>✓ Clear</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textTransform: 'capitalize', fontWeight: 600, color: trendColor }}>
                        {c.overallTrend}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
