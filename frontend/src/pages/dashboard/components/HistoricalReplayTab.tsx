import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CircularProgress, Slider, Alert } from '@mui/material';
import { Play, Pause, Square, Calendar, Film } from 'lucide-react';
import { useTelemetryStore } from '../../../store/telemetryStore';

interface HistoricalReplayTabProps {
  activeChuteId: string;
  token: string;
}

export const HistoricalReplayTab: React.FC<HistoricalReplayTabProps> = React.memo(({ activeChuteId, token }) => {
  const {
    updateRadarData,
    updateEnvironmental,
    updateCompressorData,
    updateAiPredictionData,
    updateStatus,
    addAlert
  } = useTelemetryStore();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 16);
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 16);
  });

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await fetch(`/_/backend/hardware/replay/${activeChuteId}?start=${new Date(startDate).toISOString()}&end=${new Date(endDate).toISOString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve timeline');
      const data = await res.json();
      setTimeline(data);
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.message || 'Error fetching replay data.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (timeline.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  // Dispatch current event state to the store
  const dispatchEvent = useCallback((event: any) => {
    if (!event) return;
    const { type, data } = event;
    
    if (type === 'telemetry') {
      if (data.radarValues && data.radarValues.length >= 4) {
        updateRadarData(1, data.radarValues[0], data.radarValues[0] < 1.0);
        updateRadarData(2, data.radarValues[1], data.radarValues[1] < 1.0);
        updateRadarData(3, data.radarValues[2], data.radarValues[2] < 1.0);
        updateRadarData(4, data.radarValues[3], data.radarValues[3] < 1.0);
      }
      updateEnvironmental('temperature', data.temperature || 25);
      updateEnvironmental('humidity', data.humidity || 50);
      updateCompressorData({ pressure: data.pressure || 100 });
    } else if (type === 'prediction') {
      updateAiPredictionData(data);
    } else if (type === 'alert') {
      addAlert(data);
    } else if (type === 'blast') {
      updateStatus('Blasting');
      setTimeout(() => updateStatus('Normal'), 2000);
    }
  }, [updateRadarData, updateEnvironmental, updateCompressorData, updateAiPredictionData, updateStatus, addAlert]);

  // Main playback interval loop
  useEffect(() => {
    if (!isPlaying || timeline.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(100, Math.round(1500 / playbackSpeed));

    timerRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        if (prevIndex >= timeline.length - 1) {
          setIsPlaying(false);
          clearInterval(timerRef.current!);
          return prevIndex;
        }
        
        const nextIndex = prevIndex + 1;
        dispatchEvent(timeline[nextIndex]);
        return nextIndex;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, timeline, playbackSpeed, dispatchEvent]);

  // Handle slider change
  const handleSliderChange = (_: any, newValue: number | number[]) => {
    const index = newValue as number;
    setCurrentIndex(index);
    if (timeline[index]) {
      dispatchEvent(timeline[index]);
    }
  };

  const currentEvent = timeline[currentIndex];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🕒 Historical Replay Player</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Replay telemetry scans, predictions, blasts, and alert sequences in chronological time.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* CONTROLS SIDEBAR */}
        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} /> Replay Config
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Start Datetime</label>
            <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>End Datetime</label>
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }} />
          </div>

          <button onClick={fetchTimeline} disabled={loading} style={{ padding: '8px 12px', background: 'var(--accent-primary)', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px', gap: '6px' }}>
            {loading ? <CircularProgress size={16} color="inherit" /> : <><Film size={14} /> Fetch Replay Timeline</>}
          </button>

          {error && <Alert severity="error" style={{ fontSize: '11px', padding: '0 8px' }}>{error}</Alert>}
        </div>

        {/* PLAYBACK PANEL */}
        <div style={{ padding: '24px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SPEED AND STATS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 5, 10].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: playbackSpeed === speed ? 'var(--border-light)' : 'transparent',
                    color: playbackSpeed === speed ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: playbackSpeed === speed ? 'bold' : 'normal',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Total Frames: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{timeline.length}</strong> | Speed: <strong style={{ color: 'var(--accent-primary)' }}>{playbackSpeed}x</strong>
            </div>
          </div>

          {/* TIMELINE SLIDER */}
          <div style={{ padding: '0 8px' }}>
            <Slider
              value={currentIndex}
              min={0}
              max={Math.max(0, timeline.length - 1)}
              onChange={handleSliderChange}
              disabled={timeline.length === 0}
              style={{ color: 'var(--accent-primary)' }}
            />
          </div>

          {/* CONTROLS */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={handlePlayPause} disabled={timeline.length === 0} style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 107, 53, 0.1)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            
            <button onClick={handleStop} disabled={timeline.length === 0} style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Square size={16} />
            </button>
          </div>

          {/* TIMELINE STATUS INDICATOR */}
          {currentEvent && (
            <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                  Event type: {currentEvent.type}
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {new Date(currentEvent.timestamp).toLocaleString()}
                </span>
              </div>

              <pre style={{ margin: 0, fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflowX: 'auto' }}>
                {JSON.stringify(currentEvent.data, null, 2)}
              </pre>
            </div>
          )}

        </div>

      </div>
    </div>
  );
});
