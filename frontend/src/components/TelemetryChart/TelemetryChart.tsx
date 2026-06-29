import React, { useMemo } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';

interface TelemetryChartProps {
  isDark: boolean;
}

const CHART_H = 140;
const CHART_PADDING = { top: 16, bottom: 24, left: 36, right: 12 };

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ isDark }) => {
  const { telemetryHistory } = useTelemetryStore();

  // Dynamic colors based on active theme
  const ZONE_COLORS = isDark
    ? ['#00D4FF', '#A78BFA', '#34D399', '#FBBF24']  // Cyan, Purple, Emerald, Amber
    : ['#0284C7', '#7C3AED', '#059669', '#D97706']; // Deep Cyan, Violet, Forest Green, Gold

  const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4'];

  const chartData = useMemo(() => {
    // Use last 25 telemetry entries
    const data = telemetryHistory.slice(-25);
    if (data.length < 2) return null;

    const chartW = 100; // percentage-based SVG viewBox width
    const innerW = chartW - CHART_PADDING.left - CHART_PADDING.right;
    const innerH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;

    const maxDist = 4.0;
    const minDist = 0.0;

    const toX = (i: number) => CHART_PADDING.left + (i / (data.length - 1)) * innerW;
    const toY = (v: number) => {
      const normalized = 1 - (v - minDist) / (maxDist - minDist);
      return CHART_PADDING.top + normalized * innerH;
    };

    // Build polyline paths for each zone
    const paths = [0, 1, 2, 3].map(zone =>
      data.map((d, i) => {
        const dist = d.radarValues?.[zone] ?? 3.5;
        return `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(dist).toFixed(1)}`;
      }).join(' ')
    );

    // Build fill areas
    const fills = [0, 1, 2, 3].map(zone => {
      const line = data.map((d, i) => {
        const dist = d.radarValues?.[zone] ?? 3.5;
        return `${toX(i).toFixed(1)},${toY(dist).toFixed(1)}`;
      });
      const lastX = toX(data.length - 1).toFixed(1);
      const firstX = toX(0).toFixed(1);
      const bottom = (CHART_PADDING.top + innerH).toFixed(1);
      return `${line.join(' ')} ${lastX},${bottom} ${firstX},${bottom}`;
    });

    // Y-axis labels
    const yLabels = [0, 1, 2, 3, 4].map(v => ({
      y: toY(v),
      label: `${v}m`
    }));

    // X-axis time labels
    const xLabels = data.map((d, i) => {
      if (i % Math.max(1, Math.floor(data.length / 5)) !== 0) return null;
      const ts = d.createdAt ? new Date(d.createdAt) : new Date();
      const hh = ts.getHours().toString().padStart(2, '0');
      const mm = ts.getMinutes().toString().padStart(2, '0');
      const ss = ts.getSeconds().toString().padStart(2, '0');
      return { x: toX(i), label: `${hh}:${mm}:${ss}` };
    }).filter(Boolean);

    // Danger zone line (1.0m threshold)
    const dangerY = toY(1.0);

    return { paths, fills, yLabels, xLabels, dangerY, innerW, innerH, toX, toY };
  }, [telemetryHistory]);

  const bgCell = 'transparent';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const labelColor = isDark ? '#A0B4D0' : '#475569';

  return (
    <div style={{
      background: bgCell,
      position: 'relative',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: isDark ? '#00D4FF' : '#0284C7', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>
          Live Radar Distance Trends
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ZONE_LABELS.map((z, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: labelColor, fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', background: ZONE_COLORS[i], display: 'inline-block', borderRadius: '50%' }} />
              {z}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: isDark ? '#F43F5E' : '#DC2626', fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
            <span style={{ width: '12px', height: '1px', background: isDark ? '#F43F5E' : '#DC2626', display: 'inline-block', borderTop: `1px dashed ${isDark ? '#F43F5E' : '#DC2626'}` }} />
            Limit
          </span>
        </div>
      </div>

      {!chartData ? (
        <div style={{ height: `${CHART_H}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: labelColor, fontSize: '12px' }}>
          Awaiting telemetry stream...
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', minHeight: `${CHART_H}px` }}>
          <svg
            viewBox={`0 0 100 ${CHART_H}`}
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {ZONE_COLORS.map((color, i) => (
                <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {/* Grid lines */}
            {chartData.yLabels.map((yl, i) => (
              <g key={i}>
                <line
                  x1={CHART_PADDING.left} y1={yl.y}
                  x2={100 - CHART_PADDING.right} y2={yl.y}
                  stroke={gridColor} strokeWidth="0.3"
                />
                <text
                  x={CHART_PADDING.left - 3} y={yl.y}
                  textAnchor="end" dominantBaseline="middle"
                  fontSize="3" fill={labelColor}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                >
                  {yl.label}
                </text>
              </g>
            ))}

            {/* Danger zone dashed line at 1m */}
            <line
              x1={CHART_PADDING.left} y1={chartData.dangerY}
              x2={100 - CHART_PADDING.right} y2={chartData.dangerY}
              stroke={isDark ? '#F43F5E' : '#DC2626'} strokeWidth="0.4" strokeDasharray="1,1"
              opacity="0.85"
            />

            {/* X-axis labels */}
            {chartData.xLabels.map((xl, i) => (
              <text
                key={i}
                x={xl!.x} y={CHART_H - CHART_PADDING.bottom + 8}
                textAnchor="middle"
                fontSize="2.5" fill={labelColor}
                fontFamily="'JetBrains Mono', monospace"
              >
                {xl!.label}
              </text>
            ))}

            {/* Fill areas (behind lines) */}
            {chartData.fills.map((fill, i) => (
              <polygon
                key={i}
                points={fill}
                fill={`url(#grad${i})`}
              />
            ))}

            {/* Line paths */}
            {chartData.paths.map((path, i) => (
              <path
                key={i}
                d={path}
                fill="none"
                stroke={ZONE_COLORS[i]}
                strokeWidth="0.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Latest value dots */}
            {[0, 1, 2, 3].map(zone => {
              const lastEntry = telemetryHistory[telemetryHistory.length - 1];
              if (!lastEntry) return null;
              const dist = lastEntry.radarValues?.[zone] ?? 3.5;
              const maxDist = 4.0;
              const innerH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;
              const y = CHART_PADDING.top + (1 - (dist - 0) / (maxDist - 0)) * innerH;
              const x = 100 - CHART_PADDING.right;
              return (
                <circle key={zone} cx={x} cy={y} r="1.0" fill={ZONE_COLORS[zone]} />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
export default TelemetryChart;
